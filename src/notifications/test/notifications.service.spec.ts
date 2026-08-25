import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Notification } from '../notification.entity';
import { NotificationsService } from '../notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: Repository<Notification>;

  const mockNotification: Notification = {
    id: 1,
    recipientServiceNumber: 'S1',
    message: 'Test notification',
    incidentNumber: 'IN123',
    actorName: 'John Doe',
    actorServiceNum: 'S2',
    read: false,
    createdOn: new Date('2025-01-01'),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repository = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNotification', () => {
    it('should create a notification with all fields', async () => {
      const payload = {
        recipientServiceNumber: 'S1',
        message: 'Test notification',
        incidentNumber: 'IN123',
        actorName: 'John Doe',
        actorServiceNum: 'S2',
      };

      const expectedNotification = {
        ...payload,
        read: false,
      };

      mockRepository.create.mockReturnValue(expectedNotification);
      mockRepository.save.mockResolvedValue({ id: 1, ...expectedNotification });

      const result = await service.createNotification(payload);

      expect(repository.create).toHaveBeenCalledWith({
        recipientServiceNumber: 'S1',
        message: 'Test notification',
        incidentNumber: 'IN123',
        read: false,
        actorName: 'John Doe',
        actorServiceNum: 'S2',
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, ...expectedNotification });
    });

    it('should create a notification with minimal required fields', async () => {
      const payload = {
        recipientServiceNumber: 'S1',
        message: 'Minimal notification',
      };

      const expectedNotification = {
        recipientServiceNumber: 'S1',
        message: 'Minimal notification',
        incidentNumber: undefined,
        actorName: null,
        actorServiceNum: null,
        read: false,
      };

      mockRepository.create.mockReturnValue(expectedNotification);
      mockRepository.save.mockResolvedValue({ id: 2, ...expectedNotification });

      const result = await service.createNotification(payload);

      expect(repository.create).toHaveBeenCalledWith(expectedNotification);
      expect(repository.save).toHaveBeenCalled();
      expect(result.id).toBe(2);
      expect(result.message).toBe('Minimal notification');
    });

    it('should handle null actor fields', async () => {
      const payload = {
        recipientServiceNumber: 'S1',
        message: 'Test',
        actorName: null,
        actorServiceNum: null,
      };

      const expectedNotification = {
        recipientServiceNumber: 'S1',
        message: 'Test',
        incidentNumber: undefined,
        actorName: null,
        actorServiceNum: null,
        read: false,
      };

      mockRepository.create.mockReturnValue(expectedNotification);
      mockRepository.save.mockResolvedValue({ id: 3, ...expectedNotification });

      const result = await service.createNotification(payload);

      expect(repository.create).toHaveBeenCalledWith(expectedNotification);
      expect(result.actorName).toBeNull();
      expect(result.actorServiceNum).toBeNull();
    });

    it('should default actor fields to null when not provided', async () => {
      const payload = {
        recipientServiceNumber: 'S1',
        message: 'Test',
        incidentNumber: 'IN456',
      };

      const expectedNotification = {
        recipientServiceNumber: 'S1',
        message: 'Test',
        incidentNumber: 'IN456',
        actorName: null,
        actorServiceNum: null,
        read: false,
      };

      mockRepository.create.mockReturnValue(expectedNotification);
      mockRepository.save.mockResolvedValue({ id: 4, ...expectedNotification });

      const result = await service.createNotification(payload);

      expect(repository.create).toHaveBeenCalledWith(expectedNotification);
      expect(result.actorName).toBeNull();
      expect(result.actorServiceNum).toBeNull();
    });

    it('should set read to false by default', async () => {
      const payload = {
        recipientServiceNumber: 'S1',
        message: 'Test',
      };

      const expectedNotification = {
        recipientServiceNumber: 'S1',
        message: 'Test',
        incidentNumber: undefined,
        actorName: null,
        actorServiceNum: null,
        read: false,
      };

      mockRepository.create.mockReturnValue(expectedNotification);
      mockRepository.save.mockResolvedValue({ id: 5, ...expectedNotification });

      const result = await service.createNotification(payload);

      expect(result.read).toBe(false);
    });

    it('should throw InternalServerErrorException on create error', async () => {
      const payload = {
        recipientServiceNumber: 'S1',
        message: 'Test',
      };

      mockRepository.create.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(service.createNotification(payload)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.createNotification(payload)).rejects.toThrow(
        'Failed to create notification',
      );
    });

    it('should throw InternalServerErrorException on save error', async () => {
      const payload = {
        recipientServiceNumber: 'S1',
        message: 'Test',
      };

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockRejectedValue(
        new Error('Database constraint violation'),
      );

      await expect(service.createNotification(payload)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.createNotification(payload)).rejects.toThrow(
        'Failed to create notification',
      );
    });
  });

  describe('getNotificationsForUser', () => {
    it('should return notifications for a specific user', async () => {
      const notifications = [mockNotification];
      mockRepository.find.mockResolvedValue(notifications);

      const result = await service.getNotificationsForUser('S1');

      expect(repository.find).toHaveBeenCalledWith({
        where: { recipientServiceNumber: 'S1' },
        order: { createdOn: 'DESC' },
      });
      expect(result).toEqual(notifications);
    });

    it('should return multiple notifications ordered by createdOn DESC', async () => {
      const notifications = [
        { ...mockNotification, id: 3, createdOn: new Date('2025-01-03') },
        { ...mockNotification, id: 2, createdOn: new Date('2025-01-02') },
        { ...mockNotification, id: 1, createdOn: new Date('2025-01-01') },
      ];

      mockRepository.find.mockResolvedValue(notifications);

      const result = await service.getNotificationsForUser('S1');

      expect(repository.find).toHaveBeenCalledWith({
        where: { recipientServiceNumber: 'S1' },
        order: { createdOn: 'DESC' },
      });
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(3);
      expect(result[2].id).toBe(1);
    });

    it('should return empty array when user has no notifications', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getNotificationsForUser('S999');

      expect(repository.find).toHaveBeenCalledWith({
        where: { recipientServiceNumber: 'S999' },
        order: { createdOn: 'DESC' },
      });
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockRepository.find.mockRejectedValue(new Error('Database error'));

      await expect(service.getNotificationsForUser('S1')).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.markAsRead(1);

      expect(repository.update).toHaveBeenCalledWith(1, { read: true });
      expect(repository.update).toHaveBeenCalledTimes(1);
    });

    it('should handle marking non-existent notification', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      await service.markAsRead(999);

      expect(repository.update).toHaveBeenCalledWith(999, { read: true });
    });

    it('should handle database errors', async () => {
      mockRepository.update.mockRejectedValue(new Error('Database error'));

      await expect(service.markAsRead(1)).rejects.toThrow('Database error');
    });

    it('should work with different notification IDs', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.markAsRead(42);

      expect(repository.update).toHaveBeenCalledWith(42, { read: true });
    });
  });

  describe('markAsUnread', () => {
    it('should mark a notification as unread', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.markAsUnread(1);

      expect(repository.update).toHaveBeenCalledWith(1, { read: false });
      expect(repository.update).toHaveBeenCalledTimes(1);
    });

    it('should handle marking non-existent notification', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      await service.markAsUnread(999);

      expect(repository.update).toHaveBeenCalledWith(999, { read: false });
    });

    it('should handle database errors', async () => {
      mockRepository.update.mockRejectedValue(new Error('Database error'));

      await expect(service.markAsUnread(1)).rejects.toThrow('Database error');
    });

    it('should work with different notification IDs', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.markAsUnread(42);

      expect(repository.update).toHaveBeenCalledWith(42, { read: false });
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification successfully', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.deleteNotification(1);

      expect(repository.delete).toHaveBeenCalledWith(1);
      expect(repository.delete).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.deleteNotification(999)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deleteNotification(999)).rejects.toThrow(
        'Notification not found',
      );
      expect(repository.delete).toHaveBeenCalledWith(999);
    });

    it('should handle database errors', async () => {
      mockRepository.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.deleteNotification(1)).rejects.toThrow(
        'Database error',
      );
    });

    it('should work with different notification IDs', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.deleteNotification(42);

      expect(repository.delete).toHaveBeenCalledWith(42);
    });

    it('should handle multiple affected rows', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 2, raw: [] });

      await service.deleteNotification(1);

      expect(repository.delete).toHaveBeenCalledWith(1);
      // Should not throw error even if affected > 1
    });
  });

  describe('getNotificationById', () => {
    it('should return a notification by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockNotification);

      const result = await service.getNotificationById(1);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockNotification);
    });

    it('should return null when notification does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getNotificationById(999);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.getNotificationById(1)).rejects.toThrow(
        'Database error',
      );
    });

    it('should work with different notification IDs', async () => {
      const customNotification = { ...mockNotification, id: 42 };
      mockRepository.findOne.mockResolvedValue(customNotification);

      const result = await service.getNotificationById(42);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 42 } });
      expect(result).toEqual(customNotification);
    });

    it('should return undefined when findOne returns undefined', async () => {
      mockRepository.findOne.mockResolvedValue(undefined);

      const result = await service.getNotificationById(1);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toBeUndefined();
    });
  });
});
