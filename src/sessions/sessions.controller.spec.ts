import { Test, TestingModule } from '@nestjs/testing';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { Session } from './entities/session.entity';

describe('SessionsController', () => {
  let controller: SessionsController;
  let service: SessionsService;

  const mockSession: Session = {
    id: 1,
    technician_service_number: 'SN001',
    login_time: new Date('2024-01-01T10:00:00'),
    logout_time: new Date('2024-01-01T18:00:00'),
    technician: Session.prototype.technician,
  };

  const mockSessionsService = {
    getAllSessions: jest.fn(),
    getSessionsByTechnician: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        {
          provide: SessionsService,
          useValue: mockSessionsService,
        },
      ],
    }).compile();

    controller = module.get<SessionsController>(SessionsController);
    service = module.get<SessionsService>(SessionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllSessions', () => {
    it('should return an array of sessions', async () => {
      const mockSessions: Session[] = [mockSession];
      mockSessionsService.getAllSessions.mockResolvedValue(mockSessions);

      const result = await controller.getAllSessions();

      expect(result).toEqual(mockSessions);
      expect(service.getAllSessions).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array when no sessions exist', async () => {
      mockSessionsService.getAllSessions.mockResolvedValue([]);

      const result = await controller.getAllSessions();

      expect(result).toEqual([]);
      expect(service.getAllSessions).toHaveBeenCalledTimes(1);
    });

    it('should throw a string error when service fails', async () => {
      const errorMessage = 'Database connection failed';
      mockSessionsService.getAllSessions.mockRejectedValue(new Error(errorMessage));

      try {
        await controller.getAllSessions();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBe(`Failed to get sessions: ${errorMessage}`);
      }
      expect(service.getAllSessions).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSessionsByTechnician', () => {
    it('should return sessions for a specific technician', async () => {
      const serviceNumber = 'SN001';
      const mockSessions: Session[] = [mockSession];
      mockSessionsService.getSessionsByTechnician.mockResolvedValue(mockSessions);

      const result = await controller.getSessionsByTechnician(serviceNumber);

      expect(result).toEqual(mockSessions);
      expect(service.getSessionsByTechnician).toHaveBeenCalledWith(serviceNumber);
      expect(service.getSessionsByTechnician).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array when technician has no sessions', async () => {
      const serviceNumber = 'SN999';
      mockSessionsService.getSessionsByTechnician.mockResolvedValue([]);

      const result = await controller.getSessionsByTechnician(serviceNumber);

      expect(result).toEqual([]);
      expect(service.getSessionsByTechnician).toHaveBeenCalledWith(serviceNumber);
    });

    it('should return multiple sessions for a technician', async () => {
      const serviceNumber = 'SN001';
      const mockSessions: Session[] = [
        mockSession,
        {
          ...mockSession,
          id: 2,
          login_time: new Date('2024-01-02T10:00:00'),
          logout_time: new Date('2024-01-02T18:00:00'),
        },
      ];
      mockSessionsService.getSessionsByTechnician.mockResolvedValue(mockSessions);

      const result = await controller.getSessionsByTechnician(serviceNumber);

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockSessions);
    });

    it('should throw a string error when service fails', async () => {
      const serviceNumber = 'SN001';
      const errorMessage = 'Database query failed';
      mockSessionsService.getSessionsByTechnician.mockRejectedValue(
        new Error(errorMessage)
      );

      try {
        await controller.getSessionsByTechnician(serviceNumber);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBe(`Failed to get sessions: ${errorMessage}`);
      }
      expect(service.getSessionsByTechnician).toHaveBeenCalledWith(serviceNumber);
    });
  });
});