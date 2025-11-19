import {
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Req,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../middlewares/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(@Req() req: any) {
    const serviceNum = req.user?.serviceNum;
    return await this.notificationsService.getNotificationsForUser(serviceNum);
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    await this.notificationsService.markAsRead(Number(id));
    return { success: true };
  }

  @Patch(':id/unread')
  async markUnread(@Param('id') id: string) {
    await this.notificationsService.markAsUnread(Number(id));
    return { success: true };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    const notifId = Number(id);
    const notification = await this.notificationsService.getNotificationById(
      notifId,
    );
    if (!notification) {
      return { success: true };
    }

    const serviceNum = req.user?.serviceNum;
    if (notification.recipientServiceNumber !== serviceNum) {
      throw new ForbiddenException(
        'You are not allowed to delete this notification',
      );
    }

    await this.notificationsService.deleteNotification(notifId);
    return { success: true };
  }
}
