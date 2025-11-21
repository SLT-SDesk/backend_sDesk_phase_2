import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { CategoryItem } from '../Categories/Entities/Categories.entity';
import { io } from '../main';
import { NotificationsService } from '../notifications/notifications.service';
import { SLTUser } from '../sltusers/entities/sltuser.entity';
import { TeamAdmin } from '../teamadmin/entities/teamadmin.entity';
import { Technician } from '../technician/entities/technician.entity';
import { IncidentDto } from './dto/incident.dto';
import { IncidentHistory } from './entities/incident-history.entity';
import { Incident, IncidentStatus } from './entities/incident.entity';
import { INCIDENT_REQUIRED_FIELDS } from './incident.interface';

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);
  // Round-robin assignment tracking for each team
  private teamAssignmentIndex: Map<string, number> = new Map();
  // Tier2 round-robin assignment tracking
  private tier2AssignmentIndex: Map<string, number> = new Map();

  constructor(
    @InjectRepository(Incident)
    private incidentRepository: Repository<Incident>,
    @InjectRepository(Technician)
    private technicianRepository: Repository<Technician>,
    @InjectRepository(IncidentHistory)
    private incidentHistoryRepository: Repository<IncidentHistory>,
    @InjectRepository(CategoryItem)
    private categoryItemRepository: Repository<CategoryItem>,
    @InjectRepository(SLTUser)
    private sltUserRepository: Repository<SLTUser>,
    @InjectRepository(TeamAdmin)
    private teamAdminRepository: Repository<TeamAdmin>,
    private notificationsService: NotificationsService,
  ) { }

  // Helper method to get display_name from slt_users table by serviceNum
  private async getDisplayNameByServiceNum(serviceNum: string): Promise<string> {
    if (!serviceNum) return serviceNum;
    try {
      const user = await this.sltUserRepository.findOne({
        where: { serviceNum: serviceNum }
      });
      return user ? user.display_name : serviceNum;
    } catch (error) {
      return serviceNum;
    }
  }

  // $$$$$
  private async generateIncidentNumber(): Promise<string> {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const dateCode = `${year}.${month}.${day}`;

    // Convert to YYYY-MM-DD for update_on field
    const todayDateString = `${year}-${month}-${day}`;

    // Count incidents where update_on = today's date
    const todayCount = await this.incidentRepository.count({
      where: {
        update_on: todayDateString,
      },
    });

    const sequence = String(todayCount + 1).padStart(4, '0');

    return `IN${dateCode}.${sequence}`;
  }


  async create(incidentDto: IncidentDto): Promise<Incident> {
    try {
      for (const field of INCIDENT_REQUIRED_FIELDS) {
        if (!incidentDto[field]) {
          throw new BadRequestException(`Missing required field: ${field}`);
        }
      }

      //const sequenceResult = await this.incidentRepository.query(
      //  "SELECT nextval('incident_number_seq') as value",
      //);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      //const nextId = sequenceResult[0]?.value;
      //if (!nextId) {
      //throw new BadRequestException('Failed to generate incident number');
      //}
      //const incidentNumber = `IN${nextId}`;

      // $$$$$-- new change Set the date for update_on so daily counting works
      incidentDto.update_on = new Date().toISOString().split('T')[0];

      //$$$$4 new change NEW format eka(INYYYY.MM.DD.XXXX)
      const incidentNumber = await this.generateIncidentNumber();


      // --- Team-based Technician Assignment Logic ---
      // Step 1: Find CategoryItem by name (incidentDto.category is the category name)
      const categoryItem = await this.categoryItemRepository.findOne({
        where: { name: incidentDto.category },
        relations: ['subCategory', 'subCategory.mainCategory'],
      });

      if (!categoryItem) {
        throw new BadRequestException(
          `Category '${incidentDto.category}' not found`,
        );
      }

      // Step 2: Get MainCategory ID (this is the team ID)
      const mainCategoryId = categoryItem.subCategory?.mainCategory?.id;
      if (!mainCategoryId) {
        throw new BadRequestException(
          `No team found for category '${incidentDto.category}'`,
        );
      }

      // Step 3: Get the team name from mainCategory
      const teamName = categoryItem.subCategory?.mainCategory?.name;

      // Step 3a: Get the SubCategory name for technician matching
      const subCategoryName = categoryItem.subCategory?.name;
      if (!subCategoryName) {
        throw new BadRequestException(
          `No sub-category found for category '${incidentDto.category}'`,
        );
      }

      // Step 4: Get all active tier1 technicians for the team and sub-category
      let assignedTechnician: Technician | null = null;
      const tierVariants = ['Tier1', 'tier1'];
      const teamIdentifiers = [mainCategoryId, teamName].filter(Boolean);

      for (const team of teamIdentifiers) {
        for (const tier of tierVariants) {
          // Find all active tier1 technicians for this team
          const availableTechnicians = await this.technicianRepository.find({
            where: { team: team, tier: tier, active: true },
            order: {
              id: 'ASC', // Consistent ordering for round-robin
            },
          });

          if (availableTechnicians.length > 0) {
            // Create a temporary incident object for skill checking
            const tempIncident = { category: incidentDto.category } as Incident;

            // Filter technicians based on sub-category skills first
            const skilledTechnicians: Technician[] = [];

            this.logger.log(`[SUB-CATEGORY-ASSIGNMENT] Checking skills for ${availableTechnicians.length} technicians for sub-category '${subCategoryName}' (category: ${incidentDto.category})`);

            for (const tech of availableTechnicians) {
              const isSkilled = await this.isTechnicianSkilledForIncident(tech, tempIncident);
              if (isSkilled) {
                skilledTechnicians.push(tech);
                this.logger.log(`[SUB-CATEGORY-ASSIGNMENT] Technician ${tech.serviceNum} is skilled for sub-category '${subCategoryName}'`);
              } else {
                this.logger.log(`[SUB-CATEGORY-ASSIGNMENT] Technician ${tech.serviceNum} is NOT skilled for sub-category '${subCategoryName}'`);
              }
            }

            this.logger.log(`[SUB-CATEGORY-ASSIGNMENT] Found ${skilledTechnicians.length} skilled technicians out of ${availableTechnicians.length} available for sub-category '${subCategoryName}'`);

            if (skilledTechnicians.length > 0) {
              // Implement hybrid round-robin assignment with workload consideration on skilled technicians
              const teamKey = `${team}_${tier}_${subCategoryName}`; // More specific key for round-robin tracking

              if (skilledTechnicians.length === 1) {
                // If only one skilled technician available, check their workload
                const singleTech = skilledTechnicians[0];
                const activeWorkload = await this.incidentRepository.count({
                  where: {
                    handler: singleTech.serviceNum,
                    status: In([IncidentStatus.OPEN, IncidentStatus.HOLD, IncidentStatus.IN_PROGRESS])
                  },
                });

                // Only assign if technician has less than 3 active incidents
                if (activeWorkload < 3) {
                  assignedTechnician = singleTech;
                  this.logger.log(`[SUB-CATEGORY-ASSIGNMENT] Single skilled technician available: ${singleTech.serviceNum} with workload ${activeWorkload}/3`);
                } else {
                  this.logger.log(`[SUB-CATEGORY-ASSIGNMENT] Single skilled technician ${singleTech.serviceNum} at max capacity (${activeWorkload}/3)`);
                }
              } else {
                // Multiple skilled technicians available - use round-robin with workload filtering
                const currentIndex = this.teamAssignmentIndex.get(teamKey) || 0;
                let attemptCount = 0;
                let selectedIndex = currentIndex;

                // Try round-robin starting from current index
                while (attemptCount < skilledTechnicians.length) {
                  const candidateTech = skilledTechnicians[selectedIndex];
                  const activeWorkload = await this.incidentRepository.count({
                    where: {
                      handler: candidateTech.serviceNum,
                      status: In([IncidentStatus.OPEN, IncidentStatus.HOLD, IncidentStatus.IN_PROGRESS])
                    },
                  });

                  // Check if this technician has capacity
                  if (activeWorkload < 3) {
                    assignedTechnician = candidateTech;
                    // Update round-robin index for next assignment
                    const nextIndex = (selectedIndex + 1) % skilledTechnicians.length;
                    this.teamAssignmentIndex.set(teamKey, nextIndex);
                    this.logger.log(`[SUB-CATEGORY-ASSIGNMENT] Round-robin assigned to skilled technician ${candidateTech.serviceNum} with workload ${activeWorkload}/3 (index: ${selectedIndex})`);
                    break;
                  }

                  // Move to next technician in round-robin
                  selectedIndex = (selectedIndex + 1) % skilledTechnicians.length;
                  attemptCount++;
                }

                if (!assignedTechnician) {
                  this.logger.log(`[SUB-CATEGORY-ASSIGNMENT] All ${skilledTechnicians.length} skilled technicians for sub-category '${subCategoryName}' are at max capacity (3 incidents each)`);
                }
              }
            } else {
              this.logger.log(`[SUB-CATEGORY-ASSIGNMENT] No skilled technicians found for sub-category '${subCategoryName}' in team '${team}'`);
            }

            if (assignedTechnician) break;
          }
        }
        if (assignedTechnician) break;
      }

      // Step 5: Check for a technician and create the incident
      let incident: Incident;
      if (assignedTechnician) {
        // If a technician is found, assign them
        incident = this.incidentRepository.create({
          ...incidentDto,
          incident_number: incidentNumber,
          handler: assignedTechnician.serviceNum,
          status: IncidentStatus.OPEN, // Explicitly set status to OPEN
        });
      } else {
        // If no technician is found, create the incident as PENDING_ASSIGNMENT

        incident = this.incidentRepository.create({
          ...incidentDto,
          incident_number: incidentNumber,
          handler: null, // No handler assigned
          status: IncidentStatus.PENDING_ASSIGNMENT, // Set status to PENDING
        });
      }

      const savedIncident = await this.incidentRepository.save(incident);

      // Emit socket events for newly created incident (notify assigned tech and broadcast)
      try {
        this.emitIncidentSocketEvents(savedIncident, 'created');
        this.logger.log(`[SOCKET] Emitted created event for incident ${savedIncident.incident_number}`);
      } catch (err) {
        this.logger.error(`[SOCKET] Failed to emit created event for incident ${savedIncident.incident_number}: ${err?.message || err}`);
      }

      // Get display names for incident history
      const assignedToDisplayName = savedIncident.handler
        ? await this.getDisplayNameByServiceNum(savedIncident.handler)
        : 'Pending Assignment';
      const updatedByDisplayName = await this.getDisplayNameByServiceNum(
        savedIncident.informant,
      );

      // Create initial incident history entry
      const initialHistory = new IncidentHistory();
      initialHistory.incidentNumber = savedIncident.incident_number;
      initialHistory.status = savedIncident.status;
      initialHistory.assignedTo = assignedToDisplayName;
      initialHistory.updatedBy = updatedByDisplayName;
      initialHistory.comments = incidentDto.description || '';
      initialHistory.category = savedIncident.category;
      initialHistory.location = savedIncident.location;
      initialHistory.attachment = incidentDto.attachmentFilename || '';
      initialHistory.attachmentOriginalName = incidentDto.attachmentOriginalName || '';
      await this.incidentHistoryRepository.save(initialHistory);

      return savedIncident;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Failed to create incident: ' + message,
      );
    }
  }


  async getAssignedToMe(handler: string): Promise<Incident[]> {
    try {
      if (!handler) {
        throw new BadRequestException('handler is required');
      }
      return await this.incidentRepository.find({
        where: { handler: handler },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Failed to retrieve incidents: ' + message,
      );
    }
  }
  async getAssignedByMe(informant: string): Promise<Incident[]> {

    try {
      if (!informant) {
        throw new BadRequestException('informant is required');
      }

      const trimmedInformant = informant.trim();

      // First, clean up any existing data with whitespace issues
      await this.cleanupInformantWhitespace();


      // Use LIKE with trimmed spaces to handle potential whitespace issues
      const incidents = await this.incidentRepository
        .createQueryBuilder('incident')
        .where('TRIM(incident.informant) = :informant', {
          informant: trimmedInformant,
        })
        .getMany();


      return incidents;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Failed to retrieve incidents assigned by informant: ' + message,
      );
    }
  }

  // Helper method to clean up whitespace in informant field
  private async cleanupInformantWhitespace(): Promise<void> {
    try {
      const incidents = await this.incidentRepository.find();
      const updates: Promise<Incident>[] = [];

      for (const incident of incidents) {
        const trimmedInformant = incident.informant?.trim();
        if (incident.informant !== trimmedInformant) {
          incident.informant = trimmedInformant;
          updates.push(this.incidentRepository.save(incident));
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
      }
    } catch (error) {
      // Silent fail for cleanup
    }
  }

  async getAll(): Promise<Incident[]> {
    try {
      return await this.incidentRepository.find();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Failed to retrieve all incidents: ' + message,
      );
    }
  }
  async getByCategory(category: string): Promise<Incident[]> {
    try {
      if (!category) {
        throw new BadRequestException('category is required');
      }
      return await this.incidentRepository.find({
        where: { category: category },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Failed to retrieve incidents by category: ' + message,
      );
    }
  }

  async update(
    incident_number: string,
    incidentDto: IncidentDto,
  ): Promise<Incident> {
    try {

      //  $$$$$$$$-----disable team admin approval completely
      incidentDto.assignForTeamAdmin = false;


      const incident = await this.incidentRepository.findOne({
        where: { incident_number },
      });
      if (!incident) {
        throw new NotFoundException(
          `Incident with incident_number ${incident_number} not found`,
        );
      }
      if (Object.keys(incidentDto).length == 0) {
        throw new BadRequestException(
          'At least one field is required to update',
        );
      }

      // Store original values for comparison
      const originalStatus = incident.status;
      const originalHandler = incident.handler;
      const originalCategory = incident.category;

      // Variables to track transfer operations for socket events
      let tier2Tech: Technician | null = null;
      let teamAdmin: TeamAdmin | null = null;
      let reassignedTechnician: Technician | null = null; // Track category-based reassignment

      // Track if this is a status change to CLOSED or a transfer operation
      const isClosingIncident = incidentDto.status === IncidentStatus.CLOSED && originalStatus !== IncidentStatus.CLOSED;

      //---------------------------------------------- this one -------
      const isTransferOperation = (incidentDto.automaticallyAssignForTier2 || incidentDto.assignForTeamAdmin) &&
        incidentDto.handler && incidentDto.handler !== originalHandler;

      this.logger.log(`[UPDATE] Incident ${incident_number}: isClosing=${isClosingIncident}, isTransfer=${isTransferOperation}`);

      // --- Category Change Logic ---
      const categoryChanged = incidentDto.category && incidentDto.category !== originalCategory;

      if (categoryChanged) {
        // Find CategoryItem by name (incidentDto.category is the category name)
        const categoryItem = await this.categoryItemRepository.findOne({
          where: { name: incidentDto.category },
          relations: ['subCategory', 'subCategory.mainCategory'],
        });

        if (!categoryItem) {
          console.error(`[IncidentService] New category '${incidentDto.category}' not found for reassignment.`);
          throw new BadRequestException(
            `New category '${incidentDto.category}' not found for reassignment.`,
          );
        }

        const mainCategoryId = categoryItem.subCategory?.mainCategory?.id;
        const teamName = categoryItem.subCategory?.mainCategory?.name;
        const subCategoryName = categoryItem.subCategory?.name;

        if (!mainCategoryId && !teamName) {
          console.error(`[IncidentService] No team found for new category '${incidentDto.category}' for reassignment.`);
          throw new BadRequestException(
            `No team found for new category '${incidentDto.category}' for reassignment.`,
          );
        }

        if (!subCategoryName) {
          console.error(`[IncidentService] No sub-category found for new category '${incidentDto.category}' for reassignment.`);
          throw new BadRequestException(
            `No sub-category found for new category '${incidentDto.category}' for reassignment.`,
          );
        }

        let assignedTechnician: Technician | null = null;
        const tierVariants = ['Tier1', 'tier1'];
        const teamIdentifiers = [mainCategoryId, teamName].filter(Boolean);

        for (const team of teamIdentifiers) {
          for (const tier of tierVariants) {
            // Find all active tier1 technicians for this team
            const availableTechnicians = await this.technicianRepository.find({
              where: { team: team, tier: tier, active: true },
              order: { id: 'ASC' },
            });

            if (availableTechnicians.length > 0) {
              // Create a temporary incident object for skill checking with new category
              const tempIncident = { category: incidentDto.category } as Incident;

              // Filter technicians based on sub-category skills first
              const skilledTechnicians: Technician[] = [];

              this.logger.log(`[CATEGORY-CHANGE-SKILL] Checking skills for ${availableTechnicians.length} technicians for sub-category '${subCategoryName}' (new category: ${incidentDto.category})`);

              for (const tech of availableTechnicians) {
                const isSkilled = await this.isTechnicianSkilledForIncident(tech, tempIncident);
                if (isSkilled) {
                  skilledTechnicians.push(tech);
                  this.logger.log(`[CATEGORY-CHANGE-SKILL] Technician ${tech.serviceNum} is skilled for sub-category '${subCategoryName}'`);
                } else {
                  this.logger.log(`[CATEGORY-CHANGE-SKILL] Technician ${tech.serviceNum} is NOT skilled for sub-category '${subCategoryName}'`);
                }
              }

              this.logger.log(`[CATEGORY-CHANGE-SKILL] Found ${skilledTechnicians.length} skilled technicians out of ${availableTechnicians.length} available for sub-category '${subCategoryName}'`);

              if (skilledTechnicians.length > 0) {
                // Implement hybrid round-robin assignment with workload consideration on skilled technicians
                const teamKey = `${team}_${tier}_${subCategoryName}_update`; // More specific key for round-robin tracking

                if (skilledTechnicians.length === 1) {
                  // If only one skilled technician available, check their workload
                  const singleTech = skilledTechnicians[0];
                  const activeWorkload = await this.incidentRepository.count({
                    where: {
                      handler: singleTech.serviceNum,
                      status: In([IncidentStatus.OPEN, IncidentStatus.HOLD, IncidentStatus.IN_PROGRESS])
                    },
                  });

                  // Only assign if technician has less than 3 active incidents
                  if (activeWorkload < 3) {
                    assignedTechnician = singleTech;
                    this.logger.log(`[CATEGORY-CHANGE-SKILL] Single skilled technician available: ${singleTech.serviceNum} with workload ${activeWorkload}/3`);
                  } else {
                    this.logger.log(`[CATEGORY-CHANGE-SKILL] Single skilled technician ${singleTech.serviceNum} at max capacity (${activeWorkload}/3)`);
                  }
                } else {
                  // Multiple skilled technicians available - use round-robin with workload filtering
                  const currentIndex = this.teamAssignmentIndex.get(teamKey) || 0;
                  let attemptCount = 0;
                  let selectedIndex = currentIndex;

                  // Try round-robin starting from current index
                  while (attemptCount < skilledTechnicians.length) {
                    const candidateTech = skilledTechnicians[selectedIndex];
                    const activeWorkload = await this.incidentRepository.count({
                      where: {
                        handler: candidateTech.serviceNum,
                        status: In([IncidentStatus.OPEN, IncidentStatus.HOLD, IncidentStatus.IN_PROGRESS])
                      },
                    });

                    // Check if this technician has capacity
                    if (activeWorkload < 3) {
                      assignedTechnician = candidateTech;
                      // Update round-robin index for next assignment
                      const nextIndex = (selectedIndex + 1) % skilledTechnicians.length;
                      this.teamAssignmentIndex.set(teamKey, nextIndex);
                      this.logger.log(`[CATEGORY-CHANGE-SKILL] Round-robin assigned to skilled technician ${candidateTech.serviceNum} with workload ${activeWorkload}/3 (index: ${selectedIndex})`);
                      break;
                    }

                    // Move to next technician in round-robin
                    selectedIndex = (selectedIndex + 1) % skilledTechnicians.length;
                    attemptCount++;
                  }

                  if (!assignedTechnician) {
                    this.logger.log(`[CATEGORY-CHANGE-SKILL] All ${skilledTechnicians.length} skilled technicians for sub-category '${subCategoryName}' are at max capacity (3 incidents each)`);
                  }
                }
              } else {
                this.logger.log(`[CATEGORY-CHANGE-SKILL] No skilled technicians found for sub-category '${subCategoryName}' in team '${team}'`);
              }

              if (assignedTechnician) break;
            }
          }
          if (assignedTechnician) break;
        }

        if (!assignedTechnician) {
          // No active technician found - set incident to pending assignment status
          console.log(`[IncidentService] No active Tier1 technician found for team associated with new category '${incidentDto.category}'. Setting incident to pending assignment.`);
          incidentDto.handler = null; // Clear handler since no one is assigned
          incidentDto.status = IncidentStatus.PENDING_ASSIGNMENT; // Set to pending status
          incidentDto.automaticallyAssignForTier2 = false;
          incidentDto.assignForTeamAdmin = false;

          this.logger.log(`[CATEGORY-CHANGE-PENDING] Incident ${incident_number} set to pending assignment due to category change to '${incidentDto.category}' - no active technicians available`);
        } else {
          // Track the reassigned technician for socket events
          reassignedTechnician = assignedTechnician;

          incidentDto.handler = assignedTechnician.serviceNum;
          incidentDto.automaticallyAssignForTier2 = false;
          incidentDto.assignForTeamAdmin = false;
        }
      }

      // --- Auto-assign Tier2 technician if requested ---
      if (incidentDto.automaticallyAssignForTier2) {
        console.log('🔍 Starting Tier2 assignment process...');

        // Find CategoryItem by name (category)
        const categoryItem = await this.categoryItemRepository.findOne({
          where: { name: incidentDto.category || incident.category },
          relations: ['subCategory', 'subCategory.mainCategory'],
        });

        if (!categoryItem) {
          throw new BadRequestException(
            `Category '${incidentDto.category || incident.category}' not found`,
          );
        }

        const mainCategoryId = categoryItem.subCategory?.mainCategory?.id;
        const teamName = categoryItem.subCategory?.mainCategory?.name;

        // Try to assign to active Tier2 technician
        const tier2Result = await this.tryAssignToTier2Technician(
          mainCategoryId,
          teamName,
          incident.category
        );

        if (tier2Result.success && tier2Result.technician) {
          // Successfully assigned to active Tier2 technician
          tier2Tech = tier2Result.technician;
          incidentDto.handler = tier2Tech.serviceNum;
          console.log(`🎯 Successfully assigned to active Tier2 technician: ${tier2Tech.serviceNum}`);
        } else {
          // No active Tier2 technician available - add to pending queue
          console.log('📋 No active Tier2 technician found. Adding to PENDING_TIER2_ASSIGNMENT queue...');
          incidentDto.status = IncidentStatus.PENDING_TIER2_ASSIGNMENT;
          incidentDto.handler = null; // Clear handler since no one is assigned yet

          this.logger.log(`[TIER2-PENDING] Incident ${incident_number} added to Tier2 pending queue for team '${mainCategoryId || teamName}'`);
        }
      }

      // $$$$$$$$$$$$--- Auto-assign Team Admin if requested ---(this is the block causing admin behaviour)
      if (incidentDto.assignForTeamAdmin) {


        const currentHandler = incident.handler;
        if (!currentHandler) {
          throw new BadRequestException(
            'Cannot assign to a team admin because the incident has no current handler.',
          );
        }

        // Find the current technician to get their team information
        const currentTechnician = await this.technicianRepository.findOne({
          where: { serviceNum: currentHandler, active: true },
        });

        if (!currentTechnician) {
          throw new BadRequestException(
            `Current technician with serviceNum ${incident.handler} not found or not active`,
          );
        }



        // Find team admin for the technician's team using both team and teamId fields
        const teamIdentifiers = [
          currentTechnician.team,
          currentTechnician.teamId,
        ].filter(Boolean);



        let teamAdminTemp: TeamAdmin | null = null;

        for (const teamIdentifier of teamIdentifiers) {


          teamAdminTemp = await this.teamAdminRepository.findOne({
            where: [
              { teamId: teamIdentifier, active: true },
              { teamName: teamIdentifier, active: true },
            ],
          });

          if (teamAdminTemp) {

            break;
          }
        }

        if (!teamAdminTemp) {
          // Let's also check what team admins exist for debugging
          const allTeamAdmins = await this.teamAdminRepository.find({
            where: { active: true },
          });


          throw new BadRequestException(
            `No active team admin found for technician's team (${teamIdentifiers.join(', ')}). Available team admins: ${allTeamAdmins.map(ta => `${ta.serviceNumber} (team: ${ta.teamName})`).join(', ')}`,
          );
        }

        // Assign to the method-level variable for socket events
        teamAdmin = teamAdminTemp;

        // Assign the incident to the team admin
        incidentDto.handler = teamAdmin.serviceNumber;

      }

      // --- Manual Handler Assignment Validation ---
      // Check if admin is manually assigning to a different handler (not through automatic assignment)
      const isManualHandlerAssignment = incidentDto.handler &&
        incidentDto.handler !== originalHandler &&
        !incidentDto.automaticallyAssignForTier2 &&
        !incidentDto.assignForTeamAdmin &&
        !categoryChanged; // Not a category-based reassignment

      if (isManualHandlerAssignment) {
        this.logger.log(`[MANUAL-ASSIGNMENT] Admin is manually assigning incident ${incident_number} to handler ${incidentDto.handler}`);

        // Ensure handler is not null/undefined
        if (!incidentDto.handler) {
          throw new BadRequestException('Handler is required for manual assignment');
        }

        // Get the technician being assigned to
        const targetTechnician = await this.technicianRepository.findOne({
          where: { serviceNum: incidentDto.handler, active: true },
        });

        if (!targetTechnician) {
          throw new BadRequestException(
            `Target technician ${incidentDto.handler} not found or not active`
          );
        }

        // Check if the technician is skilled for the incident's category/sub-category
        const currentCategory = incidentDto.category || incident.category;
        const tempIncident = { category: currentCategory } as Incident;

        const isSkilled = await this.isTechnicianSkilledForIncident(targetTechnician, tempIncident);

        if (!isSkilled) {
          // Get category hierarchy for error message
          const categoryItem = await this.categoryItemRepository.findOne({
            where: { name: currentCategory },
            relations: ['subCategory', 'subCategory.mainCategory'],
          });

          const subCategoryName = categoryItem?.subCategory?.name || 'Unknown';
          const mainCategoryName = categoryItem?.subCategory?.mainCategory?.name || 'Unknown';

          this.logger.warn(`[MANUAL-ASSIGNMENT] Technician ${incidentDto.handler} is not skilled for category '${currentCategory}' (sub-category: ${subCategoryName})`);

          throw new BadRequestException(
            `Technician ${targetTechnician.name} (${incidentDto.handler}) is not skilled to handle incidents in sub-category '${subCategoryName}' (Category: ${currentCategory}, Team: ${mainCategoryName}). Please assign to a technician with appropriate skills.`
          );
        }

        // Check workload capacity
        const activeWorkload = await this.incidentRepository.count({
          where: {
            handler: targetTechnician.serviceNum,
            status: In([IncidentStatus.OPEN, IncidentStatus.HOLD, IncidentStatus.IN_PROGRESS])
          },
        });

        if (activeWorkload >= 3) {
          this.logger.warn(`[MANUAL-ASSIGNMENT] Technician ${incidentDto.handler} is at max capacity (${activeWorkload}/3)`);

          throw new BadRequestException(
            `Technician ${targetTechnician.name} (${incidentDto.handler}) is already at maximum capacity (${activeWorkload}/3 active incidents). Please assign to a technician with available capacity.`
          );
        }

        this.logger.log(`[MANUAL-ASSIGNMENT] Validation passed - Technician ${targetTechnician.serviceNum} is skilled and has capacity (${activeWorkload}/3)`);
      }

      // Get display names for incident history
      const handlerIdentifier = incidentDto.handler || incident.handler;
      const assignedToDisplayName = handlerIdentifier
        ? await this.getDisplayNameByServiceNum(handlerIdentifier)
        : incidentDto.status === IncidentStatus.PENDING_TIER2_ASSIGNMENT
          ? 'Pending Tier2 Assignment'
          : incidentDto.status === IncidentStatus.PENDING_ASSIGNMENT
            ? 'Pending Assignment'
            : 'N/A';
      const updatedByDisplayName = await this.getDisplayNameByServiceNum(incidentDto.update_by || incident.update_by);

      // --- IncidentHistory entry ---
      const history = new IncidentHistory();
      history.incidentNumber = incident_number;
      history.status = incidentDto.status || incident.status;
      history.assignedTo = assignedToDisplayName;
      history.updatedBy = updatedByDisplayName;
      history.comments = incidentDto.status === IncidentStatus.PENDING_TIER2_ASSIGNMENT
        ? 'Incident moved to Tier2 pending queue - no active Tier2 technicians available'
        : incidentDto.status === IncidentStatus.PENDING_ASSIGNMENT
          ? 'Incident moved to pending queue - no active technicians available for the new category'
          : incidentDto.description || incident.description || '';
      history.category = incidentDto.category || incident.category;
      history.location = incidentDto.location || incident.location;
      history.attachment = incidentDto.attachmentFilename || '';
      history.attachmentOriginalName = incidentDto.attachmentOriginalName || '';
      await this.incidentHistoryRepository.save(history);
      // --- End IncidentHistory entry ---

      // Update the incident
      Object.assign(incident, incidentDto);
      const updatedIncident = await this.incidentRepository.save(incident);

      // --- EMIT SOCKET EVENTS FOR TRANSFERS ---
      // Check if this was a Tier2 transfer, team admin assignment, category-based reassignment, or manual reassignment
      if (incidentDto.automaticallyAssignForTier2 && tier2Tech) {
        // This was a Tier2 transfer
        this.emitIncidentSocketEvents(updatedIncident, 'transferred');
        this.logger.log(`[SOCKET] Emitted transfer event for incident ${updatedIncident.incident_number} to Tier2 technician ${tier2Tech.serviceNum}`);
      } else if (incidentDto.assignForTeamAdmin && teamAdmin) {
        // This was a team admin assignment
        this.emitIncidentSocketEvents(updatedIncident, 'transferred');
        this.logger.log(`[SOCKET] Emitted transfer event for incident ${updatedIncident.incident_number} to team admin ${teamAdmin.serviceNumber}`);
      } else if (reassignedTechnician) {
        // This was a category-based reassignment to a different team technician
        this.emitIncidentSocketEvents(updatedIncident, 'transferred');
        this.logger.log(`[SOCKET] Emitted reassignment event for incident ${updatedIncident.incident_number} to technician ${reassignedTechnician.serviceNum} due to category change`);
      } else if (incidentDto.handler && incidentDto.handler !== originalHandler) {
        // This was a manual handler reassignment (e.g., team admin reassigning to another technician)
        this.emitIncidentSocketEvents(updatedIncident, 'transferred');
        this.logger.log(`[SOCKET] Emitted manual reassignment event for incident ${updatedIncident.incident_number} from ${originalHandler} to ${incidentDto.handler}`);
      }

      // --- EMIT SOCKET EVENT FOR INCIDENT CLOSURE ---
      if (isClosingIncident) {
        this.emitIncidentSocketEvents(updatedIncident, 'closed');
        this.logger.log(`[SOCKET] Emitted closure event for incident ${updatedIncident.incident_number}`);
      }

      // --- TRIGGER AUTO-ASSIGNMENT AFTER UPDATE ---
      // Only trigger if this was a closing or transfer operation
      if (isClosingIncident || isTransferOperation) {
        const technicianServiceNum = originalHandler; // Use the original handler who closed/transferred

        if (technicianServiceNum) {
          this.logger.log(`[AUTO-ASSIGNMENT] Triggering assignment for technician ${technicianServiceNum} after ${isClosingIncident ? 'closing' : 'transferring'} incident ${incident_number}`);

          // Trigger assignment in background (don't wait for it)
          setImmediate(() => {
            this.tryAssignNewIncidentToTechnician(technicianServiceNum, isClosingIncident ? 'CLOSED' : 'TRANSFERRED')
              .catch(error => {
                this.logger.error(`[AUTO-ASSIGNMENT] Failed to assign new incident to ${technicianServiceNum}: ${error.message}`);
              });
          });

          // Also trigger Tier2 pending assignment check
          setImmediate(() => {
            this.tryAssignPendingTier2Incidents()
              .catch(error => {
                this.logger.error(`[TIER2-AUTO-ASSIGNMENT] Failed to assign pending Tier2 incidents: ${error.message}`);
              });
          });
        }
      }

      return updatedIncident;
    } catch (error) {
      console.error(`[IncidentService] Error updating incident ${incident_number}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Failed to update incident: ' + message,
      );
    }
  }

  async getIncidentByNumber(incident_number: string): Promise<Incident> {
    try {
      const incident = await this.incidentRepository.findOne({
        where: { incident_number },
      });
      if (!incident) {
        throw new NotFoundException(
          `Incident with incident_number ${incident_number} not found`,
        );
      }
      return incident;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Failed to retrieve incident: ' + message,
      );
    }
  }

  async getDashboardStats(params?: {
    userType?: string;
    technicianServiceNum?: string;
    teamName?: string;
    adminServiceNum?: string;
  }): Promise<any> {
    try {
      const incidents = await this.incidentRepository.find();

      const { userType, technicianServiceNum, adminServiceNum } = params || {};

      let filteredIncidents = incidents;

      // Handle technician filtering - use getAssignedToMe method
      if (userType?.toLowerCase() === 'technician' && technicianServiceNum) {
        filteredIncidents = await this.getAssignedToMe(technicianServiceNum);
      }

      // Handle admin filtering - filter incidents by admin's assigned team (main category)
      if (userType?.toLowerCase() === 'admin' && adminServiceNum) {
        // Find the admin's team information from TeamAdmin table
        const teamAdmin = await this.teamAdminRepository.findOne({
          where: { serviceNumber: adminServiceNum }
        });

        if (teamAdmin && teamAdmin.teamId) {
          // Use the teamId directly as it contains the main category code
          filteredIncidents = await this.getIncidentsByMainCategoryCode(teamAdmin.teamId);
          this.logger.log(`[ADMIN-DASHBOARD] Filtered ${filteredIncidents.length} incidents for admin ${adminServiceNum} (team: ${teamAdmin.teamName}, code: ${teamAdmin.teamId})`);
        } else {
          this.logger.warn(`[ADMIN-DASHBOARD] No team admin found for service number: ${adminServiceNum}`);
          filteredIncidents = []; // No incidents if admin not found
        }
      }


      const today = new Date().toISOString().split('T')[0];

      // Helper function to check if an incident's update_on matches today
      const isTodayIncident = (incident: Incident) => {
        if (!incident.update_on) return false;

        // Handle different date formats
        let incidentDate: string = incident.update_on;
        if (typeof incidentDate === 'string') {
          // If it contains timestamp, extract date part
          if (incidentDate.includes('T')) {
            incidentDate = incidentDate.split('T')[0];
          }
        }

        return incidentDate === today;
      };



      const statusCounts = {
        'Open': filteredIncidents.filter(inc => inc.status === 'Open').length,
        'Hold': filteredIncidents.filter(inc => inc.status === 'Hold').length,
        'In Progress': filteredIncidents.filter(inc => inc.status === 'In Progress').length,
        'Closed': filteredIncidents.filter(inc => inc.status === 'Closed').length,
        'Pending Assignment': filteredIncidents.filter(inc => inc.status === 'Pending Assignment').length,
      };

      const priorityCounts = {
        'Medium': filteredIncidents.filter(inc => inc.priority === 'Medium').length,
        'High': filteredIncidents.filter(inc => inc.priority === 'High').length,
        'Critical': filteredIncidents.filter(inc => inc.priority === 'Critical').length,
      };

      const todayStats = {
        'Open (Today)': filteredIncidents.filter(inc => inc.status === 'Open' && isTodayIncident(inc)).length,
        'Hold (Today)': filteredIncidents.filter(inc => inc.status === 'Hold' && isTodayIncident(inc)).length,
        'In Progress (Today)': filteredIncidents.filter(inc => inc.status === 'In Progress' && isTodayIncident(inc)).length,
        'Closed (Today)': filteredIncidents.filter(inc => inc.status === 'Closed' && isTodayIncident(inc)).length,
        'Pending Assignment (Today)': filteredIncidents.filter(inc => inc.status === 'Pending Assignment' && isTodayIncident(inc)).length,
      };

      // Also include overall counts for comparison
      const overallStatusCounts = {
        'Open': incidents.filter(inc => inc.status === 'Open').length,
        'Hold': incidents.filter(inc => inc.status === 'Hold').length,
        'In Progress': incidents.filter(inc => inc.status === 'In Progress').length,
        'Closed': incidents.filter(inc => inc.status === 'Closed').length,
        'Pending Assignment': incidents.filter(inc => inc.status === 'Pending Assignment').length,
        'Open (Today)': incidents.filter(inc => inc.status === 'Open' && isTodayIncident(inc)).length,
        'Hold (Today)': incidents.filter(inc => inc.status === 'Hold' && isTodayIncident(inc)).length,
        'In Progress (Today)': incidents.filter(inc => inc.status === 'In Progress' && isTodayIncident(inc)).length,
        'Closed (Today)': incidents.filter(inc => inc.status === 'Closed' && isTodayIncident(inc)).length,
        'Pending Assignment (Today)': incidents.filter(inc => inc.status === 'Pending Assignment' && isTodayIncident(inc)).length,
      };

      return {
        statusCounts,
        priorityCounts,
        todayStats,
        overallStatusCounts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Failed to retrieve dashboard stats: ' + message,
      );
    }
  }


  async getIncidentHistory(
    incident_number: string,
  ): Promise<IncidentHistory[]> {
    return await this.incidentHistoryRepository.find({
      where: { incidentNumber: incident_number },
      order: { updatedOn: 'ASC' },
    });
  }



  // ------------------- SCHEDULER FOR PENDING ASSIGNMENTS ------------------- //


  @Cron(CronExpression.EVERY_30_SECONDS) // Daily at midnight (00:00)
  async handlePendingAssignments(): Promise<number> {
    this.logger.log('Running daily scheduled task to assign pending incidents...');

    // Handle regular pending assignments
    const pendingIncidents = await this.incidentRepository.find({
      where: { status: IncidentStatus.PENDING_ASSIGNMENT },
      order: { update_on: 'ASC' }, // Process oldest first
    });

    // Handle Tier2 pending assignments
    const pendingTier2Incidents = await this.incidentRepository.find({
      where: { status: IncidentStatus.PENDING_TIER2_ASSIGNMENT },
      order: { update_on: 'ASC' }, // Process oldest first
    });

    const totalPending = pendingIncidents.length + pendingTier2Incidents.length;

    if (totalPending === 0) {
      this.logger.log('No pending incidents to assign.');
      return 0;
    }

    this.logger.log(`Found ${pendingIncidents.length} regular pending incidents and ${pendingTier2Incidents.length} Tier2 pending incidents.`);
    let assignmentsCount = 0;

    // Process regular pending incidents
    for (const incident of pendingIncidents) {
      try {
        const assigned = await this.assignPendingIncident(incident);
        if (assigned) {
          assignmentsCount++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to process incident ${incident.incident_number}: ${error.message}`,
          error.stack,
        );
      }
    }

    // Process Tier2 pending incidents
    for (const incident of pendingTier2Incidents) {
      try {
        const assigned = await this.assignPendingTier2Incident(incident);
        if (assigned) {
          assignmentsCount++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to process Tier2 incident ${incident.incident_number}: ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.log(
      `Completed assignment task. Assigned ${assignmentsCount} incidents. ${totalPending - assignmentsCount} still pending.`,
    );
    return assignmentsCount;
  }

  private async assignPendingIncident(incident: Incident): Promise<boolean> {
    const categoryItem = await this.categoryItemRepository.findOne({
      where: { name: incident.category },
      relations: ['subCategory', 'subCategory.mainCategory'],
    });

    if (!categoryItem?.subCategory?.mainCategory) {
      this.logger.warn(
        `Could not find team for category '${incident.category}' on incident ${incident.incident_number}. Skipping.`,
      );
      return false;
    }

    const teamId = categoryItem.subCategory.mainCategory.id;
    const teamName = categoryItem.subCategory.mainCategory.name;

    const subCategoryName = categoryItem.subCategory?.name;
    if (!subCategoryName) {
      this.logger.warn(
        `Could not find sub-category name for category '${incident.category}' on incident ${incident.incident_number}. Skipping.`,
      );
      return false;
    }

    const availableTechnicians = await this.technicianRepository.find({
      where: { team: In([teamId, teamName]), tier: In(['Tier1', 'tier1']), active: true },
      order: { id: 'ASC' },
    });

    if (availableTechnicians.length === 0) {
      this.logger.log(
        `No active Tier1 technicians found for team '${teamName}' (ID: ${teamId}) for incident ${incident.incident_number}.`,
      );
      return false;
    }

    // Filter technicians based on sub-category skills first
    const skilledTechnicians: Technician[] = [];

    this.logger.log(`[PENDING-SKILL-CHECK] Checking skills for ${availableTechnicians.length} technicians for sub-category '${subCategoryName}' (incident: ${incident.incident_number})`);

    for (const tech of availableTechnicians) {
      const isSkilled = await this.isTechnicianSkilledForIncident(tech, incident);
      if (isSkilled) {
        skilledTechnicians.push(tech);
        this.logger.log(`[PENDING-SKILL-CHECK] Technician ${tech.serviceNum} is skilled for sub-category '${subCategoryName}'`);
      } else {
        this.logger.log(`[PENDING-SKILL-CHECK] Technician ${tech.serviceNum} is NOT skilled for sub-category '${subCategoryName}'`);
      }
    }

    this.logger.log(`[PENDING-SKILL-CHECK] Found ${skilledTechnicians.length} skilled technicians out of ${availableTechnicians.length} available for sub-category '${subCategoryName}'`);

    if (skilledTechnicians.length === 0) {
      this.logger.log(
        `No skilled technicians found for sub-category '${subCategoryName}' on incident ${incident.incident_number}. Incident remains pending.`,
      );
      return false;
    }

    // --- Enhanced Round-robin load balancing with workload consideration on skilled technicians ---
    let selectedTechnician: Technician | null = null;
    const teamKey = `${teamId}_Tier1_${subCategoryName}_pending`; // Unique key for pending assignments

    if (skilledTechnicians.length === 1) {
      // Single skilled technician - check workload only
      const singleTech = skilledTechnicians[0];
      const activeWorkload = await this.incidentRepository.count({
        where: {
          handler: singleTech.serviceNum,
          status: In([IncidentStatus.OPEN, IncidentStatus.HOLD, IncidentStatus.IN_PROGRESS])
        },
      });

      if (activeWorkload < 3) {
        selectedTechnician = singleTech;
        this.logger.log(`[PENDING-ASSIGNMENT] Single skilled technician ${singleTech.serviceNum} available with workload ${activeWorkload}/3`);
      } else {
        this.logger.log(`[PENDING-ASSIGNMENT] Single skilled technician ${singleTech.serviceNum} at max capacity (${activeWorkload}/3)`);
      }
    } else {
      // Multiple skilled technicians - use round-robin with workload filtering
      const currentIndex = this.teamAssignmentIndex.get(teamKey) || 0;
      let attemptCount = 0;
      let selectedIndex = currentIndex;

      // Try round-robin starting from current index
      while (attemptCount < skilledTechnicians.length) {
        const candidateTech = skilledTechnicians[selectedIndex];
        const activeWorkload = await this.incidentRepository.count({
          where: {
            handler: candidateTech.serviceNum,
            status: In([IncidentStatus.OPEN, IncidentStatus.HOLD, IncidentStatus.IN_PROGRESS])
          },
        });

        // Check if this technician has capacity
        if (activeWorkload < 3) {
          selectedTechnician = candidateTech;
          // Update round-robin index for next assignment
          const nextIndex = (selectedIndex + 1) % skilledTechnicians.length;
          this.teamAssignmentIndex.set(teamKey, nextIndex);
          this.logger.log(`[PENDING-ASSIGNMENT] Round-robin assigned to skilled technician ${candidateTech.serviceNum} with workload ${activeWorkload}/3 (index: ${selectedIndex})`);
          break;
        }

        // Move to next technician in round-robin
        selectedIndex = (selectedIndex + 1) % skilledTechnicians.length;
        attemptCount++;
      }

      if (!selectedTechnician) {
        this.logger.log(`[PENDING-ASSIGNMENT] All ${skilledTechnicians.length} skilled technicians for sub-category '${subCategoryName}' are at max capacity (3 incidents each)`);
      }
    }

    if (!selectedTechnician) {
      this.logger.log(
        `All skilled technicians for sub-category '${subCategoryName}' in team '${teamName}' (ID: ${teamId}) have reached max active workload (3 incidents). Incident ${incident.incident_number} remains pending.`,
      );
      return false;
    }

    incident.handler = selectedTechnician.serviceNum;
    incident.status = IncidentStatus.OPEN;
    await this.incidentRepository.save(incident);

    await this.createIncidentHistory(incident, selectedTechnician.serviceNum, 'Incident automatically assigned by the system.');

    // Emit socket events for live updates
    this.emitIncidentSocketEvents(incident, 'assigned');

    this.logger.log(
      `Successfully assigned pending incident ${incident.incident_number} to skilled technician ${selectedTechnician.serviceNum} via sub-category based round-robin assignment.`,
    );

    return true;
  }

  /**
   * Checks if a technician is skilled for a given incident's sub-category.
   * Uses technician's cat1, cat2, cat3, cat4 fields to match against incident category.
   */
  private async isTechnicianSkilledForIncident(technician: Technician, incident: Incident): Promise<boolean> {
    try {
      // Get all technician's categories (from cat1, cat2, cat3, cat4 fields)
      const technicianCategories = [
        technician.cat1,
        technician.cat2,
        technician.cat3,
        technician.cat4
      ].filter(cat => cat && cat.trim() !== ''); // Remove null/empty categories

      if (technicianCategories.length === 0) {
        this.logger.log(`[SKILL-CHECK] Technician ${technician.serviceNum} has no categories assigned`);
        return false; // No skills assigned to technician
      }

      // Find the CategoryItem for the incident's category
      const categoryItem = await this.categoryItemRepository.findOne({
        where: { name: incident.category },
        relations: ['subCategory', 'subCategory.mainCategory'],
      });

      if (!categoryItem) {
        this.logger.warn(`[SKILL-CHECK] Category '${incident.category}' not found in database`);
        return false;
      }

      // Check if technician's categories match any of:
      // 1. The specific category item name
      // 2. The sub-category name  
      // 3. The main category name
      const categoryName = categoryItem.name;
      const subCategoryName = categoryItem.subCategory?.name;
      const mainCategoryName = categoryItem.subCategory?.mainCategory?.name;

      const matchableCategories = [categoryName, subCategoryName, mainCategoryName]
        .filter(cat => cat && cat.trim() !== '');

      // Check if any of technician's categories match the incident's category hierarchy
      const isSkilled = technicianCategories.some(techCat =>
        matchableCategories.some(incCat =>
          techCat.toLowerCase().trim() === incCat.toLowerCase().trim()
        )
      );

      this.logger.log(
        `[SKILL-CHECK] Technician ${technician.serviceNum} categories: [${technicianCategories.join(', ')}] ` +
        `vs Incident categories: [${matchableCategories.join(', ')}] = ${isSkilled ? 'MATCH' : 'NO MATCH'}`
      );

      return isSkilled;
    } catch (error) {
      this.logger.error(`[SKILL-CHECK] Error checking skills for technician ${technician.serviceNum}: ${error.message}`);
      return false; // On error, assume not skilled
    }
  }

  /**
   * Try to assign a new pending incident to a specific technician after they close/transfer an incident
   */
  private async tryAssignNewIncidentToTechnician(technicianServiceNum: string, action: string): Promise<void> {
    this.logger.log(`[AUTO-ASSIGNMENT] Attempting to assign new incident to technician ${technicianServiceNum} after ${action}`);

    // Check technician's current active workload
    const currentActiveWorkload = await this.incidentRepository.count({
      where: {
        handler: technicianServiceNum,
        status: In([IncidentStatus.OPEN, IncidentStatus.HOLD, IncidentStatus.IN_PROGRESS])
      },
    });

    this.logger.log(`[AUTO-ASSIGNMENT] Technician ${technicianServiceNum} current active workload: ${currentActiveWorkload}/3`);

    // Only assign if technician has capacity (less than 3 active incidents)
    if (currentActiveWorkload >= 3) {
      this.logger.log(`[AUTO-ASSIGNMENT] Technician ${technicianServiceNum} already at max capacity (${currentActiveWorkload}/3)`);
      return;
    }

    // Get technician details to find their team
    const technician = await this.technicianRepository.findOne({
      where: { serviceNum: technicianServiceNum, active: true },
    });

    if (!technician) {
      this.logger.warn(`[AUTO-ASSIGNMENT] Technician ${technicianServiceNum} not found or not active`);
      return;
    }

    // Find pending incidents for the same team/categories
    const pendingIncidents = await this.findPendingIncidentsForTechnician(technician);

    // Iterate through the team's pending incidents to find one that matches the technician's skills
    for (const incidentToAssign of pendingIncidents) {
      const isSkilled = await this.isTechnicianSkilledForIncident(technician, incidentToAssign);
      if (isSkilled) {
        this.logger.log(`[AUTO-ASSIGNMENT] Found skill-matched incident ${incidentToAssign.incident_number} for technician ${technician.serviceNum}.`);
        await this.assignIncidentToTechnician(incidentToAssign, technician, `Automatic assignment after ${action}`);
        return; // Exit after assigning the first suitable incident
      }
    }

    this.logger.log(`[AUTO-ASSIGNMENT] No skill-matched pending incidents found in the team queue for technician ${technicianServiceNum}.`);

    // Fallback logic from original code: try to find any pending incident (oldest first).
    // We will retain this but add the skill check.
    const anyPendingIncident = await this.incidentRepository.findOne({
      where: { status: IncidentStatus.PENDING_ASSIGNMENT },
      order: { update_on: 'ASC' }, // Oldest first
    });

    if (anyPendingIncident) {
      // We must ensure we don't try to re-assign an incident from the team queue that we already know isn't a skill match
      if (pendingIncidents.some(p => p.incident_number === anyPendingIncident.incident_number)) {
        this.logger.log(`[AUTO-ASSIGNMENT] Oldest pending incident is from the same team but not a skill match. Skipping.`);
        return;
      }

      const isSkilled = await this.isTechnicianSkilledForIncident(technician, anyPendingIncident);
      if (isSkilled) {
        this.logger.log(`[AUTO-ASSIGNMENT] Found general pending incident ${anyPendingIncident.incident_number} for cross-team assignment.`);
        await this.assignIncidentToTechnician(anyPendingIncident, technician, `Cross-team assignment after ${action}`);
      } else {
        this.logger.log(`[AUTO-ASSIGNMENT] Found a general pending incident, but technician is not skilled. Skipping.`);
      }
    }
  }

  /**
   * Find pending incidents that match the technician's team categories
   */
  private async findPendingIncidentsForTechnician(technician: Technician): Promise<Incident[]> {
    // Get all category items for technician's team
    const teamIdentifiers = [technician.team, technician.teamId].filter(Boolean);

    let categoryItems: CategoryItem[] = [];

    for (const teamId of teamIdentifiers) {
      const items = await this.categoryItemRepository
        .createQueryBuilder('categoryItem')
        .leftJoinAndSelect('categoryItem.subCategory', 'subCategory')
        .leftJoinAndSelect('subCategory.mainCategory', 'mainCategory')
        .where('mainCategory.id = :teamId OR mainCategory.name = :teamName', {
          teamId: teamId,
          teamName: teamId,
        })
        .getMany();

      categoryItems.push(...items);
    }

    // Remove duplicates
    categoryItems = categoryItems.filter((item, index, self) =>
      index === self.findIndex(i => i.name === item.name)
    );

    if (categoryItems.length === 0) {
      this.logger.warn(`[AUTO-ASSIGNMENT] No category items found for technician ${technician.serviceNum}'s team`);
      return [];
    }

    const categoryNames = categoryItems.map(item => item.name);
    const categoryCodes = categoryItems.map(item => item.category_code);

    this.logger.log(`[AUTO-ASSIGNMENT] Looking for pending incidents in categories: ${categoryNames.join(', ')}`);

    // Find pending incidents for these categories, prioritizing oldest first
    const pendingIncidents = await this.incidentRepository
      .createQueryBuilder('incident')
      .where('incident.status = :status', { status: IncidentStatus.PENDING_ASSIGNMENT })
      .andWhere('(incident.category IN (:...categoryNames) OR incident.category IN (:...categoryCodes))', {
        categoryNames,
        categoryCodes,
      })
      .orderBy('incident.update_on', 'ASC') // Oldest first for priority
      .getMany();

    this.logger.log(`[AUTO-ASSIGNMENT] Found ${pendingIncidents.length} pending incidents for technician's categories (ordered by update time)`);

    return pendingIncidents;
  }

  /**
   * Helper method to emit socket events for incident updates
   */
  private async emitIncidentSocketEvents(
    incident: Incident,
    eventType: 'created' | 'updated' | 'assigned' | 'transferred' | 'closed',
  ): Promise<void> {
    if (!io) return;

    const eventData = { incident };

    // Resolve display names where useful
    const technicianDisplayName = incident.handler
      ? await this.getDisplayNameByServiceNum(incident.handler)
      : null;

    try {
      if (eventType === 'created') {
        io.emit('incident_created', eventData);

        if (incident.handler) {
          io.to(`user_${incident.handler}`).emit('incident_assigned_technician', {
            ...eventData,
            message: `You have been assigned incident ${incident.incident_number}`,
          });
        }

        if (incident.informant && incident.handler) {
          const informantMsg = `Your incident ${incident.incident_number} has been assigned to ${technicianDisplayName || incident.handler
            }`;
          // Persist notification for informant and emit the saved notification object
          try {
            const savedInformantNotif = await this.notificationsService.createNotification({
              recipientServiceNumber: incident.informant,
              message: informantMsg,
              incidentNumber: incident.incident_number,
              actorName: technicianDisplayName ?? null,
              actorServiceNum: incident.handler ?? null,
            });
            io.to(`user_${incident.informant}`).emit('incident_assigned_informant', {
              ...eventData,
              message: informantMsg,
              notification: savedInformantNotif,
            });
          } catch (e) {
            // still emit even if persist failed
            io.to(`user_${incident.informant}`).emit('incident_assigned_informant', {
              ...eventData,
              message: informantMsg,
            });
          }
        }

        if (incident.handler) {
          const techMsg = `You have been assigned incident ${incident.incident_number}`;
          try {
            const savedTechNotif = await this.notificationsService.createNotification({
              recipientServiceNumber: incident.handler,
              message: techMsg,
              incidentNumber: incident.incident_number,
              actorName: null,
              actorServiceNum: incident.handler ?? null,
            });
            io.to(`user_${incident.handler}`).emit('incident_assigned_technician', {
              ...eventData,
              message: techMsg,
              notification: savedTechNotif,
            });
          } catch (e) {
            // fallback emit without saved object
            io.to(`user_${incident.handler}`).emit('incident_assigned_technician', {
              ...eventData,
              message: techMsg,
            });
          }
        }
      } else if (eventType === 'updated') {
        io.emit('incident_updated', eventData);
        if (incident.handler) {
          io.to(`user_${incident.handler}`).emit('incident_updated_assigned', {
            ...eventData,
            message: `Incident ${incident.incident_number} has been updated`,
          });
        }
      } else if (eventType === 'assigned') {
        io.emit('incident_updated', eventData);

        if (incident.handler) {
          const techMsg = `You have been assigned incident ${incident.incident_number}`;
          try {
            const savedTechNotif = await this.notificationsService.createNotification({
              recipientServiceNumber: incident.handler,
              message: techMsg,
              incidentNumber: incident.incident_number,
              actorName: null,
              actorServiceNum: incident.handler ?? null,
            });
            io.to(`user_${incident.handler}`).emit('incident_assigned_technician', {
              ...eventData,
              message: techMsg,
              notification: savedTechNotif,
            });
          } catch (e) {
            io.to(`user_${incident.handler}`).emit('incident_assigned_technician', {
              ...eventData,
              message: `You have been assigned incident ${incident.incident_number}`,
            });
          }
        }

        if (incident.informant) {
          const informantMsg = `Your incident ${incident.incident_number} has been assigned to ${technicianDisplayName || incident.handler || 'TBD'
            }`;
          try {
            const savedInformantNotif = await this.notificationsService.createNotification({
              recipientServiceNumber: incident.informant,
              message: informantMsg,
              incidentNumber: incident.incident_number,
              actorName: technicianDisplayName ?? null,
              actorServiceNum: incident.handler ?? null,
            });
            io.to(`user_${incident.informant}`).emit('incident_assigned_informant', {
              ...eventData,
              message: informantMsg,
              notification: savedInformantNotif,
            });
          } catch (e) {
            io.to(`user_${incident.informant}`).emit('incident_assigned_informant', {
              ...eventData,
              message: informantMsg,
            });
          }
        }
      } else if (eventType === 'transferred') {
        io.emit('incident_updated', eventData);
        if (incident.handler) {
          const transferMsg = `Incident ${incident.incident_number} has been transferred to you`;
          io.to(`user_${incident.handler}`).emit('incident_assigned_technician', {
            ...eventData,
            message: transferMsg,
          });
          try {
            const savedTransferNotif = await this.notificationsService.createNotification({
              recipientServiceNumber: incident.handler,
              message: transferMsg,
              incidentNumber: incident.incident_number,
              actorName: null,
              actorServiceNum: incident.handler ?? null,
            });
            io.to(`user_${incident.handler}`).emit('incident_assigned_technician', {
              ...eventData,
              message: transferMsg,
              notification: savedTransferNotif,
            });
          } catch (e) {
            io.to(`user_${incident.handler}`).emit('incident_assigned_technician', {
              ...eventData,
              message: transferMsg,
            });
          }
        }
      } else if (eventType === 'closed') {
        io.emit('incident_updated', eventData);

        if (incident.informant) {
          const closedMsg = `Your incident ${incident.incident_number} has been closed by the technician`;
          io.to(`user_${incident.informant}`).emit('incident_closed_notification', {
            ...eventData,
            message: closedMsg,
          });
          try {
            const savedClosedNotif = await this.notificationsService.createNotification({
              recipientServiceNumber: incident.informant,
              message: closedMsg,
              incidentNumber: incident.incident_number,
              actorName: technicianDisplayName ?? null,
              actorServiceNum: incident.handler ?? null,
            });
            io.to(`user_${incident.informant}`).emit('incident_closed_notification', {
              ...eventData,
              message: closedMsg,
              notification: savedClosedNotif,
            });
          } catch (e) {
            io.to(`user_${incident.informant}`).emit('incident_closed_notification', {
              ...eventData,
              message: closedMsg,
            });
          }
        }

        io.emit('incident_closed_admin_notification', {
          ...eventData,
          message: `Incident ${incident.incident_number} has been closed by technician ${technicianDisplayName || incident.handler
            }`,
        });
      }
    } catch (err) {
      this.logger.error(`[SOCKET] emitIncidentSocketEvents failed: ${err?.message || err}`);
    }
  }

  /**
   * Assign a specific incident to a specific technician
   */
  private async assignIncidentToTechnician(incident: Incident, technician: Technician, comment: string): Promise<void> {
    incident.handler = technician.serviceNum;
    incident.status = IncidentStatus.OPEN;
    await this.incidentRepository.save(incident);

    await this.createIncidentHistory(incident, technician.serviceNum, comment);

    // Emit socket events for live updates
    this.emitIncidentSocketEvents(incident, 'assigned');

    this.logger.log(`[AUTO-ASSIGNMENT] Successfully assigned incident ${incident.incident_number} to technician ${technician.serviceNum}`);
  }

  /**
   * Enhanced technician selection with workload consideration
   */
  private async selectBestTechnician(availableTechnicians: Technician[]): Promise<Technician | null> {
    let selectedTechnician: Technician | null = null;
    let minWorkload = Number.MAX_SAFE_INTEGER;

    for (const tech of availableTechnicians) {
      const activeWorkload = await this.incidentRepository.count({
        where: {
          handler: tech.serviceNum,
          status: In([IncidentStatus.OPEN, IncidentStatus.HOLD, IncidentStatus.IN_PROGRESS])
        },
      });

      // Only consider technicians with less than 3 active incidents
      if (activeWorkload < 3 && activeWorkload < minWorkload) {
        minWorkload = activeWorkload;
        selectedTechnician = tech;
      }
    }

    return selectedTechnician;
  }

  /**
   * Helper method to create incident history entries
   */
  private async createIncidentHistory(incident: Incident, assignedTo: string, comment: string): Promise<void> {
    const assignedToDisplayName = await this.getDisplayNameByServiceNum(assignedTo);

    const history = new IncidentHistory();
    history.incidentNumber = incident.incident_number;
    history.status = incident.status;
    history.assignedTo = assignedToDisplayName;
    history.updatedBy = 'System';
    history.comments = comment;
    history.category = incident.category;
    history.location = incident.location;
    await this.incidentHistoryRepository.save(history);
  }

  // ------------------- TIER2 ASSIGNMENT METHODS ------------------- //

  /**
   * Try to assign incident to an active Tier2 technician
   */
  private async tryAssignToTier2Technician(
    mainCategoryId: any,
    teamName: string,
    category: string
  ): Promise<{ success: boolean; technician?: Technician; message?: string }> {
    let tier2Tech: Technician | null = null;
    const tierVariants = ['Tier2', 'tier2'];
    const candidates: Technician[] = [];

    // Search by different combinations of team identifiers
    const teamIdentifiers = [
      mainCategoryId?.toString(),
      mainCategoryId,
      teamName,
      teamName?.toString(),
    ].filter(Boolean);

    for (const team of teamIdentifiers) {
      for (const tier of tierVariants) {
        if (!team) continue;

        // Try matching both team and teamId fields
        const foundByTeam = await this.technicianRepository.find({
          where: { team: team, tier: tier, active: true },
        });

        const foundByTeamId = await this.technicianRepository.find({
          where: { teamId: team, tier: tier, active: true },
        });

        // Combine results and remove duplicates
        const allFound = [...foundByTeam, ...foundByTeamId];
        const uniqueFound = allFound.filter((tech, index, self) =>
          index === self.findIndex(t => t.serviceNum === tech.serviceNum)
        );

        if (uniqueFound.length > 0) {
          candidates.push(...uniqueFound);
        }
      }
    }

    // Remove duplicates from final candidates array
    const uniqueCandidates = candidates.filter((tech, index, self) =>
      index === self.findIndex(t => t.serviceNum === tech.serviceNum)
    );

    if (uniqueCandidates.length === 0) {
      return {
        success: false,
        message: `No active Tier2 technician found for team '${mainCategoryId || teamName}' (category: ${category})`
      };
    }

    // Filter candidates based on skills for the incident category
    const skilledCandidates: Technician[] = [];

    // Create a temporary incident object to check skills
    const tempIncident = { category } as Incident;

    this.logger.log(`[SKILL-CHECK] Checking skills for ${uniqueCandidates.length} Tier2 candidates for category '${category}'`);

    for (const candidate of uniqueCandidates) {
      const isSkilled = await this.isTechnicianSkilledForIncident(candidate, tempIncident);
      if (isSkilled) {
        skilledCandidates.push(candidate);
        this.logger.log(`[SKILL-CHECK] Technician ${candidate.serviceNum} is skilled for category '${category}'`);
      } else {
        this.logger.log(`[SKILL-CHECK] Technician ${candidate.serviceNum} is NOT skilled for category '${category}'`);
      }
    }

    this.logger.log(`[SKILL-CHECK] Found ${skilledCandidates.length} skilled Tier2 technicians out of ${uniqueCandidates.length} candidates`);

    if (skilledCandidates.length === 0) {
      return {
        success: false,
        message: `No skilled Tier2 technician found for team '${mainCategoryId || teamName}' with category '${category}'`
      };
    }

    // Apply workload-based round-robin selection on skilled candidates
    const teamKey = `${mainCategoryId || teamName}_Tier2`;
    tier2Tech = await this.selectTier2TechnicianWithRoundRobin(skilledCandidates, teamKey);

    if (!tier2Tech) {
      return {
        success: false,
        message: `All skilled Tier2 technicians for team '${mainCategoryId || teamName}' are at max capacity (3 incidents each)`
      };
    }

    return { success: true, technician: tier2Tech };
  }

  /**
   * Select Tier2 technician using round-robin with workload consideration
   */
  private async selectTier2TechnicianWithRoundRobin(
    availableTechnicians: Technician[],
    teamKey: string
  ): Promise<Technician | null> {
    if (availableTechnicians.length === 1) {
      // Single technician - check workload only
      const singleTech = availableTechnicians[0];
      const activeWorkload = await this.incidentRepository.count({
        where: {
          handler: singleTech.serviceNum,
          status: In([IncidentStatus.OPEN, IncidentStatus.HOLD, IncidentStatus.IN_PROGRESS])
        },
      });

      if (activeWorkload < 3) {
        this.logger.log(`[TIER2-ASSIGNMENT] Single Tier2 technician ${singleTech.serviceNum} available with workload ${activeWorkload}/3`);
        return singleTech;
      } else {
        this.logger.log(`[TIER2-ASSIGNMENT] Single Tier2 technician ${singleTech.serviceNum} at max capacity (${activeWorkload}/3)`);
        return null;
      }
    }

    // Multiple technicians - use round-robin with workload filtering
    const currentIndex = this.tier2AssignmentIndex.get(teamKey) || 0;
    let attemptCount = 0;
    let selectedIndex = currentIndex;

    // Try round-robin starting from current index
    while (attemptCount < availableTechnicians.length) {
      const candidateTech = availableTechnicians[selectedIndex];
      const activeWorkload = await this.incidentRepository.count({
        where: {
          handler: candidateTech.serviceNum,
          status: In([IncidentStatus.OPEN, IncidentStatus.HOLD, IncidentStatus.IN_PROGRESS])
        },
      });

      // Check if this technician has capacity
      if (activeWorkload < 3) {
        // Update round-robin index for next assignment
        const nextIndex = (selectedIndex + 1) % availableTechnicians.length;
        this.tier2AssignmentIndex.set(teamKey, nextIndex);
        this.logger.log(`[TIER2-ASSIGNMENT] Round-robin assigned to Tier2 technician ${candidateTech.serviceNum} with workload ${activeWorkload}/3 (index: ${selectedIndex})`);
        return candidateTech;
      }

      // Move to next technician in round-robin
      selectedIndex = (selectedIndex + 1) % availableTechnicians.length;
      attemptCount++;
    }

    this.logger.log(`[TIER2-ASSIGNMENT] All ${availableTechnicians.length} Tier2 technicians are at max capacity (3 incidents each)`);
    return null;
  }

  /**
   * Try to assign pending Tier2 incidents when technicians become available
   */
  private async tryAssignPendingTier2Incidents(): Promise<void> {
    this.logger.log('[TIER2-PENDING] Checking for pending Tier2 incidents to assign...');

    const pendingTier2Incidents = await this.incidentRepository.find({
      where: { status: IncidentStatus.PENDING_TIER2_ASSIGNMENT },
      order: { update_on: 'ASC' }, // Oldest first
    });

    if (pendingTier2Incidents.length === 0) {
      this.logger.log('[TIER2-PENDING] No pending Tier2 incidents found.');
      return;
    }

    this.logger.log(`[TIER2-PENDING] Found ${pendingTier2Incidents.length} pending Tier2 incidents.`);
    let assignmentsCount = 0;

    for (const incident of pendingTier2Incidents) {
      try {
        const assigned = await this.assignPendingTier2Incident(incident);
        if (assigned) {
          assignmentsCount++;
        }
      } catch (error) {
        this.logger.error(
          `[TIER2-PENDING] Failed to process incident ${incident.incident_number}: ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.log(
      `[TIER2-PENDING] Completed assignment task. Assigned ${assignmentsCount} Tier2 incidents. ${pendingTier2Incidents.length - assignmentsCount} still pending.`,
    );
  }

  /**
   * Assign a specific pending Tier2 incident
   */
  private async assignPendingTier2Incident(incident: Incident): Promise<boolean> {
    const categoryItem = await this.categoryItemRepository.findOne({
      where: { name: incident.category },
      relations: ['subCategory', 'subCategory.mainCategory'],
    });

    if (!categoryItem?.subCategory?.mainCategory) {
      this.logger.warn(
        `[TIER2-PENDING] Could not find team for category '${incident.category}' on incident ${incident.incident_number}. Skipping.`,
      );
      return false;
    }

    const mainCategoryId = categoryItem.subCategory.mainCategory.id;
    const teamName = categoryItem.subCategory.mainCategory.name;

    // Try to assign to active Tier2 technician
    const tier2Result = await this.tryAssignToTier2Technician(
      mainCategoryId,
      teamName,
      incident.category
    );

    if (!tier2Result.success || !tier2Result.technician) {
      this.logger.log(
        `[TIER2-PENDING] ${tier2Result.message || 'No Tier2 technician available'} for incident ${incident.incident_number}.`,
      );
      return false;
    }

    // Assign the incident
    incident.handler = tier2Result.technician.serviceNum;
    incident.status = IncidentStatus.OPEN;
    await this.incidentRepository.save(incident);

    await this.createIncidentHistory(
      incident,
      tier2Result.technician.serviceNum,
      'Incident automatically assigned from Tier2 pending queue.'
    );

    // Emit socket events for live updates
    this.emitIncidentSocketEvents(incident, 'assigned');

    this.logger.log(
      `[TIER2-PENDING] Successfully assigned incident ${incident.incident_number} to Tier2 technician ${tier2Result.technician.serviceNum}.`,
    );

    return true;
  }

  async getIncidentsByMainCategoryCode(mainCategoryCode: string): Promise<Incident[]> {
    try {
      // First, find all category items that belong to the main category
      const categoryItems = await this.categoryItemRepository.find({
        relations: ['subCategory', 'subCategory.mainCategory'],
        where: {
          subCategory: {
            mainCategory: {
              category_code: mainCategoryCode
            }
          }
        }
      });

      if (categoryItems.length === 0) {
        throw new NotFoundException(
          `No category items found for main category code: ${mainCategoryCode}`
        );
      }

      // Extract category item names for filtering incidents
      const categoryItemNames = categoryItems.map(item => item.name);

      // Find all incidents that match these category names
      const incidents = await this.incidentRepository.find({
        where: categoryItemNames.map(categoryName => ({ category: categoryName })),
        order: { update_on: 'DESC' }
      });

      return incidents;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to retrieve incidents by main category code: ${message}`
      );
    }
  }

}

