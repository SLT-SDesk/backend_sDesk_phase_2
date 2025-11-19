// src/incident/test/incident.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { IncidentController } from '../incident.controller';
import { IncidentService } from '../incident.service';
import { IncidentDto } from '../dto/incident.dto';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { IncidentStatus, IncidentPriority } from '../entities/incident.entity';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';

// Mock socket.io exported from main.ts
jest.mock('../../main', () => ({
  io: {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  },
}));

const { io } = require('../../main');

describe('IncidentController', () => {
  let controller: IncidentController;
  let service: IncidentService;

  const mockIncidentDto: IncidentDto = {
    informant: 'SV001',
    location: 'LOC_2',
    handler: 'SV010',
    category: 'CAT015',
    status: IncidentStatus.OPEN,
    priority: IncidentPriority.CRITICAL,
    description: 'Laptop not turning on.',
    notify_informant: false,
    update_by: 'SV001',
    update_on: '2025-01-01',
  };

  const mockIncident = { incident_number: 'IN1', ...mockIncidentDto };

  const mockIncident2 = {
    incident_number: 'IN2',
    ...mockIncidentDto,
    informant: 'SV002',
  };

  const mockIncidentService = {
    create: jest.fn(),
    getAssignedToMe: jest.fn(),
    getAssignedByMe: jest.fn(),
    getAll: jest.fn(),
    getByCategory: jest.fn(),
    update: jest.fn(),
    getIncidentByNumber: jest.fn(),
    getDashboardStats: jest.fn(),
    getIncidentHistory: jest.fn(),
    getIncidentsByMainCategoryCode: jest.fn(),
  } as unknown as IncidentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncidentController],
      providers: [
        {
          provide: IncidentService,
          useValue: mockIncidentService,
        },
      ],
    }).compile();

    controller = module.get<IncidentController>(IncidentController);
    service = module.get<IncidentService>(IncidentService);

    (io.emit as jest.Mock).mockClear();
    (io.to as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // ensure tests don't leak NODE_ENV
    delete process.env.NODE_ENV;
  });

  // ---------------------------------------------------------
  // CREATE INCIDENT - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('create', () => {
    it('should create an incident and emit events', async () => {
      (service.create as jest.Mock).mockResolvedValue(mockIncident);
      const result = await controller.create(mockIncidentDto);

      expect(service.create).toHaveBeenCalledWith(mockIncidentDto);
      expect(result).toEqual(mockIncident);
      expect(io.emit).toHaveBeenCalledWith('incident_created', { incident: mockIncident });
      expect(io.to).toHaveBeenCalledWith(`user_${mockIncident.handler}`);
    });

    it('should create incident without emitting to handler when handler is null', async () => {
      const noHandlerIncident = { ...mockIncident, handler: null };
      (service.create as jest.Mock).mockResolvedValue(noHandlerIncident);

      const result = await controller.create({ ...mockIncidentDto, handler: null });
      
      expect(result).toEqual(noHandlerIncident);
      expect(io.emit).toHaveBeenCalledWith('incident_created', { incident: noHandlerIncident });
      // Should not call to() when handler is null
      expect((io.to as jest.Mock).mock.calls.some(call => call[0] === 'user_null')).toBe(false);
    });

    it('should create incident without emitting to handler when handler is empty string', async () => {
      const emptyHandlerIncident = { ...mockIncident, handler: '' };
      (service.create as jest.Mock).mockResolvedValue(emptyHandlerIncident);

      const result = await controller.create({ ...mockIncidentDto, handler: '' });
      
      expect(result).toEqual(emptyHandlerIncident);
      expect(io.emit).toHaveBeenCalled();
      // Should not call to() when handler is empty
      expect((io.to as jest.Mock).mock.calls.some(call => call[0] === 'user_')).toBe(false);
    });

    it('should propagate BadRequestException', async () => {
      (service.create as jest.Mock).mockRejectedValue(
        new BadRequestException('Missing required field: informant'),
      );

      await expect(
        controller.create({ ...mockIncidentDto, informant: undefined } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate InternalServerErrorException', async () => {
      (service.create as jest.Mock).mockRejectedValue(
        new InternalServerErrorException('Failed to create incident'),
      );

      await expect(controller.create(mockIncidentDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should NOT emit socket events when io = null', async () => {
      const originalIo = require('../../main').io;
      (require('../../main').io as any) = null;

      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      const result = await controller.create(mockIncidentDto);

      expect(result).toEqual(mockIncident);
      expect(io.emit).not.toHaveBeenCalled();
      expect(io.to).not.toHaveBeenCalled();

      (require('../../main').io as any) = originalIo;
    });

    it('should handle generic errors', async () => {
      (service.create as jest.Mock).mockRejectedValue(new Error('Generic error'));

      await expect(controller.create(mockIncidentDto)).rejects.toThrow(Error);
    });
  });

  // ---------------------------------------------------------
  // CREATE INCIDENT WITH ATTACHMENT - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('createIncidentWithAttachment', () => {
    it('should create incident with file in development mode', async () => {
      process.env.NODE_ENV = 'development';
      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      const fakeFile = {
        originalname: 'test.pdf',
        buffer: Buffer.from('a'),
        mimetype: 'application/pdf',
        size: 123,
        filename: 'stored.pdf',
        path: '/tmp/stored.pdf',
      } as any;

      const res = await controller.createIncidentWithAttachment(
        mockIncidentDto,
        fakeFile,
      );

      expect(service.create).toHaveBeenCalledWith({
        ...mockIncidentDto,
        attachmentFilename: fakeFile.filename,
        attachmentOriginalName: fakeFile.originalname,
      });
      expect(io.emit).toHaveBeenCalled();
      expect(res).toEqual(mockIncident);
    });

    it('should create incident with file in production mode', async () => {
      process.env.NODE_ENV = 'production';
      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      const fakeFile = {
        originalname: 'prod.pdf',
        buffer: Buffer.from('a'),
        mimetype: 'application/pdf',
        size: 99,
      } as any;

      const res = await controller.createIncidentWithAttachment(
        mockIncidentDto,
        fakeFile,
      );

      expect(service.create).toHaveBeenCalledWith({
        ...mockIncidentDto,
        attachmentFilename: expect.stringContaining('prod.pdf'),
        attachmentOriginalName: fakeFile.originalname,
        attachmentBuffer: fakeFile.buffer,
        attachmentMimetype: fakeFile.mimetype,
        attachmentSize: fakeFile.size,
      });
      expect(io.emit).toHaveBeenCalled();
      expect(res).toEqual(mockIncident);
    });

    it('should create incident without file', async () => {
      (service.create as jest.Mock).mockResolvedValue(mockIncident);
      const res = await controller.createIncidentWithAttachment(mockIncidentDto, undefined as any);
      
      expect(service.create).toHaveBeenCalledWith(mockIncidentDto);
      expect(res).toEqual(mockIncident);
    });

    it('should propagate service errors', async () => {
      const fakeFile = {
        originalname: 'err.pdf',
        buffer: Buffer.from('x'),
        mimetype: 'application/pdf',
        size: 10,
      } as any;

      (service.create as jest.Mock).mockRejectedValue(new BadRequestException('Service error'));

      await expect(
        controller.createIncidentWithAttachment(mockIncidentDto, fakeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle errors without io', async () => {
      const originalIo = require('../../main').io;
      (require('../../main').io as any) = null;

      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      const res = await controller.createIncidentWithAttachment(mockIncidentDto, undefined as any);
      
      expect(res).toEqual(mockIncident);
      expect(io.emit).not.toHaveBeenCalled();

      (require('../../main').io as any) = originalIo;
    });
  });

  // ---------------------------------------------------------
  // GET ASSIGNED TO ME - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('getAssignedToMe', () => {
    it('should return incidents for valid service number', async () => {
      (service.getAssignedToMe as jest.Mock).mockResolvedValue([mockIncident]);
      const res = await controller.getAssignedToMe('SV010');

      expect(res).toEqual([mockIncident]);
      expect(service.getAssignedToMe).toHaveBeenCalledWith('SV010');
    });

    it('should return empty array when no incidents found', async () => {
      (service.getAssignedToMe as jest.Mock).mockResolvedValue([]);
      const res = await controller.getAssignedToMe('SV999');
      
      expect(res).toEqual([]);
      expect(service.getAssignedToMe).toHaveBeenCalledWith('SV999');
    });

    it('should propagate BadRequestException', async () => {
      (service.getAssignedToMe as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid service number'),
      );
      
      await expect(controller.getAssignedToMe('')).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException', async () => {
      (service.getAssignedToMe as jest.Mock).mockRejectedValue(
        new NotFoundException('User not found'),
      );
      
      await expect(controller.getAssignedToMe('INVALID')).rejects.toThrow(NotFoundException);
    });

    it('should propagate InternalServerErrorException', async () => {
      (service.getAssignedToMe as jest.Mock).mockRejectedValue(
        new InternalServerErrorException('Database error'),
      );
      
      await expect(controller.getAssignedToMe('SV010')).rejects.toThrow(InternalServerErrorException);
    });

    it('should propagate generic errors', async () => {
      (service.getAssignedToMe as jest.Mock).mockRejectedValue(new Error('Generic error'));
      
      await expect(controller.getAssignedToMe('SV010')).rejects.toThrow(Error);
    });
  });

  // ---------------------------------------------------------
  // GET ASSIGNED BY ME - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('getAssignedByMe', () => {
    it('should return incidents assigned by user', async () => {
      (service.getAssignedByMe as jest.Mock).mockResolvedValue([mockIncident, mockIncident2]);
      const res = await controller.getAssignedByMe('SV001');

      expect(res).toEqual([mockIncident, mockIncident2]);
      expect(service.getAssignedByMe).toHaveBeenCalledWith('SV001');
    });

    it('should return empty array when user assigned no incidents', async () => {
      (service.getAssignedByMe as jest.Mock).mockResolvedValue([]);
      const res = await controller.getAssignedByMe('SV999');
      
      expect(res).toEqual([]);
    });

    it('should propagate BadRequestException', async () => {
      (service.getAssignedByMe as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid service number'),
      );
      
      await expect(controller.getAssignedByMe('')).rejects.toThrow(BadRequestException);
    });

    it('should propagate other errors', async () => {
      (service.getAssignedByMe as jest.Mock).mockRejectedValue(
        new InternalServerErrorException('Service error'),
      );
      
      await expect(controller.getAssignedByMe('SV001')).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ---------------------------------------------------------
  // GET ALL - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('getAll', () => {
    it('should return all incidents', async () => {
      (service.getAll as jest.Mock).mockResolvedValue([mockIncident, mockIncident2]);
      const res = await controller.getAll();

      expect(res).toEqual([mockIncident, mockIncident2]);
      expect(service.getAll).toHaveBeenCalled();
    });

    it('should return empty array when no incidents', async () => {
      (service.getAll as jest.Mock).mockResolvedValue([]);
      const res = await controller.getAll();
      
      expect(res).toEqual([]);
    });

    it('should propagate InternalServerErrorException', async () => {
      (service.getAll as jest.Mock).mockRejectedValue(
        new InternalServerErrorException('Database error'),
      );
      
      await expect(controller.getAll()).rejects.toThrow(InternalServerErrorException);
    });

    it('should propagate generic errors', async () => {
      (service.getAll as jest.Mock).mockRejectedValue(new Error('Generic error'));
      
      await expect(controller.getAll()).rejects.toThrow(Error);
    });
  });

  // ---------------------------------------------------------
  // DASHBOARD STATS - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('getDashboardStats', () => {
    it('should return stats with all parameters', async () => {
      const stats = { total: 10, open: 5, closed: 5 };
      (service.getDashboardStats as jest.Mock).mockResolvedValue(stats);

      const res = await controller.getDashboardStats(
        'technician',
        'T1',
        'TeamA',
        'AdminX',
      );

      expect(res).toEqual(stats);
      expect(service.getDashboardStats).toHaveBeenCalledWith({
        userType: 'technician',
        technicianServiceNum: 'T1',
        teamName: 'TeamA',
        adminServiceNum: 'AdminX',
      });
    });

    it('should return stats with partial parameters', async () => {
      const stats = { total: 3, open: 2, closed: 1 };
      (service.getDashboardStats as jest.Mock).mockResolvedValue(stats);

      const res = await controller.getDashboardStats('admin', undefined, 'TeamB');

      expect(res).toEqual(stats);
      expect(service.getDashboardStats).toHaveBeenCalledWith({
        userType: 'admin',
        technicianServiceNum: undefined,
        teamName: 'TeamB',
        adminServiceNum: undefined,
      });
    });

    it('should return stats with no parameters', async () => {
      (service.getDashboardStats as jest.Mock).mockResolvedValue({});

      const res = await controller.getDashboardStats();

      expect(res).toEqual({});
      expect(service.getDashboardStats).toHaveBeenCalledWith({
        userType: undefined,
        technicianServiceNum: undefined,
        teamName: undefined,
        adminServiceNum: undefined,
      });
    });

    it('should propagate service errors', async () => {
      (service.getDashboardStats as jest.Mock).mockRejectedValue(
        new InternalServerErrorException('Stats error'),
      );
      
      await expect(controller.getDashboardStats()).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ---------------------------------------------------------
  // GET BY CATEGORY - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('getByCategory', () => {
    it('should return incidents for category', async () => {
      (service.getByCategory as jest.Mock).mockResolvedValue([mockIncident]);
      const res = await controller.getByCategory('TEAM1');

      expect(res).toEqual([mockIncident]);
      expect(service.getByCategory).toHaveBeenCalledWith('TEAM1');
    });

    it('should return empty array for category with no incidents', async () => {
      (service.getByCategory as jest.Mock).mockResolvedValue([]);
      const res = await controller.getByCategory('EMPTY_TEAM');
      
      expect(res).toEqual([]);
    });

    it('should propagate BadRequestException', async () => {
      (service.getByCategory as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid team ID'),
      );
      
      await expect(controller.getByCategory('')).rejects.toThrow(BadRequestException);
    });

    it('should wrap generic errors as InternalServerError', async () => {
      (service.getByCategory as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      await expect(controller.getByCategory('TEAM1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ---------------------------------------------------------
  // UPDATE WITH ATTACHMENT - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('updateWithAttachment', () => {
    it('should update incident with file in development mode', async () => {
      process.env.NODE_ENV = 'development';
      (service.update as jest.Mock).mockResolvedValue(mockIncident);

      const fakeFile = {
        originalname: 'update.pdf',
        buffer: Buffer.from('x'),
        mimetype: 'application/pdf',
        size: 12,
        filename: 'update.pdf',
        path: 'x.pdf',
      } as any;

      const res = await controller.updateWithAttachment(
        'IN1',
        mockIncidentDto,
        fakeFile,
      );

      expect(res).toEqual(mockIncident);
      expect(service.update).toHaveBeenCalledWith('IN1', {
        ...mockIncidentDto,
        attachmentFilename: fakeFile.filename,
        attachmentOriginalName: fakeFile.originalname,
      });
      expect(io.emit).toHaveBeenCalledWith('incident_updated', { incident: mockIncident });
    });

    it('should update incident with file in production mode', async () => {
      process.env.NODE_ENV = 'production';
      (service.update as jest.Mock).mockResolvedValue(mockIncident);

      const fakeFile = {
        originalname: 'prod-update.pdf',
        buffer: Buffer.from('x'),
        mimetype: 'application/pdf',
        size: 12,
      } as any;

      const res = await controller.updateWithAttachment(
        'IN1',
        mockIncidentDto,
        fakeFile,
      );

      expect(res).toEqual(mockIncident);
      expect(service.update).toHaveBeenCalledWith('IN1', {
        ...mockIncidentDto,
        attachmentFilename: expect.stringContaining('prod-update.pdf'),
        attachmentOriginalName: fakeFile.originalname,
        attachmentBuffer: fakeFile.buffer,
        attachmentMimetype: fakeFile.mimetype,
        attachmentSize: fakeFile.size,
      });
    });

    it('should update incident without file', async () => {
      (service.update as jest.Mock).mockResolvedValue(mockIncident);

      const res = await controller.updateWithAttachment(
        'IN1',
        mockIncidentDto,
        undefined as any,
      );

      expect(res).toEqual(mockIncident);
      expect(service.update).toHaveBeenCalledWith('IN1', mockIncidentDto);
    });

    it('should clean up file on error in development mode', async () => {
      process.env.NODE_ENV = 'development';
      (service.update as jest.Mock).mockRejectedValue(new Error('DB error'));

      const fakeFile = {
        path: './uploads/incident_attachments/x.pdf',
      } as any;

      // Create directory and file for test
      const dir = './uploads/incident_attachments';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fakeFile.path, 'test content');

      const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

      await expect(
        controller.updateWithAttachment('IN1', mockIncidentDto, fakeFile),
      ).rejects.toThrow();

      expect(unlinkSpy).toHaveBeenCalledWith(fakeFile.path);

      unlinkSpy.mockRestore();
      // Clean up
      if (fs.existsSync(fakeFile.path)) {
        fs.unlinkSync(fakeFile.path);
      }
    });

    it('should NOT clean up file on error in production mode', async () => {
      process.env.NODE_ENV = 'production';
      (service.update as jest.Mock).mockRejectedValue(new Error('DB error'));

      const fakeFile = {
        buffer: Buffer.from('x'),
      } as any;

      const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

      await expect(
        controller.updateWithAttachment('IN1', mockIncidentDto, fakeFile),
      ).rejects.toThrow();

      expect(unlinkSpy).not.toHaveBeenCalled();

      unlinkSpy.mockRestore();
    });

    it('should propagate NotFoundException', async () => {
      (service.update as jest.Mock).mockRejectedValue(new NotFoundException('Incident not found'));

      await expect(
        controller.updateWithAttachment('IN999', mockIncidentDto, undefined as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException', async () => {
      (service.update as jest.Mock).mockRejectedValue(new BadRequestException('Invalid data'));

      await expect(
        controller.updateWithAttachment('IN1', mockIncidentDto, undefined as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should wrap generic errors as InternalServerError', async () => {
      (service.update as jest.Mock).mockRejectedValue(new Error('Generic error'));

      await expect(
        controller.updateWithAttachment('IN1', mockIncidentDto, undefined as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should NOT emit socket events when io=null', async () => {
      const originalIo = require('../../main').io;
      (require('../../main').io as any) = null;

      (service.update as jest.Mock).mockResolvedValue(mockIncident);

      const res = await controller.updateWithAttachment(
        'IN1',
        mockIncidentDto,
        undefined as any,
      );

      expect(res).toEqual(mockIncident);
      expect(io.emit).not.toHaveBeenCalled();

      (require('../../main').io as any) = originalIo;
    });
  });

  // ---------------------------------------------------------
  // UPDATE - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('update', () => {
    it('should update incident and emit events', async () => {
      (service.update as jest.Mock).mockResolvedValue(mockIncident);

      const res = await controller.update('IN1', mockIncidentDto);

      expect(res).toEqual(mockIncident);
      expect(service.update).toHaveBeenCalledWith('IN1', mockIncidentDto);
      expect(io.emit).toHaveBeenCalledWith('incident_updated', { incident: mockIncident });
      expect(io.to).toHaveBeenCalledWith(`user_${mockIncident.handler}`);
    });

    it('should update incident without emitting to handler when handler is null', async () => {
      const noHandlerIncident = { ...mockIncident, handler: null };
      (service.update as jest.Mock).mockResolvedValue(noHandlerIncident);

      const res = await controller.update('IN1', { ...mockIncidentDto, handler: null });

      expect(res).toEqual(noHandlerIncident);
      expect(io.emit).toHaveBeenCalled();
      expect((io.to as jest.Mock).mock.calls.some(call => call[0] === 'user_null')).toBe(false);
    });

    it('should propagate NotFoundException', async () => {
      (service.update as jest.Mock).mockRejectedValue(new NotFoundException('Incident not found'));
      
      await expect(controller.update('IN999', mockIncidentDto)).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException', async () => {
      (service.update as jest.Mock).mockRejectedValue(new BadRequestException('Invalid data'));
      
      await expect(controller.update('IN1', {} as any)).rejects.toThrow(BadRequestException);
    });

    it('should propagate InternalServerErrorException', async () => {
      (service.update as jest.Mock).mockRejectedValue(
        new InternalServerErrorException('Service error'),
      );
      
      await expect(controller.update('IN1', mockIncidentDto)).rejects.toThrow(InternalServerErrorException);
    });

    it('should NOT emit socket events when io = null', async () => {
      const originalIo = require('../../main').io;
      (require('../../main').io as any) = null;

      (service.update as jest.Mock).mockResolvedValue(mockIncident);

      const res = await controller.update('IN1', mockIncidentDto);

      expect(res).toEqual(mockIncident);
      expect(io.emit).not.toHaveBeenCalled();
      expect(io.to).not.toHaveBeenCalled();

      (require('../../main').io as any) = originalIo;
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { description: 'Updated description' };
      const updatedIncident = { ...mockIncident, ...partialUpdate };
      (service.update as jest.Mock).mockResolvedValue(updatedIncident);

      const res = await controller.update('IN1', partialUpdate as any);

      expect(res).toEqual(updatedIncident);
      expect(service.update).toHaveBeenCalledWith('IN1', partialUpdate);
    });
  });

  // ---------------------------------------------------------
  // GET INCIDENT BY NUMBER - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('getIncidentByNumber', () => {
    it('should return incident by number', async () => {
      (service.getIncidentByNumber as jest.Mock).mockResolvedValue(mockIncident);
      const res = await controller.getIncidentByNumber('IN1');

      expect(res).toEqual(mockIncident);
      expect(service.getIncidentByNumber).toHaveBeenCalledWith('IN1');
    });

    it('should propagate NotFoundException', async () => {
      (service.getIncidentByNumber as jest.Mock).mockRejectedValue(
        new NotFoundException('Incident not found'),
      );
      
      await expect(controller.getIncidentByNumber('INVALID')).rejects.toThrow(NotFoundException);
    });

    it('should propagate other errors', async () => {
      (service.getIncidentByNumber as jest.Mock).mockRejectedValue(
        new InternalServerErrorException('Service error'),
      );
      
      await expect(controller.getIncidentByNumber('IN1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ---------------------------------------------------------
  // GET INCIDENT HISTORY - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('getIncidentHistory', () => {
    it('should return incident history', async () => {
      const hist = [{ note: 'created' }, { note: 'updated' }];
      (service.getIncidentHistory as jest.Mock).mockResolvedValue(hist);

      const res = await controller.getIncidentHistory('IN1');
      
      expect(res).toEqual(hist);
      expect(service.getIncidentHistory).toHaveBeenCalledWith('IN1');
    });

    it('should return empty history', async () => {
      (service.getIncidentHistory as jest.Mock).mockResolvedValue([]);
      const res = await controller.getIncidentHistory('IN1');
      
      expect(res).toEqual([]);
    });

    it('should propagate errors', async () => {
      (service.getIncidentHistory as jest.Mock).mockRejectedValue(
        new InternalServerErrorException('History error'),
      );

      await expect(controller.getIncidentHistory('IN1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ---------------------------------------------------------
  // GET INCIDENTS BY MAIN CATEGORY CODE - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('getIncidentsByMainCategoryCode', () => {
    it('should return incidents by main category', async () => {
      (service.getIncidentsByMainCategoryCode as jest.Mock).mockResolvedValue([mockIncident]);

      const res = await controller.getIncidentsByMainCategoryCode('MAIN1');

      expect(res).toEqual([mockIncident]);
      expect(service.getIncidentsByMainCategoryCode).toHaveBeenCalledWith('MAIN1');
    });

    it('should return empty array for category with no incidents', async () => {
      (service.getIncidentsByMainCategoryCode as jest.Mock).mockResolvedValue([]);

      const res = await controller.getIncidentsByMainCategoryCode('EMPTY_CAT');
      
      expect(res).toEqual([]);
    });

    it('should propagate NotFoundException', async () => {
      (service.getIncidentsByMainCategoryCode as jest.Mock).mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await expect(
        controller.getIncidentsByMainCategoryCode('INVALID'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should wrap generic errors as InternalServerError', async () => {
      (service.getIncidentsByMainCategoryCode as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.getIncidentsByMainCategoryCode('MAIN1'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ---------------------------------------------------------
  // SOCKET TEST ENDPOINTS - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('socket tests', () => {
    it('testSocket should emit incident creation events', () => {
      const res = controller.testSocket();
      
      expect(res.message).toContain('Test socket events emitted successfully');
      expect(io.emit).toHaveBeenCalledWith('incident_created', expect.any(Object));
      expect(io.to).toHaveBeenCalledWith(expect.stringContaining('user_'));
    });

    it('testSocketUpdate should emit incident update events', () => {
      const res = controller.testSocketUpdate();
      
      expect(res.message).toContain('Test socket update events emitted successfully');
      expect(io.emit).toHaveBeenCalledWith('incident_updated', expect.any(Object));
      expect(io.to).toHaveBeenCalledWith(expect.stringContaining('user_'));
    });

    it('testSocketClosure should emit incident closure events', () => {
      const res = controller.testSocketClosure();
      
      expect(res.message).toContain('Test socket closure events emitted successfully');
      expect(io.emit).toHaveBeenCalledWith('incident_updated', expect.any(Object));
      expect(io.to).toHaveBeenCalledWith(expect.stringContaining('user_'));
      expect(io.emit).toHaveBeenCalledWith('incident_closed_admin_notification', expect.any(Object));
    });

    it('socket test endpoints should work when io is null', () => {
      const originalIo = require('../../main').io;
      (require('../../main').io as any) = null;

      const res1 = controller.testSocket();
      const res2 = controller.testSocketUpdate();
      const res3 = controller.testSocketClosure();

      expect(res1.message).toContain('Test socket events emitted successfully');
      expect(res2.message).toContain('Test socket update events emitted successfully');
      expect(res3.message).toContain('Test socket closure events emitted successfully');

      (require('../../main').io as any) = originalIo;
    });
  });

  // ---------------------------------------------------------
  // DOWNLOAD ATTACHMENT - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('downloadAttachment', () => {
    let mockRes: Partial<Response>;

    beforeEach(() => {
      mockRes = {
        setHeader: jest.fn(),
        sendFile: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
    });

    it('should download existing file', () => {
      const fileName = 'test.pdf';
      const filePath = path.join('./uploads/incident_attachments', fileName);
      
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(path, 'join').mockReturnValue(filePath);

      controller.downloadAttachment(fileName, mockRes as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/octet-stream',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      expect(mockRes.sendFile).toHaveBeenCalledWith(filePath);

      (fs.existsSync as jest.Mock).mockRestore();
      (path.join as jest.Mock).mockRestore();
    });

    it('should throw BadRequestException when file does not exist', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      expect(() =>
        controller.downloadAttachment('missing.pdf', mockRes as Response),
      ).toThrow(BadRequestException);

      (fs.existsSync as jest.Mock).mockRestore();
    });

    it('should throw BadRequestException when file system error occurs', () => {
      jest.spyOn(fs, 'existsSync').mockImplementation(() => {
        throw new Error('File system error');
      });

      expect(() =>
        controller.downloadAttachment('error.pdf', mockRes as Response),
      ).toThrow(BadRequestException);

      (fs.existsSync as jest.Mock).mockRestore();
    });

    it('should handle filenames with special characters', () => {
      const fileName = 'test with spaces & special chars.pdf';
      const filePath = path.join('./uploads/incident_attachments', fileName);
      
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(path, 'join').mockReturnValue(filePath);

      controller.downloadAttachment(fileName, mockRes as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );

      (fs.existsSync as jest.Mock).mockRestore();
      (path.join as jest.Mock).mockRestore();
    });
  });

  // ---------------------------------------------------------
  // UPLOAD ATTACHMENT - ENHANCED COVERAGE
  // ---------------------------------------------------------
  describe('uploadAttachment', () => {
    it('should throw BadRequestException when no file provided', async () => {
      await expect(controller.uploadAttachment(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when file is null', async () => {
      await expect(controller.uploadAttachment(null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle file upload in production mode', async () => {
      process.env.NODE_ENV = 'production';

      const file = {
        originalname: 'abc.pdf',
        buffer: Buffer.from('test content'),
        mimetype: 'application/pdf',
        size: 111,
      } as any;

      const res = await controller.uploadAttachment(file);

      expect(res.success).toBe(true);
      expect(res.filename).toContain('abc.pdf');
      expect(res.originalName).toBe(file.originalname);
      expect(res.buffer).toEqual(file.buffer);
      expect(res.mimetype).toBe(file.mimetype);
      expect(res.size).toBe(file.size);
    });

    it('should handle file upload in development mode', async () => {
      process.env.NODE_ENV = 'development';

      const file = {
        originalname: 'abc.pdf',
        filename: '123-abc.pdf',
        size: 100,
        mimetype: 'application/pdf',
        path: '/tmp/abc.pdf',
      } as any;

      const res = await controller.uploadAttachment(file);

      expect(res.success).toBe(true);
      expect(res.filename).toBe(file.filename);
      expect(res.originalName).toBe(file.originalname);
      expect(res.path).toBe(file.path);
      expect(res.size).toBe(file.size);
    });

    it('should handle file upload with different file types', async () => {
      process.env.NODE_ENV = 'production';

      const testFiles = [
        { originalname: 'image.png', mimetype: 'image/png' },
        { originalname: 'image.jpg', mimetype: 'image/jpeg' },
        { originalname: 'image.jpeg', mimetype: 'image/jpeg' },
      ];

      for (const fileInfo of testFiles) {
        const file = {
          ...fileInfo,
          buffer: Buffer.from('test'),
          size: 100,
        } as any;

        const res = await controller.uploadAttachment(file);

        expect(res.success).toBe(true);
        expect(res.originalName).toBe(fileInfo.originalname);
      }
    });
  });

  // ---------------------------------------------------------
  // EDGE CASES AND ERROR SCENARIOS
  // ---------------------------------------------------------
  describe('edge cases and error scenarios', () => {
    it('should handle database connection errors', async () => {
      (service.getAll as jest.Mock).mockRejectedValue(
        new InternalServerErrorException('Database connection failed'),
      );

      await expect(controller.getAll()).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle validation errors in service layer', async () => {
      const invalidDto = { ...mockIncidentDto, priority: 'INVALID_PRIORITY' };
      
      (service.create as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid priority value'),
      );

      await expect(controller.create(invalidDto as any)).rejects.toThrow(BadRequestException);
    });

    it('should handle malformed incident numbers', async () => {
      (service.getIncidentByNumber as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid incident number format'),
      );

      await expect(controller.getIncidentByNumber('INVALID_FORMAT')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle getByCategory with special characters', async () => {
      (service.getByCategory as jest.Mock).mockResolvedValue([mockIncident]);
      
      const res = await controller.getByCategory('TEAM-1 with spaces');
      
      expect(res).toEqual([mockIncident]);
      expect(service.getByCategory).toHaveBeenCalledWith('TEAM-1 with spaces');
    });

    it('should handle getIncidentHistory with non-existent incident', async () => {
      (service.getIncidentHistory as jest.Mock).mockRejectedValue(
        new NotFoundException('Incident not found'),
      );

      await expect(controller.getIncidentHistory('NON_EXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------
  // ADDITIONAL FILE VALIDATION TESTS
  // ---------------------------------------------------------
  describe('createIncidentWithAttachment - file validation', () => {
    it('should reject files exceeding size limit', async () => {
      const largeFile = {
        originalname: 'large.pdf',
        buffer: Buffer.alloc(2 * 1024 * 1024), // 2MB
        mimetype: 'application/pdf',
        size: 2 * 1024 * 1024,
      } as any;

      await expect(
        controller.createIncidentWithAttachment(mockIncidentDto, largeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid mime type', async () => {
      const invalidFile = {
        originalname: 'script.exe',
        buffer: Buffer.from('test'),
        mimetype: 'application/x-msdownload',
        size: 100,
      } as any;

      await expect(
        controller.createIncidentWithAttachment(mockIncidentDto, invalidFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject file with undefined mimetype', async () => {
      const noMimetypeFile = {
        originalname: 'unknown.file',
        buffer: Buffer.from('test'),
        mimetype: undefined,
        size: 100,
      } as any;

      await expect(
        controller.createIncidentWithAttachment(mockIncidentDto, noMimetypeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject file with null mimetype', async () => {
      const nullMimetypeFile = {
        originalname: 'unknown.file',
        buffer: Buffer.from('test'),
        mimetype: null,
        size: 100,
      } as any;

      await expect(
        controller.createIncidentWithAttachment(mockIncidentDto, nullMimetypeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid PDF file', async () => {
      process.env.NODE_ENV = 'production';
      const validFile = {
        originalname: 'document.pdf',
        buffer: Buffer.from('test'),
        mimetype: 'application/pdf',
        size: 500,
      } as any;

      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      const res = await controller.createIncidentWithAttachment(mockIncidentDto, validFile);

      expect(res).toEqual(mockIncident);
      expect(service.create).toHaveBeenCalled();
    });

    it('should accept valid PNG file', async () => {
      process.env.NODE_ENV = 'production';
      const validFile = {
        originalname: 'image.png',
        buffer: Buffer.from('test'),
        mimetype: 'image/png',
        size: 500,
      } as any;

      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      const res = await controller.createIncidentWithAttachment(mockIncidentDto, validFile);

      expect(res).toEqual(mockIncident);
      expect(service.create).toHaveBeenCalled();
    });

    it('should accept valid JPG file', async () => {
      process.env.NODE_ENV = 'production';
      const validFile = {
        originalname: 'image.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpg',
        size: 500,
      } as any;

      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      const res = await controller.createIncidentWithAttachment(mockIncidentDto, validFile);

      expect(res).toEqual(mockIncident);
      expect(service.create).toHaveBeenCalled();
    });

    it('should accept valid JPEG file', async () => {
      process.env.NODE_ENV = 'production';
      const validFile = {
        originalname: 'image.jpeg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        size: 500,
      } as any;

      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      const res = await controller.createIncidentWithAttachment(mockIncidentDto, validFile);

      expect(res).toEqual(mockIncident);
      expect(service.create).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------
  // UPDATE WITH ATTACHMENT - FILE VALIDATION TESTS
  // ---------------------------------------------------------
  describe('updateWithAttachment - file validation', () => {
    it('should reject files exceeding size limit', async () => {
      const largeFile = {
        originalname: 'large.pdf',
        buffer: Buffer.alloc(2 * 1024 * 1024), // 2MB
        mimetype: 'application/pdf',
        size: 2 * 1024 * 1024,
      } as any;

      await expect(
        controller.updateWithAttachment('IN1', mockIncidentDto, largeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid mime type', async () => {
      const invalidFile = {
        originalname: 'malware.exe',
        buffer: Buffer.from('test'),
        mimetype: 'application/x-executable',
        size: 100,
      } as any;

      await expect(
        controller.updateWithAttachment('IN1', mockIncidentDto, invalidFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject file with no mimetype', async () => {
      const noMimetypeFile = {
        originalname: 'unknown.file',
        buffer: Buffer.from('test'),
        mimetype: undefined,
        size: 100,
      } as any;

      await expect(
        controller.updateWithAttachment('IN1', mockIncidentDto, noMimetypeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid file and update incident', async () => {
      process.env.NODE_ENV = 'production';
      const validFile = {
        originalname: 'update.pdf',
        buffer: Buffer.from('test'),
        mimetype: 'application/pdf',
        size: 500,
      } as any;

      (service.update as jest.Mock).mockResolvedValue(mockIncident);

      const res = await controller.updateWithAttachment('IN1', mockIncidentDto, validFile);

      expect(res).toEqual(mockIncident);
      expect(service.update).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------
  // UPLOAD ATTACHMENT - EXTENDED VALIDATION TESTS
  // ---------------------------------------------------------
  describe('uploadAttachment - extended validation', () => {
    it('should reject files exceeding size limit', async () => {
      const largeFile = {
        originalname: 'huge.pdf',
        buffer: Buffer.alloc(2 * 1024 * 1024), // 2MB
        mimetype: 'application/pdf',
        size: 2 * 1024 * 1024,
      } as any;

      await expect(controller.uploadAttachment(largeFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject unsupported file types', async () => {
      const unsupportedTypes = [
        { originalname: 'script.exe', mimetype: 'application/x-msdownload' },
        { originalname: 'script.sh', mimetype: 'application/x-sh' },
        { originalname: 'page.html', mimetype: 'text/html' },
        { originalname: 'app.apk', mimetype: 'application/vnd.android.package-archive' },
      ];

      for (const fileInfo of unsupportedTypes) {
        const file = {
          ...fileInfo,
          buffer: Buffer.from('test'),
          size: 100,
        } as any;

        await expect(controller.uploadAttachment(file)).rejects.toThrow(
          BadRequestException,
        );
      }
    });

    it('should reject file with empty mimetype', async () => {
      const emptyMimetypeFile = {
        originalname: 'file.txt',
        buffer: Buffer.from('test'),
        mimetype: '',
        size: 100,
      } as any;

      await expect(controller.uploadAttachment(emptyMimetypeFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept all supported image formats', async () => {
      process.env.NODE_ENV = 'production';

      const supportedFormats = [
        { originalname: 'doc.pdf', mimetype: 'application/pdf' },
        { originalname: 'img.png', mimetype: 'image/png' },
        { originalname: 'photo.jpg', mimetype: 'image/jpg' },
        { originalname: 'pic.jpeg', mimetype: 'image/jpeg' },
      ];

      for (const fileInfo of supportedFormats) {
        const file = {
          ...fileInfo,
          buffer: Buffer.from('test'),
          size: 500,
        } as any;

        const res = await controller.uploadAttachment(file);

        expect(res.success).toBe(true);
        expect(res.originalName).toBe(fileInfo.originalname);
      }
    });

    it('should handle files at exact size limit', async () => {
      process.env.NODE_ENV = 'production';

      const exactLimitFile = {
        originalname: 'exact.pdf',
        buffer: Buffer.alloc(1024 * 1024), // Exactly 1MB
        mimetype: 'application/pdf',
        size: 1024 * 1024,
      } as any;

      const res = await controller.uploadAttachment(exactLimitFile);

      expect(res.success).toBe(true);
      expect(res.size).toBe(1024 * 1024);
    });

    it('should reject files just over size limit', async () => {
      const overLimitFile = {
        originalname: 'overlimit.pdf',
        buffer: Buffer.alloc(1024 * 1024 + 1), // 1MB + 1 byte
        mimetype: 'application/pdf',
        size: 1024 * 1024 + 1,
      } as any;

      await expect(controller.uploadAttachment(overLimitFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ---------------------------------------------------------
  // GETBYCATEGORY - EXTENDED ERROR HANDLING
  // ---------------------------------------------------------
  describe('getByCategory - extended error handling', () => {
    it('should propagate NotFoundException without wrapping', async () => {
      const notFoundError = new NotFoundException('Category not found');
      (service.getByCategory as jest.Mock).mockRejectedValue(notFoundError);

      await expect(controller.getByCategory('INVALID_CATEGORY')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getByCategory('INVALID_CATEGORY')).rejects.toThrow(
        'Category not found',
      );
    });

    it('should wrap Error instances with message', async () => {
      (service.getByCategory as jest.Mock).mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(controller.getByCategory('TEAM1')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(controller.getByCategory('TEAM1')).rejects.toThrow(
        /Connection timeout/,
      );
    });

    it('should handle non-Error objects', async () => {
      (service.getByCategory as jest.Mock).mockRejectedValue('String error');

      await expect(controller.getByCategory('TEAM1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle null/undefined errors', async () => {
      (service.getByCategory as jest.Mock).mockRejectedValue(null);

      await expect(controller.getByCategory('TEAM1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------
  // UPDATE - SOCKET EMISSION TESTS
  // ---------------------------------------------------------
  describe('update - socket emission variations', () => {
    it('should emit to handler when handler is present', async () => {
      (service.update as jest.Mock).mockResolvedValue(mockIncident);

      await controller.update('IN1', mockIncidentDto);

      expect(io.to).toHaveBeenCalledWith(`user_${mockIncident.handler}`);
    });

    it('should not emit to handler when handler is empty string', async () => {
      const incidentNoHandler = { ...mockIncident, handler: '' };
      (service.update as jest.Mock).mockResolvedValue(incidentNoHandler);

      await controller.update('IN1', mockIncidentDto);

      expect(io.emit).toHaveBeenCalledWith('incident_updated', { incident: incidentNoHandler });
      // Should not call io.to with empty handler
      const toCalls = (io.to as jest.Mock).mock.calls;
      const emptyHandlerCalls = toCalls.filter(call => call[0] === 'user_');
      expect(emptyHandlerCalls.length).toBe(0);
    });
  });

  // ---------------------------------------------------------
  // DOWNLOAD ATTACHMENT - ADDITIONAL EDGE CASES
  // ---------------------------------------------------------
  describe('downloadAttachment - additional edge cases', () => {
    let mockRes: any;

    beforeEach(() => {
      mockRes = {
        setHeader: jest.fn(),
        sendFile: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
    });

    it('should handle very long filenames', () => {
      const longFilename = 'a'.repeat(255) + '.pdf';
      const filePath = path.join('./uploads/incident_attachments', longFilename);

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(path, 'join').mockReturnValue(filePath);

      controller.downloadAttachment(longFilename, mockRes);

      expect(mockRes.sendFile).toHaveBeenCalledWith(filePath);

      (fs.existsSync as jest.Mock).mockRestore();
      (path.join as jest.Mock).mockRestore();
    });

    it('should handle filenames with unicode characters', () => {
      const unicodeFilename = '文件名称测试.pdf';
      const filePath = path.join('./uploads/incident_attachments', unicodeFilename);

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(path, 'join').mockReturnValue(filePath);

      controller.downloadAttachment(unicodeFilename, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="${unicodeFilename}"`,
      );

      (fs.existsSync as jest.Mock).mockRestore();
      (path.join as jest.Mock).mockRestore();
    });
  });

  // ---------------------------------------------------------
  // CREATE INCIDENT - HANDLER EDGE CASES
  // ---------------------------------------------------------
  describe('create - handler edge cases', () => {
    it('should handle handler with special characters', async () => {
      const specialHandlerIncident = { ...mockIncident, handler: 'SV-001_TEST' };
      (service.create as jest.Mock).mockResolvedValue(specialHandlerIncident);

      const res = await controller.create({ ...mockIncidentDto, handler: 'SV-001_TEST' });

      expect(res).toEqual(specialHandlerIncident);
      expect(io.to).toHaveBeenCalledWith('user_SV-001_TEST');
    });

    it('should handle very long handler IDs', async () => {
      const longHandler = 'SV' + '1'.repeat(100);
      const longHandlerIncident = { ...mockIncident, handler: longHandler };
      (service.create as jest.Mock).mockResolvedValue(longHandlerIncident);

      const res = await controller.create({ ...mockIncidentDto, handler: longHandler });

      expect(res).toEqual(longHandlerIncident);
      expect(io.to).toHaveBeenCalledWith(`user_${longHandler}`);
    });
  });

  // ---------------------------------------------------------
  // GETALل - ADDITIONAL SCENARIOS
  // ---------------------------------------------------------
  describe('getAll - additional scenarios', () => {
    it('should return large arrays of incidents', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        ...mockIncident,
        incident_number: `IN${i}`,
      }));

      (service.getAll as jest.Mock).mockResolvedValue(largeArray);

      const res = await controller.getAll();

      expect(res).toHaveLength(1000);
      expect(res[0].incident_number).toBe('IN0');
      expect(res[999].incident_number).toBe('IN999');
    });
  });

  // ---------------------------------------------------------
  // GETDASHBOARDSTATS - ADDITIONAL SCENARIOS
  // ---------------------------------------------------------
  describe('getDashboardStats - query parameter combinations', () => {
    it('should handle only userType parameter', async () => {
      const stats = { open: 10, closed: 5 };
      (service.getDashboardStats as jest.Mock).mockResolvedValue(stats);

      const res = await controller.getDashboardStats('admin', undefined, undefined, undefined);

      expect(res).toEqual(stats);
      expect(service.getDashboardStats).toHaveBeenCalledWith({
        userType: 'admin',
        technicianServiceNum: undefined,
        teamName: undefined,
        adminServiceNum: undefined,
      });
    });

    it('should handle only technicianServiceNum parameter', async () => {
      const stats = { assigned: 15 };
      (service.getDashboardStats as jest.Mock).mockResolvedValue(stats);

      const res = await controller.getDashboardStats(undefined, 'SV001', undefined, undefined);

      expect(res).toEqual(stats);
      expect(service.getDashboardStats).toHaveBeenCalledWith({
        userType: undefined,
        technicianServiceNum: 'SV001',
        teamName: undefined,
        adminServiceNum: undefined,
      });
    });
  });

  // ---------------------------------------------------------
  // COMPREHENSIVE METHOD COVERAGE
  // ---------------------------------------------------------
  describe('comprehensive method coverage', () => {
    it('should cover getAll basic flow', async () => {
      const incidents = [mockIncident, { ...mockIncident, incident_number: 'IN2' }];
      (service.getAll as jest.Mock).mockResolvedValue(incidents);

      const result = await controller.getAll();

      expect(result).toEqual(incidents);
      expect(result.length).toBe(2);
    });

    it('should cover getIncidentByNumber success case', async () => {
      (service.getIncidentByNumber as jest.Mock).mockResolvedValue(mockIncident);

      const result = await controller.getIncidentByNumber('IN1');

      expect(result).toEqual(mockIncident);
    });

    it('should cover getIncidentHistory success path', async () => {
      const history = [{ id: 1, incidentId: 'IN1', change: 'Status updated' }];
      (service.getIncidentHistory as jest.Mock).mockResolvedValue(history);

      const result = await controller.getIncidentHistory('IN1');

      expect(result).toEqual(history);
    });

    it('should cover testSocketUpdate success path', async () => {
      await controller.testSocketUpdate();

      expect(io.emit).toHaveBeenCalled();
    });

    it('should cover testSocketClosure success path', async () => {
      await controller.testSocketClosure();

      expect(io.emit).toHaveBeenCalled();
    });

  });

  // ---------------------------------------------------------
  // FILE UPLOAD ERROR BOUNDARY TESTING
  // ---------------------------------------------------------
  describe('file upload error boundaries', () => {
    it('should handle createIncidentWithAttachment with zero-byte file', async () => {
      const zeroByteFile = {
        originalname: 'empty.pdf',
        buffer: Buffer.alloc(0),
        mimetype: 'application/pdf',
        size: 0,
      } as any;

      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      const result = await controller.createIncidentWithAttachment(
        mockIncidentDto,
        zeroByteFile,
      );

      expect(result).toBeDefined();
    });

    it('should handle updateWithAttachment with maximum allowed size', async () => {
      const maxSizeFile = {
        originalname: 'max.pdf',
        buffer: Buffer.alloc(1024 * 1024),
        mimetype: 'application/pdf',
        size: 1024 * 1024,
      } as any;

      (service.update as jest.Mock).mockResolvedValue(mockIncident);

      const result = await controller.updateWithAttachment(
        'IN1',
        mockIncidentDto,
        maxSizeFile,
      );

      expect(result).toBeDefined();
    });

    it('should handle uploadAttachment with file missing originalname', async () => {
      const noNameFile = {
        originalname: '',
        buffer: Buffer.from('test'),
        mimetype: 'application/pdf',
        size: 500,
      } as any;

      const result = await controller.uploadAttachment(noNameFile);

      expect(result).toBeDefined();
      expect(result.originalName).toBe('');
    });
  });

  // ---------------------------------------------------------
  // SOCKET EVENT EMISSION COVERAGE
  // ---------------------------------------------------------
  describe('socket event emission coverage', () => {
    it('should emit incident_created with correct data structure', async () => {
      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      await controller.create(mockIncidentDto);

      expect(io.emit).toHaveBeenCalledWith('incident_created', { incident: mockIncident });
    });

    it('should emit incident_updated with handler notification', async () => {
      (service.update as jest.Mock).mockResolvedValue(mockIncident);

      await controller.update('IN1', mockIncidentDto);

      expect(io.emit).toHaveBeenCalledWith('incident_updated', { incident: mockIncident });
      expect(io.to).toHaveBeenCalledWith(`user_${mockIncident.handler}`);
    });
  });

  // ---------------------------------------------------------
  // DOWNLOAD ATTACHMENT PATH HANDLING
  // ---------------------------------------------------------
  describe('downloadAttachment - path handling', () => {
    let mockRes: any;

    beforeEach(() => {
      mockRes = {
        setHeader: jest.fn(),
        sendFile: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
    });

    it('should construct correct file path for standard filename', () => {
      const filename = 'document.pdf';

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      controller.downloadAttachment(filename, mockRes);

      expect(mockRes.sendFile).toHaveBeenCalled();
      expect(mockRes.sendFile.mock.calls[0][0]).toContain('incident_attachments');
      expect(mockRes.sendFile.mock.calls[0][0]).toContain('document.pdf');

      (fs.existsSync as jest.Mock).mockRestore();
    });

    it('should handle filenames with dots', () => {
      const filename = 'file.name.with.dots.pdf';

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      controller.downloadAttachment(filename, mockRes);

      expect(mockRes.sendFile).toHaveBeenCalled();
      expect(mockRes.sendFile.mock.calls[0][0]).toContain('file.name.with.dots.pdf');

      (fs.existsSync as jest.Mock).mockRestore();
    });

    it('should handle filenames with spaces', () => {
      const filename = 'my document file.pdf';

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      controller.downloadAttachment(filename, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );

      (fs.existsSync as jest.Mock).mockRestore();
    });
  });

  // ---------------------------------------------------------
  // ADDITIONAL BOUNDARY CONDITIONS
  // ---------------------------------------------------------
  describe('boundary conditions', () => {
    it('should handle create with valid DTO', async () => {
      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      const result = await controller.create(mockIncidentDto);

      expect(result).toBeDefined();
      expect(result.incident_number).toBe('IN1');
    });

    it('should handle update with valid DTO', async () => {
      (service.update as jest.Mock).mockResolvedValue(mockIncident);

      const result = await controller.update('IN1', mockIncidentDto);

      expect(result).toBeDefined();
      expect(result.incident_number).toBe('IN1');
    });
  });

  // ---------------------------------------------------------
  // FILE TYPE VALIDATION COMPREHENSIVE
  // ---------------------------------------------------------
  describe('file type validation comprehensive', () => {
    const testAllMimeTypes = async (methodName: string) => {
      const validMimeTypes = [
        'application/pdf',
        'image/png',
        'image/jpg',
        'image/jpeg',
      ];

      for (const mimetype of validMimeTypes) {
        const file = {
          originalname: `test.${mimetype.split('/')[1]}`,
          buffer: Buffer.from('test'),
          mimetype,
          size: 500,
        } as any;

        let result;
        if (methodName === 'create') {
          (service.create as jest.Mock).mockResolvedValue(mockIncident);
          result = await controller.createIncidentWithAttachment(mockIncidentDto, file);
        } else if (methodName === 'update') {
          (service.update as jest.Mock).mockResolvedValue(mockIncident);
          result = await controller.updateWithAttachment('IN1', mockIncidentDto, file);
        } else if (methodName === 'upload') {
          result = await controller.uploadAttachment(file);
        }

        expect(result).toBeDefined();
      }
    };

    it('should accept all valid mime types in createIncidentWithAttachment', async () => {
      await testAllMimeTypes('create');
    });

    it('should accept all valid mime types in updateWithAttachment', async () => {
      await testAllMimeTypes('update');
    });

    it('should accept all valid mime types in uploadAttachment', async () => {
      await testAllMimeTypes('upload');
    });
  });

  // ---------------------------------------------------------
  // ERROR PROPAGATION TESTS
  // ---------------------------------------------------------
  describe('error propagation', () => {
    it('should propagate BadRequestException from create', async () => {
      (service.create as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(controller.create(mockIncidentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate NotFoundException from update', async () => {
      (service.update as jest.Mock).mockRejectedValue(
        new NotFoundException('Incident not found'),
      );

      await expect(controller.update('IN1', mockIncidentDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------
  // ADDITIONAL COVERAGE TESTS
  // ---------------------------------------------------------
  describe('additional coverage tests', () => {
    it('should handle getAssignedToMe with valid service number variations', async () => {
      const serviceNumbers = ['SV001', 'SV-001', 'SERVICE_001', 'S1'];
      
      for (const serviceNum of serviceNumbers) {
        (service.getAssignedToMe as jest.Mock).mockResolvedValue([mockIncident]);
        
        const result = await controller.getAssignedToMe(serviceNum);
        
        expect(result).toEqual([mockIncident]);
        expect(service.getAssignedToMe).toHaveBeenCalledWith(serviceNum);
      }
    });

    it('should handle getAssignedByMe with valid service number variations', async () => {
      const serviceNumbers = ['SV001', 'SV-002', 'SERVICE_002'];
      
      for (const serviceNum of serviceNumbers) {
        (service.getAssignedByMe as jest.Mock).mockResolvedValue([mockIncident]);
        
        const result = await controller.getAssignedByMe(serviceNum);
        
        expect(result).toEqual([mockIncident]);
        expect(service.getAssignedByMe).toHaveBeenCalledWith(serviceNum);
      }
    });





    it('should handle getDashboardStats with all permutations', async () => {
      const stats = { open: 10, closed: 5, inProgress: 3 };
      (service.getDashboardStats as jest.Mock).mockResolvedValue(stats);

      // All parameters
      await controller.getDashboardStats('admin', 'SV001', 'TEAM-1', 'ADM001');
      expect(service.getDashboardStats).toHaveBeenCalledWith({
        userType: 'admin',
        technicianServiceNum: 'SV001',
        teamName: 'TEAM-1',
        adminServiceNum: 'ADM001',
      });

      // Mixed undefined parameters
      await controller.getDashboardStats('user', undefined, undefined, 'ADM002');
      expect(service.getDashboardStats).toHaveBeenCalledWith({
        userType: 'user',
        technicianServiceNum: undefined,
        teamName: undefined,
        adminServiceNum: 'ADM002',
      });
    });

    it('should handle createIncidentWithAttachment with various file sizes', async () => {
      const fileSizes = [1, 100, 1000, 10000, 100000, 500000, 1024 * 1024];
      
      for (const size of fileSizes) {
        const file = {
          originalname: `test_${size}.pdf`,
          buffer: Buffer.alloc(size),
          mimetype: 'application/pdf',
          size,
        } as any;

        (service.create as jest.Mock).mockResolvedValue(mockIncident);

        const result = await controller.createIncidentWithAttachment(mockIncidentDto, file);
        
        expect(result).toBeDefined();
      }
    });

    it('should handle updateWithAttachment with various scenarios', async () => {
      const scenarios = [
        { size: 1, mimetype: 'application/pdf' },
        { size: 500000, mimetype: 'image/png' },
        { size: 1024 * 1024, mimetype: 'image/jpeg' },
      ];

      for (const scenario of scenarios) {
        const file = {
          originalname: 'test.pdf',
          buffer: Buffer.alloc(scenario.size),
          mimetype: scenario.mimetype,
          size: scenario.size,
        } as any;

        (service.update as jest.Mock).mockResolvedValue(mockIncident);

        const result = await controller.updateWithAttachment('IN1', mockIncidentDto, file);
        
        expect(result).toBeDefined();
      }
    });

    it('should handle uploadAttachment with boundary sizes', async () => {
      const boundarySizes = [
        1,                    // Minimum
        1024,                 // 1KB
        10240,                // 10KB
        102400,               // 100KB
        512000,               // 500KB
        1024 * 1024 - 1,     // Just under limit
        1024 * 1024,         // Exactly at limit
      ];

      for (const size of boundarySizes) {
        const file = {
          originalname: `boundary_${size}.pdf`,
          buffer: Buffer.alloc(size),
          mimetype: 'application/pdf',
          size,
        } as any;

        const result = await controller.uploadAttachment(file);
        
        expect(result).toBeDefined();
        expect(result.size).toBe(size);
      }
    });

    it('should handle getByCategory with various category formats', async () => {
      const categories = [
        'TEAM-1',
        'TEAM_1',
        'TEAM 1',
        'team-1',
        'TEAM-001',
        'T1',
        'TEAM',
      ];

      for (const category of categories) {
        (service.getByCategory as jest.Mock).mockResolvedValue([mockIncident]);
        
        const result = await controller.getByCategory(category);
        
        expect(result).toBeDefined();
        expect(service.getByCategory).toHaveBeenCalledWith(category);
      }
    });

    it('should handle getIncidentsByMainCategoryCode with various codes', async () => {
      const codes = ['CAT-1', 'CAT_1', 'C1', 'CATEGORY-001'];

      for (const code of codes) {
        (service.getIncidentsByMainCategoryCode as jest.Mock).mockResolvedValue([mockIncident]);
        
        const result = await controller.getIncidentsByMainCategoryCode(code);
        
        expect(result).toBeDefined();
        expect(service.getIncidentsByMainCategoryCode).toHaveBeenCalledWith(code);
      }
    });

    it('should handle downloadAttachment with various filename patterns', async () => {
      const filenames = [
        'simple.pdf',
        'with-dash.pdf',
        'with_underscore.pdf',
        'with.multiple.dots.pdf',
        'with spaces.pdf',
        '123numeric.pdf',
        'UPPERCASE.PDF',
      ];

      const mockRes = {
        setHeader: jest.fn(),
        sendFile: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      for (const filename of filenames) {
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        
        controller.downloadAttachment(filename, mockRes);
        
        expect(mockRes.sendFile).toHaveBeenCalled();
      }

      (fs.existsSync as jest.Mock).mockRestore();
    });

    it('should handle create with various dto combinations', async () => {
      (service.create as jest.Mock).mockResolvedValue(mockIncident);

      // Test with handler
      await controller.create({ ...mockIncidentDto, handler: 'SV001' });
      expect(service.create).toHaveBeenCalled();

      // Test with update_by
      await controller.create({ ...mockIncidentDto, update_by: 'USER001' });
      expect(service.create).toHaveBeenCalled();

      // Test with both
      await controller.create({ ...mockIncidentDto, handler: 'SV002', update_by: 'USER002' });
      expect(service.create).toHaveBeenCalled();
    });

    it('should handle update with null and undefined handler combinations', async () => {
      // Handler is null
      (service.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        handler: null,
      });
      await controller.update('IN1', mockIncidentDto);

      // Handler is undefined
      (service.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        handler: undefined,
      });
      await controller.update('IN1', mockIncidentDto);

      // Handler is empty string
      (service.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        handler: '',
      });
      await controller.update('IN1', mockIncidentDto);

      // Handler has value
      (service.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        handler: 'SV001',
      });
      await controller.update('IN1', mockIncidentDto);

      expect(service.update).toHaveBeenCalledTimes(4);
    });

    it('should handle getIncidentByNumber with various number formats', async () => {
      const incidentNumbers = ['IN1', 'IN001', 'IN-001', 'INC-1', 'I1'];

      for (const number of incidentNumbers) {
        (service.getIncidentByNumber as jest.Mock).mockResolvedValue({
          ...mockIncident,
          incident_number: number,
        });

        const result = await controller.getIncidentByNumber(number);
        
        expect(result).toBeDefined();
        expect(result.incident_number).toBe(number);
      }
    });

    it('should handle getIncidentHistory with various incident numbers', async () => {
      const incidentNumbers = ['IN1', 'IN2', 'IN3'];
      const history = [{ id: 1, change: 'Created' }];

      for (const number of incidentNumbers) {
        (service.getIncidentHistory as jest.Mock).mockResolvedValue(history);

        const result = await controller.getIncidentHistory(number);
        
        expect(result).toEqual(history);
      }
    });
  });
});