import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { Notification } from '../notification.entity';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

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

  const mockNotificationsService = {
    getNotificationsForUser: jest.fn(),
    markAsRead: jest.fn(),
    markAsUnread: jest.fn(),
    deleteNotification: jest.fn(),
    getNotificationById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyNotifications', () => {
    it('should return notifications for the logged-in user', async () => {
      const mockNotifications = [mockNotification];
      const req = { user: { serviceNum: 'S1' } };

      mockNotificationsService.getNotificationsForUser.mockResolvedValue(
        mockNotifications,
      );

      const result = await controller.getMyNotifications(req);

      expect(service.getNotificationsForUser).toHaveBeenCalledWith('S1');
      expect(service.getNotificationsForUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockNotifications);
    });

    it('should handle user with no notifications', async () => {
      const req = { user: { serviceNum: 'S1' } };

      mockNotificationsService.getNotificationsForUser.mockResolvedValue([]);

      const result = await controller.getMyNotifications(req);

      expect(service.getNotificationsForUser).toHaveBeenCalledWith('S1');
      expect(result).toEqual([]);
    });

    it('should handle undefined serviceNum', async () => {
      const req = { user: {} };

      mockNotificationsService.getNotificationsForUser.mockResolvedValue([]);

      const result = await controller.getMyNotifications(req);

      expect(service.getNotificationsForUser).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([]);
    });

    it('should handle missing user object', async () => {
      const req = {};

      mockNotificationsService.getNotificationsForUser.mockResolvedValue([]);

      const result = await controller.getMyNotifications(req);

      expect(service.getNotificationsForUser).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([]);
    });
  });

  describe('markRead', () => {
    it('should mark a notification as read', async () => {
      const notificationId = '1';

      mockNotificationsService.markAsRead.mockResolvedValue(undefined);

      const result = await controller.markRead(notificationId);

      expect(service.markAsRead).toHaveBeenCalledWith(1);
      expect(service.markAsRead).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it('should handle string id conversion to number', async () => {
      const notificationId = '999';

      mockNotificationsService.markAsRead.mockResolvedValue(undefined);

      await controller.markRead(notificationId);

      expect(service.markAsRead).toHaveBeenCalledWith(999);
    });

    it('should propagate errors from service', async () => {
      const notificationId = '1';
      const error = new Error('Database error');

      mockNotificationsService.markAsRead.mockRejectedValue(error);

      await expect(controller.markRead(notificationId)).rejects.toThrow(
        'Database error',
      );
      expect(service.markAsRead).toHaveBeenCalledWith(1);
    });
  });

  describe('markUnread', () => {
    it('should mark a notification as unread', async () => {
      const notificationId = '1';

      mockNotificationsService.markAsUnread.mockResolvedValue(undefined);

      const result = await controller.markUnread(notificationId);

      expect(service.markAsUnread).toHaveBeenCalledWith(1);
      expect(service.markAsUnread).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it('should handle string id conversion to number', async () => {
      const notificationId = '777';

      mockNotificationsService.markAsUnread.mockResolvedValue(undefined);

      await controller.markUnread(notificationId);

      expect(service.markAsUnread).toHaveBeenCalledWith(777);
    });

    it('should propagate errors from service', async () => {
      const notificationId = '1';
      const error = new Error('Database error');

      mockNotificationsService.markAsUnread.mockRejectedValue(error);

      await expect(controller.markUnread(notificationId)).rejects.toThrow(
        'Database error',
      );
      expect(service.markAsUnread).toHaveBeenCalledWith(1);
    });
  });

  describe('delete', () => {
    it('should delete a notification when user is the recipient', async () => {
      const notificationId = '1';
      const req = { user: { serviceNum: 'S1' } };

      mockNotificationsService.getNotificationById.mockResolvedValue(
        mockNotification,
      );
      mockNotificationsService.deleteNotification.mockResolvedValue(undefined);

      const result = await controller.delete(notificationId, req);

      expect(service.getNotificationById).toHaveBeenCalledWith(1);
      expect(service.deleteNotification).toHaveBeenCalledWith(1);
      expect(result).toEqual({ success: true });
    });

    it('should throw ForbiddenException when user is not the recipient', async () => {
      const notificationId = '1';
      const req = { user: { serviceNum: 'S3' } }; // Different user

      mockNotificationsService.getNotificationById.mockResolvedValue(
        mockNotification,
      );

      await expect(controller.delete(notificationId, req)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(controller.delete(notificationId, req)).rejects.toThrow(
        'You are not allowed to delete this notification',
      );

      expect(service.getNotificationById).toHaveBeenCalledWith(1);
      expect(service.deleteNotification).not.toHaveBeenCalled();
    });

    it('should return success when notification does not exist', async () => {
      const notificationId = '999';
      const req = { user: { serviceNum: 'S1' } };

      mockNotificationsService.getNotificationById.mockResolvedValue(null);

      const result = await controller.delete(notificationId, req);

      expect(service.getNotificationById).toHaveBeenCalledWith(999);
      expect(service.deleteNotification).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should handle undefined notification', async () => {
      const notificationId = '1';
      const req = { user: { serviceNum: 'S1' } };

      mockNotificationsService.getNotificationById.mockResolvedValue(undefined);

      const result = await controller.delete(notificationId, req);

      expect(service.getNotificationById).toHaveBeenCalledWith(1);
      expect(service.deleteNotification).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should handle missing user object', async () => {
      const notificationId = '1';
      const req = {};

      mockNotificationsService.getNotificationById.mockResolvedValue(
        mockNotification,
      );

      await expect(controller.delete(notificationId, req)).rejects.toThrow(
        ForbiddenException,
      );

      expect(service.getNotificationById).toHaveBeenCalledWith(1);
      expect(service.deleteNotification).not.toHaveBeenCalled();
    });

    it('should handle string id conversion to number', async () => {
      const notificationId = '555';
      const req = { user: { serviceNum: 'S1' } };
      const notification = { ...mockNotification, id: 555 };

      mockNotificationsService.getNotificationById.mockResolvedValue(
        notification,
      );
      mockNotificationsService.deleteNotification.mockResolvedValue(undefined);

      await controller.delete(notificationId, req);

      expect(service.getNotificationById).toHaveBeenCalledWith(555);
      expect(service.deleteNotification).toHaveBeenCalledWith(555);
    });

    it('should propagate errors from service when deleting', async () => {
      const notificationId = '1';
      const req = { user: { serviceNum: 'S1' } };
      const error = new Error('Database error');

      mockNotificationsService.getNotificationById.mockResolvedValue(
        mockNotification,
      );
      mockNotificationsService.deleteNotification.mockRejectedValue(error);

      await expect(controller.delete(notificationId, req)).rejects.toThrow(
        'Database error',
      );

      expect(service.getNotificationById).toHaveBeenCalledWith(1);
      expect(service.deleteNotification).toHaveBeenCalledWith(1);
    });
  });
});
