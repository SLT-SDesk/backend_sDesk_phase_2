import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from './sessions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { Repository } from 'typeorm';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';

describe('SessionsService', () => {
  let service: SessionsService;
  let repository: Repository<Session>;

  const mockSession: Session = {
    id: 1,
    technician_service_number: 'SN001',
    login_time: new Date('2024-01-01T10:00:00'),
    logout_time: null,
    technician: Session.prototype.technician,
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: getRepositoryToken(Session),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    repository = module.get<Repository<Session>>(getRepositoryToken(Session));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should successfully create a session', async () => {
      const serviceNumber = 'SN001';
      const sessionToCreate = {
        technician_service_number: serviceNumber,
        login_time: expect.any(Date),
        logout_time: null,
      };

      mockRepository.create.mockReturnValue(mockSession);
      mockRepository.save.mockResolvedValue(mockSession);

      const result = await service.createSession(serviceNumber);

      expect(repository.create).toHaveBeenCalledWith(sessionToCreate);
      expect(repository.save).toHaveBeenCalledWith(mockSession);
      expect(result).toEqual(mockSession);
    });

    it('should throw InternalServerErrorException when save fails', async () => {
      const serviceNumber = 'SN001';
      const errorMessage = 'Database error';
      mockRepository.create.mockReturnValue(mockSession);
      mockRepository.save.mockRejectedValue(new Error(errorMessage));

      await expect(service.createSession(serviceNumber)).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.createSession(serviceNumber)).rejects.toThrow(
        `Failed to create session record: ${errorMessage}`
      );
    });
  });

  describe('endSession', () => {
    it('should successfully end an open session', async () => {
      const serviceNumber = 'SN001';
      const openSession = { ...mockSession };
      const closedSession = { ...mockSession, logout_time: new Date() };

      mockRepository.findOne.mockResolvedValue(openSession);
      mockRepository.save.mockResolvedValue(closedSession);

      const result = await service.endSession(serviceNumber);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          technician_service_number: serviceNumber,
          logout_time: IsNull(),
        },
        order: { login_time: 'DESC' },
      });
      expect(result.logout_time).toBeDefined();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when no open session exists', async () => {
      const serviceNumber = 'SN999';
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.endSession(serviceNumber)).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.endSession(serviceNumber)).rejects.toThrow(
        'Failed to close session record: No open session found for this technician'
      );
    });

    it('should throw InternalServerErrorException when findOne fails', async () => {
      const serviceNumber = 'SN001';
      const errorMessage = 'Database connection lost';
      mockRepository.findOne.mockRejectedValue(new Error(errorMessage));

      await expect(service.endSession(serviceNumber)).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.endSession(serviceNumber)).rejects.toThrow(
        `Failed to close session record: ${errorMessage}`
      );
    });

    it('should throw InternalServerErrorException when save fails', async () => {
      const serviceNumber = 'SN001';
      const errorMessage = 'Save operation failed';
      mockRepository.findOne.mockResolvedValue(mockSession);
      mockRepository.save.mockRejectedValue(new Error(errorMessage));

      await expect(service.endSession(serviceNumber)).rejects.toThrow(
        InternalServerErrorException
      );
    });
  });

  describe('getSessionsByTechnician', () => {
    it('should return all sessions for a specific technician', async () => {
      const serviceNumber = 'SN001';
      const mockSessions = [mockSession];
      mockRepository.find.mockResolvedValue(mockSessions);

      const result = await service.getSessionsByTechnician(serviceNumber);

      expect(repository.find).toHaveBeenCalledWith({
        where: { technician_service_number: serviceNumber },
        relations: ['technician'],
      });
      expect(result).toEqual(mockSessions);
    });

    it('should return an empty array when technician has no sessions', async () => {
      const serviceNumber = 'SN999';
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getSessionsByTechnician(serviceNumber);

      expect(result).toEqual([]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { technician_service_number: serviceNumber },
        relations: ['technician'],
      });
    });

    it('should return multiple sessions for a technician', async () => {
      const serviceNumber = 'SN001';
      const mockSessions = [
        mockSession,
        { ...mockSession, id: 2, logout_time: new Date() },
      ];
      mockRepository.find.mockResolvedValue(mockSessions);

      const result = await service.getSessionsByTechnician(serviceNumber);

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockSessions);
    });

    it('should throw InternalServerErrorException when find fails', async () => {
      const serviceNumber = 'SN001';
      const errorMessage = 'Query execution failed';
      mockRepository.find.mockRejectedValue(new Error(errorMessage));

      await expect(
        service.getSessionsByTechnician(serviceNumber)
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.getSessionsByTechnician(serviceNumber)
      ).rejects.toThrow(`Failed to fetch sessions: ${errorMessage}`);
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions', async () => {
      const mockSessions = [
        mockSession,
        { ...mockSession, id: 2, technician_service_number: 'SN002' },
      ];
      mockRepository.find.mockResolvedValue(mockSessions);

      const result = await service.getAllSessions();

      expect(repository.find).toHaveBeenCalledWith();
      expect(result).toEqual(mockSessions);
      expect(result).toHaveLength(2);
    });

    it('should return an empty array when no sessions exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getAllSessions();

      expect(result).toEqual([]);
      expect(repository.find).toHaveBeenCalledWith();
    });

    it('should throw InternalServerErrorException when find fails', async () => {
      const errorMessage = 'Database unavailable';
      mockRepository.find.mockRejectedValue(new Error(errorMessage));

      await expect(service.getAllSessions()).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.getAllSessions()).rejects.toThrow(
        `Failed to fetch sessions: ${errorMessage}`
      );
    });
  });
});