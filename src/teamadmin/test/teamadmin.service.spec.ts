import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TeamAdminService } from '../teamadmin.service';
import { TeamAdmin } from '../entities/teamadmin.entity';
import { TeamAdminDto } from '../dto/teamadmin-dto';

describe('TeamAdminService', () => {
  let service: TeamAdminService; // the service being tested
  let repository: Repository<TeamAdmin>; // mock repo

  let loggerSpy: jest.SpyInstance;

  // mock data used across tests
  // from entities
  const mockTeamAdmin: TeamAdmin = {
    id: 'test-uuid-123',
    serviceNumber: 'SN001',
    userName: 'John Doe',
    contactNumber: 'TP001',
    designation: 'Senior Developer',
    email: 'john@example.com',
    active: true,
    assignAfterSignOff: false,
    teamId: 'team-123',
    teamName: 'Team Alpha',
    assignedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  // from dto file
  const mockTeamAdminDto: TeamAdminDto = {
    serviceNumber: 'SN001',
    userName: 'John Doe',
    contactNumber: 'TP001',
    designation: 'Senior Developer',
    email: 'john@example.com',
    active: true,
    assignAfterSignOff: false,
    teamId: 'team-123',
    teamName: 'Team Alpha',
  };

  // mock repo functions
  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  beforeAll(() => {
    loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
  });

  // restore logger after all tests
  afterAll(() => {
    loggerSpy.mockRestore();
  });

  // fresh testing module before each test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamAdminService,
        {
          provide: getRepositoryToken(TeamAdmin),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TeamAdminService>(TeamAdminService);
    repository = module.get<Repository<TeamAdmin>>(
      getRepositoryToken(TeamAdmin),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTeamAdmin', () => {
    //2
    it('should create a team admin successfully', async () => {
      mockRepository.create.mockReturnValue(mockTeamAdmin);
      mockRepository.save.mockResolvedValue(mockTeamAdmin);
      const result = await service.createTeamAdmin(mockTeamAdminDto, 'team-123');
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...mockTeamAdminDto,
        teamId: 'team-123',
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockTeamAdmin);
      expect(result).toEqual(mockTeamAdmin);
    });

    //3

    it('should throw InternalServerErrorException when save fails', async () => {
      const originalError = new Error('Database error');
      mockRepository.create.mockReturnValue(mockTeamAdmin);
      mockRepository.save.mockRejectedValue(originalError);

      await expect(service.createTeamAdmin(mockTeamAdminDto, 'team-123')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.createTeamAdmin(mockTeamAdminDto, 'team-123')).rejects.toThrow(
        `Failed to create team admin: ${originalError.message}`,
      );
    });
  });

  //4
  describe('findAllTeamAdmins', () => {
    it('should return all team admins', async () => {
      const teamAdmins = [mockTeamAdmin];
      mockRepository.find.mockResolvedValue(teamAdmins);

      const result = await service.findAllTeamAdmins();

      expect(mockRepository.find).toHaveBeenCalled();
      expect(result).toEqual(teamAdmins);
    });

    //5
    it('should return empty array when no team admins found', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAllTeamAdmins();

      expect(result).toEqual([]);
    });
//6
    it('should throw InternalServerErrorException when findAllTeamAdmins fails', async () => {
      const originalError = new Error('Network error');
      mockRepository.find.mockRejectedValue(originalError);

      await expect(service.findAllTeamAdmins()).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.findAllTeamAdmins()).rejects.toThrow(
        `Failed to retrieve team admins: ${originalError.message}`,
      );
    });
  });

  describe('findTeamAdminByTeamId', () => {
    //7
    it('should return team admin by team id', async () => {
      mockRepository.findOne.mockResolvedValue(mockTeamAdmin);

      const result = await service.findTeamAdminByTeamId('team-123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { teamId: 'team-123' },
      });
      expect(result).toEqual(mockTeamAdmin);
    });

    //8

    it('should return null when team admin not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findTeamAdminByTeamId('non-existent-team');

      expect(result).toBeNull();
    });

    //9
    it('should throw InternalServerErrorException when findTeamAdminByTeamId fails', async () => {
      const originalError = new Error('Database connection issue');
      mockRepository.findOne.mockRejectedValue(originalError);

      await expect(service.findTeamAdminByTeamId('team-123')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.findTeamAdminByTeamId('team-123')).rejects.toThrow(
        `Failed to find team admin by teamId team-123: ${originalError.message}`,
      );
    });
  });

  describe('updateTeamAdminByTeamId', () => {
    //10
    it('should update team admin by team id successfully', async () => {
      const updatedData = { ...mockTeamAdminDto, userName: 'Updated Name' };
      const updatedAdmin = { ...mockTeamAdmin, userName: 'Updated Name' };

      mockRepository.findOne.mockResolvedValue(mockTeamAdmin);
      mockRepository.save.mockResolvedValue(updatedAdmin);

      const result = await service.updateTeamAdminByTeamId(
        'team-123',
        updatedData,
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { teamId: 'team-123' },
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedAdmin);
    });

    // 11
    it('should throw NotFoundException when team admin not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateTeamAdminByTeamId('non-existent-team', mockTeamAdminDto),
      ).rejects.toThrow(NotFoundException);
    });

    //12
    it('should throw InternalServerErrorException when updateTeamAdminByTeamId save fails', async () => {
      const originalError = new Error('Save failed');
      mockRepository.findOne.mockResolvedValue(mockTeamAdmin);
      mockRepository.save.mockRejectedValue(originalError);

      await expect(
        service.updateTeamAdminByTeamId('team-123', mockTeamAdminDto),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.updateTeamAdminByTeamId('team-123', mockTeamAdminDto),
      ).rejects.toThrow(
        `Failed to update team admin with teamId team-123: ${originalError.message}`,
      );
    });
  });

  describe('removeTeamAdminByTeamId', () => {
    //13
    it('should remove team admin by team id successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockTeamAdmin);
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await service.removeTeamAdminByTeamId('team-123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { teamId: 'team-123' },
      });
      expect(mockRepository.delete).toHaveBeenCalledWith({
        teamId: 'team-123',
      });
    });

  //14
    it('should throw NotFoundException when team admin not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeTeamAdminByTeamId('non-existent-team'),
      ).rejects.toThrow(NotFoundException);
    });

    //15
    it('should throw InternalServerErrorException when delete fails (affected: 0)', async () => {
      mockRepository.findOne.mockResolvedValue(mockTeamAdmin);
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.removeTeamAdminByTeamId('team-123')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.removeTeamAdminByTeamId('team-123')).rejects.toThrow(
        `Failed to delete team admin with teamId team-123`,
      );
    });

    //16
    it('should throw InternalServerErrorException for general database errors during removeTeamAdminByTeamId', async () => {
      const originalError = new Error('Database connection lost');
      mockRepository.findOne.mockResolvedValue(mockTeamAdmin);
      mockRepository.delete.mockRejectedValue(originalError);

      await expect(service.removeTeamAdminByTeamId('team-123')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.removeTeamAdminByTeamId('team-123')).rejects.toThrow(
        `Failed to delete team admin: ${originalError.message}`,
      );
    });
  });
});
