import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Param,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../middlewares/jwt-auth.guard';
import { RolesGuard } from '../middlewares/roles.guard';
import { Roles } from '../middlewares/roles.decorator';
import { IncidentService } from './incident.service';
import { IncidentDto } from './dto/incident.dto';
import { Incident } from './entities/incident.entity';
import { IncidentHistory } from './entities/incident-history.entity';
import { io } from '../main';

@Controller('incident')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) { }

  // Post method
  @Post('create-incident')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async create(@Body() incidentDto: IncidentDto): Promise<Incident> {
    try {
      const incident = await this.incidentService.create(incidentDto);

      if (io) {
        const eventData = { incident };

        // 1. Send to ALL users for general awareness (no popup, just for Redux state update)
        io.emit('incident_created', eventData);

        // 2. Send to specific assigned technician (with popup notification)
        if (incident.handler) {
          io.to(`user_${incident.handler}`).emit(
            'incident_assigned_technician',
            {
              ...eventData,
              message: `You have been assigned incident ${incident.incident_number}`,
            },
          );
        }
      }

      return incident;
    } catch (error) {
      throw error;
    }
  }

  // Post method with attachment
  @Post('create-incident-with-attachment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage:
        process.env.NODE_ENV === 'production'
          ? memoryStorage() // Use memory storage for Heroku
          : diskStorage({
            destination: (req, file, cb) => {
              const uploadsPath = join(
                process.cwd(),
                'uploads',
                'incident_attachments',
              );
              try {
                if (!fs.existsSync(uploadsPath)) {
                  fs.mkdirSync(uploadsPath, { recursive: true });
                }
                cb(null, uploadsPath);
              } catch (error) {
                console.error('Upload directory creation failed:', error);
                cb(error, uploadsPath);
              }
            },
            filename: (req, file, cb) => {
              const uniqueSuffix =
                Date.now() + '-' + Math.round(Math.random() * 1e9);
              const filename = `${uniqueSuffix}-${file.originalname}`;
              cb(null, filename);
            },
          }),
      limits: {
        fileSize: 1024 * 1024, // 1MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'image/png',
          'image/jpg',
          'image/jpeg',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              'Invalid file type. Only PDF, PNG, JPG, and JPEG files are allowed.',
            ),
            false,
          );
        }
      },
    }),
  )
  async createIncidentWithAttachment(
    @Body() incidentDto: IncidentDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<Incident> {
    try {
      // Add attachment info to the DTO if file is uploaded
      if (file) {
        if (process.env.NODE_ENV === 'production') {
          // For production (memory storage)
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const filename = `${uniqueSuffix}-${file.originalname}`;

          incidentDto.attachmentFilename = filename;
          incidentDto.attachmentOriginalName = file.originalname;
          incidentDto.attachmentBuffer = file.buffer;
          incidentDto.attachmentMimetype = file.mimetype;
          incidentDto.attachmentSize = file.size;
        } else {
          // For local development (disk storage)
          incidentDto.attachmentFilename = file.filename;
          incidentDto.attachmentOriginalName = file.originalname;
        }
      }

      const incident = await this.incidentService.create(incidentDto);

      if (io) {
        const eventData = { incident };

        // 1. Send to ALL users for general awareness (no popup, just for Redux state update)
        io.emit('incident_created', eventData);

        // 2. Send targeted notification to assigned technician (with popup)
        if (incident.handler) {
          io.to(`user_${incident.handler}`).emit(
            'incident_assigned_technician',
            {
              ...eventData,
              message: `You have been assigned incident ${incident.incident_number}`,
            },
          );
        }
      } else {
        /* empty */
      }

      return incident;
    } catch (error) {
      throw error;
    }
  }
  @Get('assigned-to-me/:serviceNum')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getAssignedToMe(
    @Param('serviceNum') serviceNum: string,
  ): Promise<Incident[]> {
    try {
      return await this.incidentService.getAssignedToMe(serviceNum);
    } catch (error) {
      throw error;
    }
  }
  @Get('assigned-by-me/:serviceNum')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getAssignedByMe(
    @Param('serviceNum') serviceNum: string,
  ): Promise<Incident[]> {
    try {
      const result = await this.incidentService.getAssignedByMe(serviceNum);

      return result;
    } catch (error) {
      throw error;
    }
  }

  @Get('all-teams')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getAll(): Promise<Incident[]> {
    try {
      return await this.incidentService.getAll();
    } catch (error) {
      throw error;
    }
  }

  @Get('dashboard-stats')
  async getDashboardStats(
    @Query('userType') userType?: string,
    @Query('technicianServiceNum') technicianServiceNum?: string,
    @Query('teamName') teamName?: string,
    @Query('adminServiceNum') adminServiceNum?: string,
  ): Promise<any> {
    try {
      return await this.incidentService.getDashboardStats({
        userType,
        technicianServiceNum,
        teamName,
        adminServiceNum,
      });
    } catch (error) {
      throw error;
    }
  }



  @Get('view-team-incidents/:teamId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getByCategory(@Param('teamId') teamId: string): Promise<Incident[]> {
    try {
      return await this.incidentService.getByCategory(teamId);
    } catch (error) {
      throw error;
    }
  }
  @Post(':incident_number/update-with-attachment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage:
        process.env.NODE_ENV === 'production'
          ? memoryStorage() // Use memory storage for Heroku
          : diskStorage({
            destination: (req, file, cb) => {
              const uploadsPath = join(
                process.cwd(),
                'uploads',
                'incident_attachments',
              );
              try {
                if (!fs.existsSync(uploadsPath)) {
                  fs.mkdirSync(uploadsPath, { recursive: true });
                }
                cb(null, uploadsPath);
              } catch (error) {
                console.error('Upload directory creation failed:', error);
                cb(error, uploadsPath);
              }
            },
            filename: (req, file, cb) => {
              const uniqueSuffix =
                Date.now() + '-' + Math.round(Math.random() * 1e9);
              const filename = `${uniqueSuffix}-${file.originalname}`;
              cb(null, filename);
            },
          }),
      limits: {
        fileSize: 1024 * 1024, // 1MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'image/png',
          'image/jpg',
          'image/jpeg',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              'Invalid file type. Only PDF, PNG, JPG, and JPEG files are allowed.',
            ),
            false,
          );
        }
      },
    }),
  )
  async updateWithAttachment(
    @Param('incident_number') incident_number: string,
    @Body() incidentDto: IncidentDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<Incident> {
    try {
      // If file is uploaded, add attachment info to the DTO
      if (file) {
        // Handle production environment (memory storage)
        if (process.env.NODE_ENV === 'production') {
          // Generate a unique filename for production
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const filename = `${uniqueSuffix}-${file.originalname}`;

          incidentDto.attachmentFilename = filename;
          incidentDto.attachmentOriginalName = file.originalname;
          incidentDto.attachmentBuffer = file.buffer; // Store buffer for cloud storage
          incidentDto.attachmentMimetype = file.mimetype;
          incidentDto.attachmentSize = file.size;
        } else {
          // For local development (disk storage)
          incidentDto.attachmentFilename = file.filename;
          incidentDto.attachmentOriginalName = file.originalname;
        }
      }

      const updatedIncident = await this.incidentService.update(
        incident_number,
        incidentDto,
      );

      if (io) {
        const eventData = { incident: updatedIncident };
        // Emit real-time update
        io.emit('incident_updated', eventData);
      }

      return updatedIncident;
    } catch (error) {
      // If there's an error and a file was uploaded, clean it up (only for local storage)
      if (file && file.path && process.env.NODE_ENV !== 'production') {
        try {
          require('fs').unlinkSync(file.path);
        } catch (cleanupError) {
          console.error('Failed to clean up uploaded file:', cleanupError);
        }
      }

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

  @Put(':incident_number')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async update(
    @Param('incident_number') incident_number: string,
    @Body() incidentDto: IncidentDto,
  ): Promise<Incident> {
    try {
      const updatedIncident = await this.incidentService.update(
        incident_number,
        incidentDto,
      );

      if (io) {
        const eventData = { incident: updatedIncident };

        // 1. Send to ALL users for general awareness (no popup, just for Redux state update)
        io.emit('incident_updated', eventData);

        // 2. Send targeted notification to assigned handler (with popup)
        if (updatedIncident.handler) {
          io.to(`user_${updatedIncident.handler}`).emit(
            'incident_updated_assigned',
            {
              ...eventData,
              message: `Incident ${updatedIncident.incident_number} has been updated`,
            },
          );
        }
      } else {
      }

      return updatedIncident;
    } catch (error) {
      throw error;
    }
  }

  @Get(':incident_number')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getIncidentByNumber(
    @Param('incident_number') incident_number: string,
  ): Promise<Incident> {
    try {
      return await this.incidentService.getIncidentByNumber(incident_number);
    } catch (error) {
      throw error;
    }
  }
// Get incident history*****
  @Get(':incident_number/performance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getIncidentPerformance(
    @Param('incident_number') incident_number: string,
  ) {
    return this.incidentService.getIncidentPerformance(incident_number);
  }

  @Get(':incident_number/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getIncidentHistory(
    @Param('incident_number') incident_number: string,
  ): Promise<IncidentHistory[]> {
    try {
      return await this.incidentService.getIncidentHistory(incident_number);
    } catch (error) {
      throw error;
    }
  }

  // Test endpoint for socket functionality
  @Post('test-socket')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  testSocket(): { message: string } {
    // Create a mock incident for testing
    const mockIncident = {
      incident_number: `TEST-${Date.now()}`,
      informant: '105553',
      location: 'Test Location',
      handler: '105553',
      category: 'Socket Test',
      status: 'Open',
      priority: 'Medium',
      problem: 'Testing socket functionality',
    };

    if (io) {
      // Send all types of notifications for testing
      const eventData = { incident: mockIncident };

      // 1. General notification to all users
      io.emit('incident_created', eventData);

      // 2. Targeted notification to assigned technician (simulating assignment)
      io.to(`user_${mockIncident.handler}`).emit(
        'incident_assigned_technician',
        {
          ...eventData,
          message: `Test assignment: You have been assigned incident ${mockIncident.incident_number}`,
        },
      );
    } else {
    }

    return { message: 'Test socket events emitted successfully' };
  }

  // Test endpoint for socket update functionality
  @Post('test-socket-update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  testSocketUpdate(): { message: string } {
    // Create a mock updated incident for testing
    const mockUpdatedIncident = {
      incident_number: `UPDATE-TEST-${Date.now()}`,
      informant: '105553',
      location: 'Updated Test Location',
      handler: '105553',
      category: 'Socket Update Test',
      status: 'In Progress',
      priority: 'High',
      problem:
        'Testing socket update functionality - Status changed to In Progress',
    };

    if (io) {
      const eventData = { incident: mockUpdatedIncident };

      // 1. General notification to all users (no popup)
      io.emit('incident_updated', eventData);

      // 2. Targeted notification to assigned handler (with popup)
      io.to(`user_${mockUpdatedIncident.handler}`).emit(
        'incident_updated_assigned',
        {
          ...eventData,
          message: `Test update: Incident ${mockUpdatedIncident.incident_number} has been updated`,
        },
      );
    } else {
    }

    return { message: 'Test socket update events emitted successfully' };
  }

  // Test endpoint for socket incident closure functionality
  @Post('test-socket-closure')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  testSocketClosure(): { message: string } {
    // Create a mock closed incident for testing
    const mockClosedIncident = {
      incident_number: `CLOSURE-TEST-${Date.now()}`,
      informant: '105553', // User who created the incident
      location: 'Test Location',
      handler: '105554', // Technician who closed it
      category: 'Socket Closure Test',
      status: 'Closed',
      priority: 'Medium',
      problem: 'Testing socket closure functionality - Incident has been closed',
    };

    if (io) {
      const eventData = { incident: mockClosedIncident };

      // 1. General notification to all users (no popup, just for Redux state update)
      io.emit('incident_updated', eventData);

      // 2. Targeted notification to the user who created the incident (with popup)
      io.to(`user_${mockClosedIncident.informant}`).emit(
        'incident_closed_notification',
        {
          ...eventData,
          message: `Test closure: Your incident ${mockClosedIncident.incident_number} has been closed by the technician`,
        },
      );

      // 3. Notification to all admins and super admins (with popup)
      io.emit('incident_closed_admin_notification', {
        ...eventData,
        message: `Test closure: Incident ${mockClosedIncident.incident_number} has been closed by technician ${mockClosedIncident.handler}`,
      });
    } else {
    }

    return { message: 'Test socket closure events emitted successfully' };
  }

  // File upload configuration
  private getFileUploadOptions() {
    return {
      storage: diskStorage({
        destination: './uploads/incident_attachments',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const fileExtension = extname(file.originalname);
          callback(null, `${uniqueSuffix}${fileExtension}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Check file type
        const allowedTypes = ['pdf', 'png', 'jpg', 'jpeg'];
        const fileExtension = extname(file.originalname).toLowerCase().slice(1);

        if (allowedTypes.includes(fileExtension)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Only PDF, PNG, JPG, and JPEG files are allowed',
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: 1024 * 1024, // 1MB limit
      },
    };
  }

  // Upload attachment endpoint
  @Post('upload-attachment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  @UseInterceptors(
    FileInterceptor('attachment', {
      storage:
        process.env.NODE_ENV === 'production'
          ? memoryStorage() // Use memory storage for Heroku
          : diskStorage({
            destination: (req, file, callback) => {
              const uploadsPath = join(
                process.cwd(),
                'uploads',
                'incident_attachments',
              );
              try {
                if (!fs.existsSync(uploadsPath)) {
                  fs.mkdirSync(uploadsPath, { recursive: true });
                }
                callback(null, uploadsPath);
              } catch (error) {
                console.error('Upload directory creation failed:', error);
                callback(error, uploadsPath);
              }
            },
            filename: (req, file, callback) => {
              const uniqueSuffix =
                Date.now() + '-' + Math.round(Math.random() * 1e9);
              const fileExtension = extname(file.originalname);
              callback(null, `${uniqueSuffix}${fileExtension}`);
            },
          }),
      fileFilter: (req, file, callback) => {
        const allowedTypes = ['pdf', 'png', 'jpg', 'jpeg'];
        const fileExtension = extname(file.originalname).toLowerCase().slice(1);

        if (allowedTypes.includes(fileExtension)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Only PDF, PNG, JPG, and JPEG files are allowed',
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: 1024 * 1024, // 1MB limit
      },
    }),
  )
  // eslint-disable-next-line @typescript-eslint/require-await
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Handle production environment (memory storage)
    if (process.env.NODE_ENV === 'production') {
      // For production, we need to save the buffer to a temporary location
      // or use cloud storage service like AWS S3, Cloudinary etc.
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;

      return {
        success: true,
        filename: filename,
        originalName: file.originalname,
        size: file.size,
        buffer: file.buffer, // Available in memory storage
        mimetype: file.mimetype,
      };
    }

    // For local development (disk storage)
    return {
      success: true,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      path: file.path,
    };
  }

  // Download attachment endpoint
  @Get('download-attachment/:filename')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  downloadAttachment(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    try {
      const filePath = join(
        process.cwd(),
        'uploads',
        'incident_attachments',
        filename,
      );

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException('File not found');
      }

      // Set appropriate headers for download
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Type', 'application/octet-stream');

      // Send file
      res.sendFile(filePath);
    } catch (error) {
      throw new BadRequestException('Failed to download file');
    }
  }

  @Get('by-main-category/:mainCategoryCode')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getIncidentsByMainCategoryCode(
    @Param('mainCategoryCode') mainCategoryCode: string,
  ): Promise<Incident[]> {
    try {
      return await this.incidentService.getIncidentsByMainCategoryCode(mainCategoryCode);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch incidents by main category');
    }
  }
}