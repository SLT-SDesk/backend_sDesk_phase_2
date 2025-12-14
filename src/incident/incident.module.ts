import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryItem } from '../Categories/Entities/Categories.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SLTUser } from '../sltusers/entities/sltuser.entity';
import { TeamAdmin } from '../teamadmin/entities/teamadmin.entity';
import { Technician } from '../technician/entities/technician.entity';
import { TechnicianModule } from '../technician/technician.module';
import { IncidentHistory } from './entities/incident-history.entity';
import { Incident } from './entities/incident.entity';
import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';
import { TechnicianPerformance } from './entities/technician-performance.entity'; // new**


@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      Incident,
      Technician,
      IncidentHistory,
      CategoryItem,
      SLTUser,
      TeamAdmin,
      TechnicianPerformance, //new**
    ]),
    TechnicianModule,
    NotificationsModule,
  ],
  controllers: [IncidentController],
  providers: [IncidentService],
})
export class IncidentModule {}
