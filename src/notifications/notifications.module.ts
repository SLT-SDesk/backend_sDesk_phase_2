import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsService } from './sms.service';
import { ErpModule } from '../erp/erp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    ErpModule,
  ],
  providers: [NotificationsService, SmsService],
  controllers: [NotificationsController],
  exports: [NotificationsService, SmsService],
})
export class NotificationsModule {}
