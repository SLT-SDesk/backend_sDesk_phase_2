import {
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { SmsService } from './sms.service';
import { ErpService } from '../erp/erp.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private readonly smsService: SmsService,
    private readonly erpService: ErpService,
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

  /**
   * Helper to send SMS when an incident is created.
   * @param incidentNumber Generated incident number (e.g. IN2026.08.24.0001)
   * @param informant Service number or email of the informant
   */
  async sendIncidentCreatedSms(incidentNumber: string, informant: string): Promise<boolean> {
    const message = `Ref/No - ${incidentNumber} incident is created`;
    return this.sendIncidentStatusSms(incidentNumber, informant, message);
  }

  /**
   * Helper to send SMS when an incident is closed.
   * @param incidentNumber Incident number
   * @param informant Service number or email of the informant
   */
  async sendIncidentClosedSms(incidentNumber: string, informant: string): Promise<boolean> {
    const message = `Ref/No - ${incidentNumber} incident is closed`;
    return this.sendIncidentStatusSms(incidentNumber, informant, message);
  }

  /**
   * Internal routine for fetching employee details from ERP and sending SMS notification.
   */
  private async sendIncidentStatusSms(
    incidentNumber: string,
    informant: string,
    message: string,
  ): Promise<boolean> {
    try {
      this.logger.log(`[SMS-FLOW] Incident SMS notification started for incident ${incidentNumber}`);

      if (!informant) {
        this.logger.warn(`[SMS-FLOW] SMS notification failed for incident ${incidentNumber}. Reason: Missing informant service number/email.`);
        return false;
      }

      this.logger.log(`[SMS-FLOW] ERP employee lookup started for employee/service number: ${informant}`);
      const employee = await this.erpService.getEmployeeDetailsForServiceNo(informant);

      if (!employee || !employee.mobileNo) {
        this.logger.warn(
          `[SMS-FLOW] SMS notification failed for incident ${incidentNumber}. Reason: Mobile number not available from ERP for informant ${informant}`,
        );
        return false;
      }

      this.logger.log(
        `[SMS-FLOW] ERP employee lookup completed for service number: ${informant}. Mobile number retrieved successfully`,
      );

      const smsResult = await this.smsService.sendSms(employee.mobileNo, message);

      if (!smsResult.success) {
        this.logger.warn(
          `[SMS-FLOW] SMS notification failed for incident ${incidentNumber}. Reason: ${smsResult.error}`,
        );
        return false;
      }

      return true;
    } catch (error: any) {
      this.logger.error(
        `[SMS-FLOW] SMS notification failed for incident ${incidentNumber}. Reason: ${error?.message || error}`,
      );
      return false;
    }
  }
}
