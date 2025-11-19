import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async createNotification(payload: {
    recipientServiceNumber: string;
    message: string;
    incidentNumber?: string;
    actorName?: string | null;
    actorServiceNum?: string | null;
  }): Promise<Notification> {
    try {
      const notif = this.notificationRepository.create({
        recipientServiceNumber: payload.recipientServiceNumber,
        message: payload.message,
        incidentNumber: payload.incidentNumber,
        read: false,
        actorName: payload.actorName ?? null,
        actorServiceNum: payload.actorServiceNum ?? null,
      } as any);
      return await this.notificationRepository.save(notif as any);
    } catch (error) {
      throw new InternalServerErrorException('Failed to create notification');
    }
  }

  async getNotificationsForUser(serviceNum: string): Promise<Notification[]> {
    return await this.notificationRepository.find({
      where: { recipientServiceNumber: serviceNum },
      order: { createdOn: 'DESC' },
    });
  }

  async markAsRead(id: number): Promise<void> {
    await this.notificationRepository.update(id, { read: true });
  }

  async markAsUnread(id: number): Promise<void> {
    await this.notificationRepository.update(id, { read: false });
  }

  async deleteNotification(id: number): Promise<void> {
    const res = await this.notificationRepository.delete(id);
    if (res.affected === 0) {
      throw new NotFoundException('Notification not found');
    }
  }

  async getNotificationById(id: number): Promise<Notification | null> {
    return await this.notificationRepository.findOne({ where: { id } });
  }
}
