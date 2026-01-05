import { Test, TestingModule } from '@nestjs/testing';
import { TechnicianService } from '../technician.service';
import { Technician } from '../entities/technician.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CreateTechnicianDto } from '../dto/create-technician.dto';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Session } from '../../sessions/entities/session.entity';

// Mock the main module exports
jest.mock('../../main', () => ({
  notifyInactiveByAdmin: jest.fn(),
  emitTechnicianStatusChange: jest.fn(),
}));

import { notifyInactiveByAdmin, emitTechnicianStatusChange } from '../../main';

describe('TechnicianService', () => {
  let service: TechnicianService;
  let repo: Repository<Technician>;

  const mockSession: Session = {
    id: 1,
    technician_service_number: 'SN123',
    login_time: new Date('2024-01-01T10:00:00'),
    logout_time: new Date('2024-01-01T18:00:00'),
    technician: Technician.prototype,
  };

  const mockTechnician: Technician = {
    id: '1',
    serviceNum: 'SN123',
    name: 'John Doe',
    team: 'Team A',
    position: 'technician',
    cat1: 'C1',
    cat2: 'C2',
    cat3: 'C3',
    cat4: 'C4',
    active: true,
    tier: '1',
    teamId: 'T1',
    email: 'john@example.com',
    contactNumber: '1234567890',
    sessions: [],
    user: Technician.prototype.user,
  };

  const mockCreateDto: CreateTechnicianDto = {
    serviceNum: 'SN123',
    name: 'John Doe',
    team: 'Team A',
    position: 'technician',
    cat1: 'C1',
    cat2: 'C2',
    cat3: 'C3',
    cat4: 'C4',
    active: true,
    tier: '1',
    teamId: 'T1',
    email: 'john@example.com',
    contactNumber: '1234567890',
  } as CreateTechnicianDto;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TechnicianService,
        {
          provide: getRepositoryToken(Technician),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<TechnicianService>(TechnicianService);
    repo = module.get<Repository<Technician>>(getRepositoryToken(Technician));

    // Reset all mocks and return fresh copies of objects
    jest.clearAllMocks();
    mockRepo.create.mockReturnValue({ ...mockTechnician });
    mockRepo.save.mockResolvedValue({ ...mockTechnician });
    mockRepo.find.mockResolvedValue([{ ...mockTechnician }]);
    mockRepo.findOne.mockResolvedValue({ ...mockTechnician });
    mockRepo.delete.mockResolvedValue({ affected: 1, raw: {} });
    mockRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTechnician', () => {
    it('should create a technician', async () => {
      const result = await service.createTechnician(mockCreateDto);
      expect(repo.create).toHaveBeenCalledWith(mockCreateDto);
      expect(repo.save).toHaveBeenCalled();
      expect(result).toEqual(mockTechnician);
    });

    it('should throw ConflictException on duplicate entry', async () => {
      mockRepo.save.mockRejectedValue({ code: '23505' });
      await expect(service.createTechnician(mockCreateDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createTechnician(mockCreateDto)).rejects.toThrow(
        'Technician with the same Service Number or Email already exists.',
      );
    });

    it('should throw InternalServerErrorException on unknown error', async () => {
      mockRepo.save.mockRejectedValue({ code: 'OTHER' });
      await expect(service.createTechnician(mockCreateDto)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.createTechnician(mockCreateDto)).rejects.toThrow(
        'Failed to create technician.',
      );
    });
  });

  describe('findAllTechncians', () => {
    it('should return array of technicians', async () => {
      const result = await service.findAllTechncians();
      expect(result).toEqual([mockTechnician]);
      expect(repo.find).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockRepo.find.mockRejectedValue(new Error('DB error'));
      await expect(service.findAllTechncians()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findOneTechnician', () => {
    it('should return one technician by serviceNum', async () => {
      const result = await service.findOneTechnician('SN123');
      expect(result).toEqual(mockTechnician);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { serviceNum: 'SN123' },
      });
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneTechnician('NOT_EXIST')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOneTechnician('NOT_EXIST')).rejects.toThrow(
        'Technician with Service Number "NOT_EXIST" not found.',
      );
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockRepo.findOne.mockRejectedValue(new Error('DB error'));
      await expect(service.findOneTechnician('SN123')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.findOneTechnician('SN123')).rejects.toThrow(
        'Error fetching technician.',
      );
    });
  });

  describe('updateTechnician', () => {
    it('should update and return the technician', async () => {
      const updateDto = { ...mockCreateDto, name: 'Updated' };
      const updatedTech = { ...mockTechnician, name: 'Updated' };
      mockRepo.findOne.mockResolvedValue({ ...mockTechnician });
      mockRepo.save.mockResolvedValue(updatedTech);

      const result = await service.updateTechnician('SN123', updateDto);

      expect(result.name).toBe('Updated');
      expect(emitTechnicianStatusChange).toHaveBeenCalledWith('SN123', true);
    });

    it('should call notifyInactiveByAdmin when changing from active to inactive', async () => {
      const activeTech = { ...mockTechnician, active: true };
      const updateDto = { ...mockCreateDto, active: false };
      const inactiveTech = { ...mockTechnician, active: false };

      mockRepo.findOne.mockResolvedValue(activeTech);
      mockRepo.save.mockResolvedValue(inactiveTech);

      await service.updateTechnician('SN123', updateDto);

      expect(notifyInactiveByAdmin).toHaveBeenCalledWith('SN123');
      expect(emitTechnicianStatusChange).toHaveBeenCalledWith('SN123', false);
    });

    it('should not call notifyInactiveByAdmin when staying active', async () => {
      const activeTech = { ...mockTechnician, active: true };
      const updateDto = { ...mockCreateDto, active: true };

      mockRepo.findOne.mockResolvedValue(activeTech);
      mockRepo.save.mockResolvedValue({ ...activeTech });

      await service.updateTechnician('SN123', updateDto);

      expect(notifyInactiveByAdmin).not.toHaveBeenCalled();
      expect(emitTechnicianStatusChange).toHaveBeenCalledWith('SN123', true);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateTechnician('SN404', { ...mockCreateDto, name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockTechnician });
      mockRepo.save.mockRejectedValue(new Error('Save failed'));
      await expect(
        service.updateTechnician('SN123', { ...mockCreateDto, name: 'X' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteTechnician', () => {
    it('should delete a technician', async () => {
      const result = await service.deleteTechnician('SN123');
      expect(repo.delete).toHaveBeenCalledWith({ serviceNum: 'SN123' });
      expect(result).toBeUndefined();
    });

    it('should throw NotFoundException if affected = 0', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0, raw: {} });
      await expect(service.deleteTechnician('SN404')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deleteTechnician('SN404')).rejects.toThrow(
        'Technician with Service Number "SN404" not found.',
      );
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockRepo.delete.mockRejectedValue(new Error('Delete failed'));
      await expect(service.deleteTechnician('SN123')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.deleteTechnician('SN123')).rejects.toThrow(
        'Failed to delete technician.',
      );
    });
  });

  describe('updateTechnicianActive', () => {
    it('should update technician active status', async () => {
      await service.updateTechnicianActive('SN123', false);
      expect(repo.update).toHaveBeenCalledWith({ serviceNum: 'SN123' }, { active: false });
    });

    it('should throw NotFoundException if technician not found', async () => {
      mockRepo.update.mockResolvedValue({ affected: 0, raw: {}, generatedMaps: [] });
      await expect(service.updateTechnicianActive('SN404', true)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.updateTechnicianActive('SN404', true)).rejects.toThrow(
        'Technician with Service Number "SN404" not found.',
      );
    });
  });

  describe('findActiveTechnicians', () => {
    it('should return only active technicians', async () => {
      const activeTechs = [mockTechnician];
      mockRepo.find.mockResolvedValue(activeTechs);

      const result = await service.findActiveTechnicians();

      expect(repo.find).toHaveBeenCalledWith({ where: { active: true } });
      expect(result).toEqual(activeTechs);
    });

    it('should return empty array when no active technicians', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await service.findActiveTechnicians();
      expect(result).toEqual([]);
    });
  });

  describe('checkTechnicianStatus', () => {
    it('should return status for all technicians', async () => {
      const result = await service.checkTechnicianStatus();
      expect(repo.find).toHaveBeenCalled();
      expect(result).toEqual([{ serviceNum: 'SN123', active: 'true' }]);
    });

    it('should throw error when fetch fails', async () => {
      mockRepo.find.mockRejectedValue(new Error('DB error'));
      await expect(service.checkTechnicianStatus()).rejects.toThrow(
        'Failed to retrieve technician status',
      );
    });
  });

  describe('getTechnicianWithSessions', () => {
    it('should return technician with sessions', async () => {
      const techWithSessions = { ...mockTechnician, sessions: [mockSession] };
      mockRepo.findOne.mockResolvedValue(techWithSessions);

      const result = await service.getTechnicianWithSessions('SN123');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { serviceNum: 'SN123' },
        relations: ['sessions'],
      });
      expect(result).toEqual(techWithSessions);
      expect(result.sessions).toHaveLength(1);
    });

    it('should throw NotFoundException when technician not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.getTechnicianWithSessions('SN999')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getTechnicianWithSessions('SN999')).rejects.toThrow(
        'Technician with Service Number "SN999" not found.',
      );
    });

    it('should throw InternalServerErrorException on database error', async () => {
      mockRepo.findOne.mockRejectedValue(new Error('DB connection lost'));
      await expect(service.getTechnicianWithSessions('SN123')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.getTechnicianWithSessions('SN123')).rejects.toThrow(
        'Error fetching technician with sessions.',
      );
    });
  });

  describe('getAllTechnicianNameWithSessionsByMainCategory', () => {
    it('should return technicians with sessions by teamId', async () => {
      const techsWithSessions = [
        {
          ...mockTechnician,
          sessions: [mockSession],
        },
      ];
      mockQueryBuilder.getMany.mockResolvedValue(techsWithSessions);

      const result = await service.getAllTechnicianNameWithSessionsByMainCategory('T1');

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('technician');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'technician.sessions',
        'session',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('technician.teamId = :teamId', {
        teamId: 'T1',
      });
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'technician.serviceNum',
        'technician.name',
        'session',
      ]);
      expect(result).toEqual([
        {
          serviceNum: 'SN123',
          name: 'John Doe',
          sessions: [mockSession],
        },
      ]);
    });

    it('should return empty array when no technicians in team', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getAllTechnicianNameWithSessionsByMainCategory('T999');

      expect(result).toEqual([]);
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockQueryBuilder.getMany.mockRejectedValue(new Error('Query failed'));

      await expect(
        service.getAllTechnicianNameWithSessionsByMainCategory('T1'),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.getAllTechnicianNameWithSessionsByMainCategory('T1'),
      ).rejects.toThrow(
        'Failed to fetch technicians with sessions by main category.',
      );
    });

    it('should handle multiple technicians with different session counts', async () => {
      const techsWithSessions = [
        {
          serviceNum: 'SN001',
          name: 'Tech One',
          sessions: [mockSession],
        },
        {
          serviceNum: 'SN002',
          name: 'Tech Two',
          sessions: [mockSession, { ...mockSession, id: 2 }],
        },
        {
          serviceNum: 'SN003',
          name: 'Tech Three',
          sessions: [],
        },
      ];
      mockQueryBuilder.getMany.mockResolvedValue(techsWithSessions);

      const result = await service.getAllTechnicianNameWithSessionsByMainCategory('T1');

      expect(result).toHaveLength(3);
      expect(result[0].sessions).toHaveLength(1);
      expect(result[1].sessions).toHaveLength(2);
      expect(result[2].sessions).toHaveLength(0);
    });
  });
});