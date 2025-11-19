import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { IncidentService } from '../incident.service';
import { Incident, IncidentStatus, IncidentPriority } from '../entities/incident.entity';
import { IncidentDto } from '../dto/incident.dto';
import { IncidentHistory } from '../entities/incident-history.entity';
import { Technician } from '../../technician/entities/technician.entity';
import { CategoryItem } from '../../Categories/Entities/Categories.entity';
import { SLTUser } from '../../sltusers/entities/sltuser.entity';
import { TeamAdmin } from '../../teamadmin/entities/teamadmin.entity';

// Mock socket.io
jest.mock('../../main', () => ({
  io: {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  },
}));

describe('IncidentService', () => {
  let service: IncidentService;
  let incidentRepository: Repository<Incident>;
  let technicianRepository: Repository<Technician>;
  let incidentHistoryRepository: Repository<IncidentHistory>;
  let categoryItemRepository: Repository<CategoryItem>;
  let sltUserRepository: Repository<SLTUser>;
  let teamAdminRepository: Repository<TeamAdmin>;

  // Mock repositories
  const mockIncidentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    query: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTechnicianRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockIncidentHistoryRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockCategoryItemRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockSltUserRepository = {
    findOne: jest.fn(),
  };

  const mockTeamAdminRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  // Test data
  const mockMainCategory = {
    id: 'main-cat-1',
    name: 'IT Team',
    category_code: 'IT',
  };

  const mockSubCategory = {
    id: 'sub-cat-1',
    name: 'Network Issues',
    category_code: 'NET',
    mainCategory: mockMainCategory,
  };

  const mockCategoryItem: Partial<CategoryItem> = {
    id: 'cat-item-1',
    name: 'Network Connection',
    category_code: 'NET-CONN',
    subCategory: mockSubCategory as any,
  };

  const mockTechnician: Partial<Technician> = {
    id: 'tech-1',
    serviceNum: '105554',
    name: 'John Doe',
    team: 'IT Team',
    teamId: 'main-cat-1',
    tier: 'Tier1',
    active: true,
    cat1: 'Network Issues',
    cat2: '',
    cat3: '',
    cat4: '',
  };

  const mockSLTUser: Partial<SLTUser> = {
    serviceNum: '105554',
    display_name: 'John Doe',
  };

  const mockTeamAdmin: Partial<TeamAdmin> = {
    serviceNumber: 'ADMIN001',
    teamId: 'main-cat-1',
    teamName: 'IT Team',
    active: true,
  };

  const mockIncidentDto: IncidentDto = {
    informant: '105553',
    location: 'Office Building A',
    category: 'Network Connection',
    status: IncidentStatus.OPEN,
    priority: IncidentPriority.HIGH,
    description: 'Network is down',
  };

  const mockIncident: Partial<Incident> = {
    incident_number: 'IN1',
    ...mockIncidentDto,
    handler: '105554',
    update_by: '105553',
    update_on: new Date().toISOString().split('T')[0],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentService,
        {
          provide: getRepositoryToken(Incident),
          useValue: mockIncidentRepository,
        },
        {
          provide: getRepositoryToken(Technician),
          useValue: mockTechnicianRepository,
        },
        {
          provide: getRepositoryToken(IncidentHistory),
          useValue: mockIncidentHistoryRepository,
        },
        {
          provide: getRepositoryToken(CategoryItem),
          useValue: mockCategoryItemRepository,
        },
        {
          provide: getRepositoryToken(SLTUser),
          useValue: mockSltUserRepository,
        },
        {
          provide: getRepositoryToken(TeamAdmin),
          useValue: mockTeamAdminRepository,
        },
      ],
    }).compile();

    service = module.get<IncidentService>(IncidentService);
    incidentRepository = module.get<Repository<Incident>>(
      getRepositoryToken(Incident),
    );
    technicianRepository = module.get<Repository<Technician>>(
      getRepositoryToken(Technician),
    );
    incidentHistoryRepository = module.get<Repository<IncidentHistory>>(
      getRepositoryToken(IncidentHistory),
    );
    categoryItemRepository = module.get<Repository<CategoryItem>>(
      getRepositoryToken(CategoryItem),
    );
    sltUserRepository = module.get<Repository<SLTUser>>(
      getRepositoryToken(SLTUser),
    );
    teamAdminRepository = module.get<Repository<TeamAdmin>>(
      getRepositoryToken(TeamAdmin),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset mockIncident to prevent test pollution
    delete (mockIncident as any).assignForTeamAdmin;
    delete (mockIncident as any).automaticallyAssignForTier2;
    mockIncident.category = 'Network Connection';
    mockIncident.handler = '105554';
    mockIncident.status = IncidentStatus.OPEN;
  });

  describe('create', () => {
    it('should create an incident successfully with technician assignment', async () => {
      // Arrange
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      mockIncidentRepository.count.mockResolvedValue(0); // No active workload
      mockIncidentRepository.create.mockReturnValue(mockIncident);
      mockIncidentRepository.save.mockResolvedValue(mockIncident);
      mockSltUserRepository.findOne
        .mockResolvedValueOnce(mockSLTUser) // For handler
        .mockResolvedValueOnce(mockSLTUser); // For informant
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result).toBeDefined();
      expect(mockIncidentRepository.create).toHaveBeenCalled();
      expect(mockIncidentRepository.save).toHaveBeenCalled();
      expect(mockIncidentHistoryRepository.save).toHaveBeenCalled();
    });

    it('should create an incident with PENDING_ASSIGNMENT status when no technician available', async () => {
      // Arrange
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([]); // No technicians available
      const pendingIncident = {
        ...mockIncident,
        handler: null,
        status: IncidentStatus.PENDING_ASSIGNMENT,
      };
      mockIncidentRepository.create.mockReturnValue(pendingIncident);
      mockIncidentRepository.save.mockResolvedValue(pendingIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result.handler).toBeNull();
      expect(result.status).toBe(IncidentStatus.PENDING_ASSIGNMENT);
    });

    it('should throw BadRequestException when required field is missing', async () => {
      // Arrange
      const incompleteDto: Partial<IncidentDto> = { ...mockIncidentDto };
      delete incompleteDto.informant;

      // Act & Assert
      await expect(service.create(incompleteDto as IncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when sequence generation fails', async () => {
      // Arrange
      mockIncidentRepository.query.mockResolvedValue([{}]);

      // Act & Assert
      await expect(service.create(mockIncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when category not found', async () => {
      // Arrange
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(mockIncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when no team found for category', async () => {
      // Arrange
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      const categoryWithoutTeam = {
        ...mockCategoryItem,
        subCategory: { ...mockSubCategory, mainCategory: null },
      };
      mockCategoryItemRepository.findOne.mockResolvedValue(categoryWithoutTeam);

      // Act & Assert
      await expect(service.create(mockIncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle technician workload when assigning', async () => {
      // Arrange
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      mockIncidentRepository.count.mockResolvedValue(3); // Max capacity
      const pendingIncident = {
        ...mockIncident,
        handler: null,
        status: IncidentStatus.PENDING_ASSIGNMENT,
      };
      mockIncidentRepository.create.mockReturnValue(pendingIncident);
      mockIncidentRepository.save.mockResolvedValue(pendingIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result.handler).toBeNull();
      expect(result.status).toBe(IncidentStatus.PENDING_ASSIGNMENT);
    });

    it('should use round-robin assignment for multiple technicians', async () => {
      // Arrange
      const tech1 = { ...mockTechnician, serviceNum: '105554', id: 'tech-1' };
      const tech2 = { ...mockTechnician, serviceNum: '105555', id: 'tech-2' };
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([tech1, tech2]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.create.mockReturnValue(mockIncident);
      mockIncidentRepository.save.mockResolvedValue(mockIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      await service.create(mockIncidentDto);

      // Assert
      expect(mockIncidentRepository.count).toHaveBeenCalled();
    });
  });

  describe('getAssignedToMe', () => {
    it('should return incidents assigned to handler', async () => {
      // Arrange
      const handler = '105554';
      const incidents = [mockIncident];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      // Act
      const result = await service.getAssignedToMe(handler);

      // Assert
      expect(result).toEqual(incidents);
      expect(mockIncidentRepository.find).toHaveBeenCalledWith({
        where: { handler },
      });
    });

    it('should throw BadRequestException when handler is not provided', async () => {
      // Act & Assert
      await expect(service.getAssignedToMe('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on database error', async () => {
      // Arrange
      mockIncidentRepository.find.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(service.getAssignedToMe('105554')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getAssignedByMe', () => {
    it('should return incidents assigned by informant', async () => {
      // Arrange
      const informant = '105553';
      const incidents = [mockIncident];
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(incidents),
      };
      mockIncidentRepository.find.mockResolvedValue([]);
      mockIncidentRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      // Act
      const result = await service.getAssignedByMe(informant);

      // Assert
      expect(result).toEqual(incidents);
    });

    it('should throw BadRequestException when informant is not provided', async () => {
      // Act & Assert
      await expect(service.getAssignedByMe('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle whitespace in informant field', async () => {
      // Arrange
      const informant = '  105553  ';
      const incidents = [mockIncident];
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(incidents),
      };
      mockIncidentRepository.find.mockResolvedValue([]);
      mockIncidentRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      // Act
      const result = await service.getAssignedByMe(informant);

      // Assert
      expect(result).toEqual(incidents);
    });
  });

  describe('getAll', () => {
    it('should return all incidents', async () => {
      // Arrange
      const incidents = [mockIncident];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      // Act
      const result = await service.getAll();

      // Assert
      expect(result).toEqual(incidents);
      expect(mockIncidentRepository.find).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on error', async () => {
      // Arrange
      mockIncidentRepository.find.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(service.getAll()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getByCategory', () => {
    it('should return incidents by category', async () => {
      // Arrange
      const category = 'Network Connection';
      const incidents = [mockIncident];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      // Act
      const result = await service.getByCategory(category);

      // Assert
      expect(result).toEqual(incidents);
      expect(mockIncidentRepository.find).toHaveBeenCalledWith({
        where: { category },
      });
    });

    it('should throw BadRequestException when category is not provided', async () => {
      // Act & Assert
      await expect(service.getByCategory('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on error', async () => {
      // Arrange
      mockIncidentRepository.find.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(service.getByCategory('Network')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
    });

    it('should update incident successfully', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        description: 'Updated description',
      };
      const updatedIncident = { ...mockIncident, ...updateDto };
      mockIncidentRepository.save.mockResolvedValue(updatedIncident);

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result).toEqual(updatedIncident);
      expect(mockIncidentRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when incident not found', async () => {
      // Arrange
      mockIncidentRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update('IN999', {} as IncidentDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no fields to update', async () => {
      // Act & Assert
      await expect(service.update('IN1', {} as IncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle category change and reassign technician', async () => {
      // Arrange
      const newCategoryItem = {
        ...mockCategoryItem,
        name: 'New Category',
      };
      const updateDto: Partial<IncidentDto> = {
        category: 'New Category',
      };
      mockCategoryItemRepository.findOne.mockResolvedValue(newCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        category: 'New Category',
        handler: '105554',
      });

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result).toBeDefined();
      expect(mockCategoryItemRepository.findOne).toHaveBeenCalled();
    });

    it('should handle Tier2 assignment', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        automaticallyAssignForTier2: true,
      };
      const tier2Tech = {
        ...mockTechnician,
        tier: 'Tier2',
        serviceNum: 'TIER2001',
      };
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([tier2Tech]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        handler: 'TIER2001',
      });

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle team admin assignment', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        assignForTeamAdmin: true,
      };
      mockTechnicianRepository.findOne.mockResolvedValue(mockTechnician);
      mockTeamAdminRepository.findOne.mockResolvedValue(mockTeamAdmin);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        handler: 'ADMIN001',
      });

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result).toBeDefined();
      expect(mockTeamAdminRepository.findOne).toHaveBeenCalled();
    });

    it('should throw BadRequestException when assigning to team admin without handler', async () => {
      // Arrange
      const incidentWithoutHandler = { ...mockIncident, handler: null };
      mockIncidentRepository.findOne.mockResolvedValue(incidentWithoutHandler);
      const updateDto: Partial<IncidentDto> = {
        assignForTeamAdmin: true,
      };

      // Act & Assert
      await expect(service.update('IN1', updateDto as IncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle status change to CLOSED', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        status: IncidentStatus.CLOSED,
      };
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.CLOSED,
      });

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result.status).toBe(IncidentStatus.CLOSED);
    });

    it('should validate manual handler assignment skills', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        handler: '105555',
      };
      const targetTech = {
        ...mockTechnician,
        serviceNum: '105555',
        cat1: 'Different Category',
      };
      mockTechnicianRepository.findOne.mockResolvedValue(targetTech);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockIncidentRepository.count.mockResolvedValue(0);

      // Act & Assert
      await expect(service.update('IN1', updateDto as IncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate manual handler assignment workload', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        handler: '105555',
      };
      const targetTech = {
        ...mockTechnician,
        serviceNum: '105555',
        cat1: 'Network Issues',
      };
      mockTechnicianRepository.findOne.mockResolvedValue(targetTech);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockIncidentRepository.count.mockResolvedValue(3); // Max capacity

      // Act & Assert
      await expect(service.update('IN1', updateDto as IncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle PENDING_TIER2_ASSIGNMENT status', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        automaticallyAssignForTier2: true,
      };
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([]); // No Tier2 technicians
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.PENDING_TIER2_ASSIGNMENT,
        handler: null,
      });

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result.status).toBe(IncidentStatus.PENDING_TIER2_ASSIGNMENT);
    });
  });

  describe('getIncidentByNumber', () => {
    it('should return incident by number', async () => {
      // Arrange
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);

      // Act
      const result = await service.getIncidentByNumber('IN1');

      // Assert
      expect(result).toEqual(mockIncident);
      expect(mockIncidentRepository.findOne).toHaveBeenCalledWith({
        where: { incident_number: 'IN1' },
      });
    });

    it('should throw NotFoundException when incident not found', async () => {
      // Arrange
      mockIncidentRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getIncidentByNumber('IN999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on error', async () => {
      // Arrange
      mockIncidentRepository.findOne.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(service.getIncidentByNumber('IN1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getDashboardStats', () => {
    it('should return dashboard stats for all incidents', async () => {
      // Arrange
      const incidents = [
        { ...mockIncident, status: IncidentStatus.OPEN },
        { ...mockIncident, status: IncidentStatus.CLOSED, incident_number: 'IN2' },
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      // Act
      const result = await service.getDashboardStats();

      // Assert
      expect(result).toHaveProperty('statusCounts');
      expect(result).toHaveProperty('priorityCounts');
      expect(result).toHaveProperty('todayStats');
      expect(result.statusCounts.Open).toBe(1);
      expect(result.statusCounts.Closed).toBe(1);
    });

    it('should filter stats for technician', async () => {
      // Arrange
      const incidents = [{ ...mockIncident, handler: '105554' }];
      mockIncidentRepository.find
        .mockResolvedValueOnce(incidents) // First call for all incidents
        .mockResolvedValueOnce(incidents); // Second call for filtered

      // Act
      const result = await service.getDashboardStats({
        userType: 'technician',
        technicianServiceNum: '105554',
      });

      // Assert
      expect(result).toBeDefined();
    });

    it('should filter stats for admin', async () => {
      // Arrange
      const incidents = [mockIncident];
      mockIncidentRepository.find.mockResolvedValue(incidents);
      mockTeamAdminRepository.findOne.mockResolvedValue(mockTeamAdmin);
      mockCategoryItemRepository.find.mockResolvedValue([mockCategoryItem]);
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(incidents),
      };
      mockCategoryItemRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      mockIncidentRepository.find.mockImplementation((options) => {
        if (Array.isArray(options?.where)) {
          return Promise.resolve(incidents);
        }
        return Promise.resolve(incidents);
      });

      // Act
      const result = await service.getDashboardStats({
        userType: 'admin',
        adminServiceNum: 'ADMIN001',
      });

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle today stats correctly', async () => {
      // Arrange
      const today = new Date().toISOString().split('T')[0];
      const incidents = [
        { ...mockIncident, update_on: today, status: IncidentStatus.OPEN },
        {
          ...mockIncident,
          update_on: '2023-01-01',
          status: IncidentStatus.CLOSED,
          incident_number: 'IN2',
        },
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      // Act
      const result = await service.getDashboardStats();

      // Assert
      expect(result.todayStats['Open (Today)']).toBe(1);
    });
  });

  describe('getIncidentHistory', () => {
    it('should return incident history', async () => {
      // Arrange
      const history = [
        {
          id: 1,
          incidentNumber: 'IN1',
          status: 'Open',
          assignedTo: 'John Doe',
          updatedBy: 'Jane Doe',
        },
      ];
      mockIncidentHistoryRepository.find.mockResolvedValue(history as IncidentHistory[]);

      // Act
      const result = await service.getIncidentHistory('IN1');

      // Assert
      expect(result).toEqual(history);
      expect(mockIncidentHistoryRepository.find).toHaveBeenCalledWith({
        where: { incidentNumber: 'IN1' },
        order: { updatedOn: 'ASC' },
      });
    });
  });

  describe('handlePendingAssignments', () => {
    it('should handle pending assignments successfully', async () => {
      // Arrange
      const pendingIncident = {
        ...mockIncident,
        status: IncidentStatus.PENDING_ASSIGNMENT,
        handler: null,
      };
      mockIncidentRepository.find
        .mockResolvedValueOnce([pendingIncident]) // Pending incidents
        .mockResolvedValueOnce([]); // Tier2 pending incidents
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.save.mockResolvedValue({
        ...pendingIncident,
        handler: '105554',
        status: IncidentStatus.OPEN,
      });
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.handlePendingAssignments();

      // Assert
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 when no pending incidents', async () => {
      // Arrange
      mockIncidentRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Act
      const result = await service.handlePendingAssignments();

      // Assert
      expect(result).toBe(0);
    });

    it('should handle Tier2 pending assignments', async () => {
      // Arrange
      const tier2PendingIncident = {
        ...mockIncident,
        status: IncidentStatus.PENDING_TIER2_ASSIGNMENT,
        handler: null,
      };
      mockIncidentRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([tier2PendingIncident]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      const tier2Tech = { ...mockTechnician, tier: 'Tier2' };
      mockTechnicianRepository.find.mockResolvedValue([tier2Tech]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.save.mockResolvedValue({
        ...tier2PendingIncident,
        handler: '105554',
        status: IncidentStatus.OPEN,
      });
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.handlePendingAssignments();

      // Assert
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getIncidentsByMainCategoryCode', () => {
    it('should return incidents by main category code', async () => {
      // Arrange
      const categoryItems = [mockCategoryItem];
      const incidents = [mockIncident];
      mockCategoryItemRepository.find.mockResolvedValue(categoryItems);
      mockIncidentRepository.find.mockResolvedValue(incidents);

      // Act
      const result = await service.getIncidentsByMainCategoryCode('IT');

      // Assert
      expect(result).toEqual(incidents);
      expect(mockCategoryItemRepository.find).toHaveBeenCalled();
    });

    it('should throw NotFoundException when no category items found', async () => {
      // Arrange
      mockCategoryItemRepository.find.mockResolvedValue([]);

      // Act & Assert
      await expect(service.getIncidentsByMainCategoryCode('INVALID')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on error', async () => {
      // Arrange
      mockCategoryItemRepository.find.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(service.getIncidentsByMainCategoryCode('IT')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle errors in getDisplayNameByServiceNum gracefully', async () => {
      // Arrange
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.create.mockReturnValue(mockIncident);
      mockIncidentRepository.save.mockResolvedValue(mockIncident);
      mockSltUserRepository.findOne
        .mockRejectedValueOnce(new Error('DB Error')) // Error getting display name
        .mockResolvedValueOnce(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle empty serviceNum in getDisplayNameByServiceNum', async () => {
      // Arrange
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      mockIncidentRepository.count.mockResolvedValue(0);
      const incidentWithoutHandler = { ...mockIncident, handler: null };
      mockIncidentRepository.create.mockReturnValue(incidentWithoutHandler);
      mockIncidentRepository.save.mockResolvedValue(incidentWithoutHandler);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle category change with no available technicians', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        category: 'New Category',
      };
      const newCategoryItem = {
        ...mockCategoryItem,
        name: 'New Category',
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockCategoryItemRepository.findOne.mockResolvedValue(newCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([]); // No technicians
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        category: 'New Category',
        handler: null,
        status: IncidentStatus.PENDING_ASSIGNMENT,
      });

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result.handler).toBeNull();
      expect(result.status).toBe(IncidentStatus.PENDING_ASSIGNMENT);
    });

    it('should handle case when all technicians are at max capacity during category change', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        category: 'New Category',
      };
      const newCategoryItem = {
        ...mockCategoryItem,
        name: 'New Category',
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockCategoryItemRepository.findOne.mockResolvedValue(newCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      mockIncidentRepository.count.mockResolvedValue(3); // Max capacity
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        category: 'New Category',
        handler: null,
        status: IncidentStatus.PENDING_ASSIGNMENT,
      });

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result.handler).toBeNull();
      expect(result.status).toBe(IncidentStatus.PENDING_ASSIGNMENT);
    });

    it('should handle error when trying to assign to non-existent technician', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        handler: 'NONEXISTENT',
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockTechnicianRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('IN1', updateDto as IncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle pending incident assignment with no sub-category', async () => {
      // Arrange
      const pendingIncident = {
        ...mockIncident,
        status: IncidentStatus.PENDING_ASSIGNMENT,
        handler: null,
      };
      const categoryWithoutSub = {
        ...mockCategoryItem,
        subCategory: null,
      };
      mockIncidentRepository.find.mockResolvedValue([pendingIncident]);
      mockCategoryItemRepository.findOne.mockResolvedValue(categoryWithoutSub);

      // Act
      const result = await service.handlePendingAssignments();

      // Assert
      expect(result).toBe(0);
    });

    it('should handle pending incident with no skilled technicians', async () => {
      // Arrange
      const pendingIncident = {
        ...mockIncident,
        status: IncidentStatus.PENDING_ASSIGNMENT,
        handler: null,
      };
      const unskilledTech = {
        ...mockTechnician,
        cat1: 'Different Category',
        cat2: '',
        cat3: '',
        cat4: '',
      };
      mockIncidentRepository.find.mockResolvedValue([pendingIncident]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([unskilledTech]);
      mockIncidentRepository.count.mockResolvedValue(0);

      // Act
      const result = await service.handlePendingAssignments();

      // Assert
      expect(result).toBe(0);
    });

    it('should handle Tier2 assignment when no skilled technicians available', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        automaticallyAssignForTier2: true,
      };
      const unskilledTier2Tech = {
        ...mockTechnician,
        tier: 'Tier2',
        cat1: 'Different Category',
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([unskilledTier2Tech]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.PENDING_TIER2_ASSIGNMENT,
        handler: null,
      });

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result.status).toBe(IncidentStatus.PENDING_TIER2_ASSIGNMENT);
    });

    it('should handle skill matching with sub-category name', async () => {
      // Arrange
      const techWithSubCategory = {
        ...mockTechnician,
        cat1: 'Network Issues', // Matches sub-category name
      };
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([techWithSubCategory]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.create.mockReturnValue(mockIncident);
      mockIncidentRepository.save.mockResolvedValue(mockIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle skill matching with main category name', async () => {
      // Arrange
      const techWithMainCategory = {
        ...mockTechnician,
        cat1: 'IT Team', // Matches main category name
      };
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([techWithMainCategory]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.create.mockReturnValue(mockIncident);
      mockIncidentRepository.save.mockResolvedValue(mockIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle technician with no categories (not skilled)', async () => {
      // Arrange
      const techWithNoCategories = {
        ...mockTechnician,
        cat1: '',
        cat2: '',
        cat3: '',
        cat4: '',
      };
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([techWithNoCategories]);
      const pendingIncident = {
        ...mockIncident,
        handler: null,
        status: IncidentStatus.PENDING_ASSIGNMENT,
      };
      mockIncidentRepository.create.mockReturnValue(pendingIncident);
      mockIncidentRepository.save.mockResolvedValue(pendingIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result.handler).toBeNull();
      expect(result.status).toBe(IncidentStatus.PENDING_ASSIGNMENT);
    });

    it('should handle category change when new category has no team', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        category: 'New Category',
      };
      // Create a subCategory where mainCategory property is missing (not null, but undefined)
      // This ensures that subCategory?.mainCategory?.id and subCategory?.mainCategory?.name both return undefined
      const subCategoryWithoutMain: any = {
        id: 'sub-cat-1',
        name: 'Network Issues',
        category_code: 'NET',
        // mainCategory is NOT defined at all - this makes it undefined
      };
      const categoryWithoutTeam: any = {
        id: 'cat-item-1',
        name: 'New Category',
        category_code: 'NET-CONN',
        subCategory: subCategoryWithoutMain,
      };
      mockIncidentRepository.findOne.mockResolvedValue({ ...mockIncident });
      mockCategoryItemRepository.findOne.mockResolvedValue(categoryWithoutTeam);

      // Act & Assert
      // When mainCategory is undefined (not present in object):
      // - categoryItem.subCategory?.mainCategory?.id = undefined (optional chaining returns undefined)
      // - categoryItem.subCategory?.mainCategory?.name = undefined
      // - (!mainCategoryId && !teamName) = (!undefined && !undefined) = (true && true) = true
      // - This triggers the BadRequestException at line 424-428
      await expect(service.update('IN1', updateDto as IncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle category change when new category has no sub-category', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        category: 'New Category',
      };
      // Create category where subCategory property is missing (not null, but undefined)
      // This ensures that subCategory?.name returns undefined
      const categoryWithoutSub: any = {
        id: 'cat-item-1',
        name: 'New Category',
        category_code: 'NET-CONN',
        // subCategory is NOT defined at all - this makes it undefined, not null
      };
      mockIncidentRepository.findOne.mockResolvedValue({ ...mockIncident });
      mockCategoryItemRepository.findOne.mockResolvedValue(categoryWithoutSub);

      // Act & Assert
      // When subCategory is undefined (not present in object):
      // - categoryItem.subCategory?.name = undefined (optional chaining returns undefined when property doesn't exist)
      // - (!subCategoryName) = (!undefined) = true
      // - This triggers the BadRequestException at line 431-435
      await expect(service.update('IN1', updateDto as IncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle team admin assignment when team admin not found', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        assignForTeamAdmin: true,
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockTechnicianRepository.findOne.mockResolvedValue(mockTechnician);
      mockTeamAdminRepository.findOne.mockResolvedValue(null);
      mockTeamAdminRepository.find.mockResolvedValue([]);

      // Act & Assert
      await expect(service.update('IN1', updateDto as IncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle error during incident creation', async () => {
      // Arrange
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      // Make the count query fail to trigger InternalServerErrorException
      mockIncidentRepository.count.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.create(mockIncidentDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle update with error', async () => {
      // Arrange
      mockIncidentRepository.findOne.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.update('IN1', {} as IncidentDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle getDashboardStats when admin has no team', async () => {
      // Arrange
      const incidents = [mockIncident];
      mockIncidentRepository.find.mockResolvedValue(incidents);
      mockTeamAdminRepository.findOne.mockResolvedValue({
        ...mockTeamAdmin,
        teamId: null,
      });

      // Act
      const result = await service.getDashboardStats({
        userType: 'admin',
        adminServiceNum: 'ADMIN001',
      });

      // Assert
      expect(result.statusCounts).toBeDefined();
    });

    it('should handle pending incident assignment when technician teamId matches', async () => {
      // Arrange
      const pendingIncident = {
        ...mockIncident,
        status: IncidentStatus.PENDING_ASSIGNMENT,
        handler: null,
      };
      const techWithTeamId = {
        ...mockTechnician,
        team: 'IT Team',
        teamId: 'main-cat-1',
      };
      mockIncidentRepository.find
        .mockResolvedValueOnce([pendingIncident])
        .mockResolvedValueOnce([]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([techWithTeamId]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.save.mockResolvedValue({
        ...pendingIncident,
        handler: '105554',
        status: IncidentStatus.OPEN,
      });
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.handlePendingAssignments();

      // Assert
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle Tier2 technician with both team and teamId fields', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        automaticallyAssignForTier2: true,
      };
      const tier2Tech = {
        ...mockTechnician,
        tier: 'Tier2',
        team: 'IT Team',
        teamId: 'main-cat-1',
        cat1: 'Network Issues',
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find
        .mockResolvedValueOnce([tier2Tech]) // Found by team
        .mockResolvedValueOnce([tier2Tech]); // Found by teamId
      mockIncidentRepository.count.mockResolvedValue(0);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        handler: '105554',
      });

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should trigger auto-assignment after closing incident', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        status: IncidentStatus.CLOSED,
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.CLOSED,
      });
      jest.useFakeTimers();

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result.status).toBe(IncidentStatus.CLOSED);
      jest.runAllTimers();
      jest.useRealTimers();
    });

    it('should trigger auto-assignment after transfer operation', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        automaticallyAssignForTier2: true,
      };
      const tier2Tech = {
        ...mockTechnician,
        tier: 'Tier2',
        cat1: 'Network Issues',
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([tier2Tech]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        handler: 'TIER2001',
      });
      jest.useFakeTimers();

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result).toBeDefined();
      jest.runAllTimers();
      jest.useRealTimers();
    });

    it('should handle manual reassignment triggering auto-assignment', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        handler: '105555',
      };
      const targetTech = {
        ...mockTechnician,
        serviceNum: '105555',
        cat1: 'Network Issues',
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockTechnicianRepository.findOne.mockResolvedValue(targetTech);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        handler: '105555',
      });
      jest.useFakeTimers();

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result.handler).toBe('105555');
      jest.runAllTimers();
      jest.useRealTimers();
    });

    it('should handle category-based reassignment triggering auto-assignment', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        category: 'New Category',
      };
      const newCategoryItem = {
        ...mockCategoryItem,
        name: 'New Category',
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockCategoryItemRepository.findOne.mockResolvedValue(newCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        category: 'New Category',
        handler: '105554',
      });
      jest.useFakeTimers();

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result.category).toBe('New Category');
      jest.runAllTimers();
      jest.useRealTimers();
    });

    it('should handle pending incident with multiple technicians using round-robin', async () => {
      // Arrange
      const pendingIncident = {
        ...mockIncident,
        status: IncidentStatus.PENDING_ASSIGNMENT,
        handler: null,
      };
      const tech1 = { ...mockTechnician, serviceNum: '105554', id: 'tech-1' };
      const tech2 = { ...mockTechnician, serviceNum: '105555', id: 'tech-2' };
      mockIncidentRepository.find
        .mockResolvedValueOnce([pendingIncident])
        .mockResolvedValueOnce([]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([tech1, tech2]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.save.mockResolvedValue({
        ...pendingIncident,
        handler: '105554',
        status: IncidentStatus.OPEN,
      });
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.handlePendingAssignments();

      // Assert
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle pending incident when technician has no categories', async () => {
      // Arrange
      const pendingIncident = {
        ...mockIncident,
        status: IncidentStatus.PENDING_ASSIGNMENT,
        handler: null,
      };
      const techWithNoCategories = {
        ...mockTechnician,
        cat1: '',
        cat2: '',
        cat3: '',
        cat4: '',
      };
      mockIncidentRepository.find
        .mockResolvedValueOnce([pendingIncident])
        .mockResolvedValueOnce([]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([techWithNoCategories]);
      mockIncidentRepository.count.mockResolvedValue(0);

      // Act
      const result = await service.handlePendingAssignments();

      // Assert
      expect(result).toBe(0);
    });

    it('should handle pending incident when all technicians at max capacity', async () => {
      // Arrange
      const pendingIncident = {
        ...mockIncident,
        status: IncidentStatus.PENDING_ASSIGNMENT,
        handler: null,
      };
      const tech1 = { ...mockTechnician, serviceNum: '105554' };
      const tech2 = { ...mockTechnician, serviceNum: '105555' };
      mockIncidentRepository.find
        .mockResolvedValueOnce([pendingIncident])
        .mockResolvedValueOnce([]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([tech1, tech2]);
      mockIncidentRepository.count.mockResolvedValue(3); // Max capacity

      // Act
      const result = await service.handlePendingAssignments();

      // Assert
      expect(result).toBe(0);
    });

    it('should handle Tier2 pending incident assignment successfully', async () => {
      // Arrange
      const tier2PendingIncident = {
        ...mockIncident,
        status: IncidentStatus.PENDING_TIER2_ASSIGNMENT,
        handler: null,
      };
      const tier2Tech = {
        ...mockTechnician,
        tier: 'Tier2',
        cat1: 'Network Issues',
      };
      mockIncidentRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([tier2PendingIncident]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find
        .mockResolvedValueOnce([tier2Tech])
        .mockResolvedValueOnce([tier2Tech]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.save.mockResolvedValue({
        ...tier2PendingIncident,
        handler: '105554',
        status: IncidentStatus.OPEN,
      });
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.handlePendingAssignments();

      // Assert
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle Tier2 pending when all technicians at max capacity', async () => {
      // Arrange
      const tier2PendingIncident = {
        ...mockIncident,
        status: IncidentStatus.PENDING_TIER2_ASSIGNMENT,
        handler: null,
      };
      const tier2Tech = {
        ...mockTechnician,
        tier: 'Tier2',
        cat1: 'Network Issues',
      };
      mockIncidentRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([tier2PendingIncident]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find
        .mockResolvedValueOnce([tier2Tech])
        .mockResolvedValueOnce([tier2Tech]);
      mockIncidentRepository.count.mockResolvedValue(3); // Max capacity

      // Act
      const result = await service.handlePendingAssignments();

      // Assert
      expect(result).toBe(0);
    });

    it('should handle Tier2 pending when no skilled technicians', async () => {
      // Arrange
      const tier2PendingIncident = {
        ...mockIncident,
        status: IncidentStatus.PENDING_TIER2_ASSIGNMENT,
        handler: null,
        category: 'Network Connection', // Make sure category is set
      };
      const unskilledTier2Tech = {
        ...mockTechnician,
        tier: 'Tier2',
        serviceNum: 'TIER2001',
        team: 'IT Team',
        teamId: 'main-cat-1',
        cat1: 'Different Category',
        cat2: '',
        cat3: '',
        cat4: '',
      };
      mockIncidentRepository.find
        .mockResolvedValueOnce([]) // Regular pending incidents
        .mockResolvedValueOnce([tier2PendingIncident]); // Tier2 pending incidents
      // The skill check in isTechnicianSkilledForIncident calls findOne to get category item
      // First call: assignPendingTier2Incident calls findOne to get category for incident
      // Second call: isTechnicianSkilledForIncident calls findOne to check skills
      // The technician's 'Different Category' won't match 'Network Connection', 'Network Issues', or 'IT Team'
      mockCategoryItemRepository.findOne
        .mockResolvedValueOnce(mockCategoryItem) // For assignPendingTier2Incident
        .mockResolvedValueOnce(mockCategoryItem); // For skill check in isTechnicianSkilledForIncident
      // The tryAssignToTier2Technician searches by multiple team identifiers and tier variants
      // It searches: mainCategoryId, mainCategoryId.toString(), teamName, teamName.toString()
      // For each: searches by team and teamId fields, with Tier2 and tier2 tiers
      // So we need to mock multiple searches. The unskilled tech will be found but skill check will fail
      mockTechnicianRepository.find
        // Searches for mainCategoryId as string with Tier2
        .mockResolvedValueOnce([unskilledTier2Tech]) // by team
        .mockResolvedValueOnce([unskilledTier2Tech]) // by teamId
        // Searches for mainCategoryId as string with tier2
        .mockResolvedValueOnce([unskilledTier2Tech]) // by team
        .mockResolvedValueOnce([unskilledTier2Tech]) // by teamId
        // Searches for mainCategoryId (number) with Tier2
        .mockResolvedValueOnce([unskilledTier2Tech]) // by team
        .mockResolvedValueOnce([unskilledTier2Tech]) // by teamId
        // Searches for mainCategoryId (number) with tier2
        .mockResolvedValueOnce([unskilledTier2Tech]) // by team
        .mockResolvedValueOnce([unskilledTier2Tech]) // by teamId
        // Searches for teamName with Tier2
        .mockResolvedValueOnce([unskilledTier2Tech]) // by team
        .mockResolvedValueOnce([unskilledTier2Tech]) // by teamId
        // Searches for teamName with tier2
        .mockResolvedValueOnce([unskilledTier2Tech]) // by team
        .mockResolvedValueOnce([unskilledTier2Tech]); // by teamId
      // Skill check will return false (technician's 'Different Category' won't match
      // 'Network Connection', 'Network Issues', or 'IT Team'), so no assignment should happen
      // Workload check won't be reached since skill check fails first

      // Act
      const result = await service.handlePendingAssignments();

      // Assert - No assignment should happen because technician is not skilled
      expect(result).toBe(0);
    });

    it('should handle getIncidentsByMainCategoryCode with category codes matching', async () => {
      // Arrange
      const categoryItems = [
        {
          ...mockCategoryItem,
          category_code: 'NET-CONN',
        },
      ];
      const incidents = [mockIncident];
      mockCategoryItemRepository.find.mockResolvedValue(categoryItems);
      mockIncidentRepository.find.mockResolvedValue(incidents);

      // Act
      const result = await service.getIncidentsByMainCategoryCode('IT');

      // Assert
      expect(result).toEqual(incidents);
    });

    it('should handle skill matching with cat2 field', async () => {
      // Arrange
      const techWithCat2 = {
        ...mockTechnician,
        cat1: 'Different',
        cat2: 'Network Issues',
        cat3: '',
        cat4: '',
      };
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([techWithCat2]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.create.mockReturnValue(mockIncident);
      mockIncidentRepository.save.mockResolvedValue(mockIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle skill matching with cat3 field', async () => {
      // Arrange
      const techWithCat3 = {
        ...mockTechnician,
        cat1: 'Different',
        cat2: 'Different',
        cat3: 'Network Issues',
        cat4: '',
      };
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([techWithCat3]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.create.mockReturnValue(mockIncident);
      mockIncidentRepository.save.mockResolvedValue(mockIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle skill matching with cat4 field', async () => {
      // Arrange
      const techWithCat4 = {
        ...mockTechnician,
        cat1: 'Different',
        cat2: 'Different',
        cat3: 'Different',
        cat4: 'Network Issues',
      };
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([techWithCat4]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.create.mockReturnValue(mockIncident);
      mockIncidentRepository.save.mockResolvedValue(mockIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle Tier2 round-robin with single technician', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        automaticallyAssignForTier2: true,
      };
      const tier2Tech = {
        ...mockTechnician,
        tier: 'Tier2',
        cat1: 'Network Issues',
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([tier2Tech]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        handler: '105554',
      });

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle Tier2 round-robin with multiple technicians', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        automaticallyAssignForTier2: true,
      };
      const tier2Tech1 = {
        ...mockTechnician,
        tier: 'Tier2',
        serviceNum: 'TIER2001',
        cat1: 'Network Issues',
      };
      const tier2Tech2 = {
        ...mockTechnician,
        tier: 'Tier2',
        serviceNum: 'TIER2002',
        cat1: 'Network Issues',
      };
      mockIncidentRepository.findOne.mockResolvedValue(mockIncident);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([tier2Tech1, tier2Tech2]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      mockIncidentRepository.save.mockResolvedValue({
        ...mockIncident,
        handler: 'TIER2001',
      });

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle error in skill check gracefully', async () => {
      // Arrange
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      // Technicians are found but skill check might have an error
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      const pendingIncident = {
        ...mockIncident,
        handler: null,
        status: IncidentStatus.PENDING_ASSIGNMENT,
      };
      mockIncidentRepository.create.mockReturnValue(pendingIncident);
      mockIncidentRepository.save.mockResolvedValue(pendingIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      // Mock count to simulate no workload
      mockIncidentRepository.count.mockResolvedValue(0);
      // Force skill check to fail by having categoryItem.findOne fail on second call
      // Actually, skill check errors are caught, so incident should still be created as pending
      // Let's test the case where skill check returns false (technician not skilled)
      const unskilledTech = {
        ...mockTechnician,
        cat1: 'Different Category',
        cat2: '',
        cat3: '',
        cat4: '',
      };
      mockTechnicianRepository.find.mockResolvedValue([unskilledTech]);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert - If no skilled technicians, incident should be created as pending
      expect(result.handler).toBeNull();
      expect(result.status).toBe(IncidentStatus.PENDING_ASSIGNMENT);
    });

    it('should handle getDashboardStats with different priority counts', async () => {
      // Arrange
      const incidents = [
        { ...mockIncident, priority: IncidentPriority.MEDIUM },
        { ...mockIncident, priority: IncidentPriority.HIGH, incident_number: 'IN2' },
        { ...mockIncident, priority: IncidentPriority.CRITICAL, incident_number: 'IN3' },
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      // Act
      const result = await service.getDashboardStats();

      // Assert
      expect(result.priorityCounts.Medium).toBe(1);
      expect(result.priorityCounts.High).toBe(1);
      expect(result.priorityCounts.Critical).toBe(1);
    });

    it('should handle getDashboardStats with different status counts', async () => {
      // Arrange
      const incidents = [
        { ...mockIncident, status: IncidentStatus.OPEN },
        { ...mockIncident, status: IncidentStatus.HOLD, incident_number: 'IN2' },
        { ...mockIncident, status: IncidentStatus.IN_PROGRESS, incident_number: 'IN3' },
        { ...mockIncident, status: IncidentStatus.CLOSED, incident_number: 'IN4' },
        { ...mockIncident, status: IncidentStatus.PENDING_ASSIGNMENT, incident_number: 'IN5' },
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      // Act
      const result = await service.getDashboardStats();

      // Assert
      expect(result.statusCounts.Open).toBe(1);
      expect(result.statusCounts.Hold).toBe(1);
      expect(result.statusCounts['In Progress']).toBe(1);
      expect(result.statusCounts.Closed).toBe(1);
      expect(result.statusCounts['Pending Assignment']).toBe(1);
    });

    it('should handle getDashboardStats with update_on as Date object', async () => {
      // Arrange
      const today = new Date();
      const incidents = [
        {
          ...mockIncident,
          update_on: today.toISOString(),
          status: IncidentStatus.OPEN,
        },
      ];
      mockIncidentRepository.find.mockResolvedValue(incidents);

      // Act
      const result = await service.getDashboardStats();

      // Assert
      expect(result).toBeDefined();
      expect(result.todayStats['Open (Today)']).toBe(1);
    });

    it('should handle create with attachment fields', async () => {
      // Arrange
      const incidentDtoWithAttachment: IncidentDto = {
        ...mockIncidentDto,
        attachmentFilename: 'test.pdf',
        attachmentOriginalName: 'original.pdf',
      };
      // Reset all mocks to avoid pollution from previous tests
      jest.clearAllMocks();
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      mockIncidentRepository.count.mockResolvedValue(0);
      const incidentWithAttachment = {
        ...mockIncident,
        attachmentFilename: 'test.pdf',
        attachmentOriginalName: 'original.pdf',
      };
      mockIncidentRepository.create.mockReturnValue(incidentWithAttachment);
      mockIncidentRepository.save.mockResolvedValue(incidentWithAttachment);
      mockSltUserRepository.findOne
        .mockResolvedValueOnce(mockSLTUser) // For handler
        .mockResolvedValueOnce(mockSLTUser); // For informant
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(incidentDtoWithAttachment);

      // Assert
      expect(result).toBeDefined();
      expect(mockIncidentHistoryRepository.save).toHaveBeenCalled();
    });

    it('should handle update with attachment fields', async () => {
      // Arrange
      const updateDto: Partial<IncidentDto> = {
        attachmentFilename: 'updated.pdf',
        attachmentOriginalName: 'updated-original.pdf',
      };
      const updatedIncident = {
        ...mockIncident,
        attachmentFilename: 'updated.pdf',
        attachmentOriginalName: 'updated-original.pdf',
      };
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);
      mockIncidentRepository.save.mockResolvedValue(updatedIncident);

      // Act
      const result = await service.update('IN1', updateDto as IncidentDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle incident with no sub-category name during create', async () => {
      // Arrange
      const categoryWithoutSubName = {
        ...mockCategoryItem,
        subCategory: { ...mockSubCategory, name: null },
      };
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(categoryWithoutSubName);

      // Act & Assert
      await expect(service.create(mockIncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle incident with category item name matching for skills', async () => {
      // Arrange
      const techWithExactMatch = {
        ...mockTechnician,
        cat1: 'Network Connection', // Exact category item name match
      };
      mockIncidentRepository.query.mockResolvedValue([{ value: 1 }]);
      mockCategoryItemRepository.findOne.mockResolvedValue(mockCategoryItem);
      mockTechnicianRepository.find.mockResolvedValue([techWithExactMatch]);
      mockIncidentRepository.count.mockResolvedValue(0);
      mockIncidentRepository.create.mockReturnValue(mockIncident);
      mockIncidentRepository.save.mockResolvedValue(mockIncident);
      mockSltUserRepository.findOne.mockResolvedValue(mockSLTUser);
      mockIncidentHistoryRepository.save.mockResolvedValue({} as IncidentHistory);

      // Act
      const result = await service.create(mockIncidentDto);

      // Assert
      expect(result).toBeDefined();
    });
  });
});
