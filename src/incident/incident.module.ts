import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryItem, SubCategory } from '../Categories/Entities/Categories.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { TeamAdmin } from '../teamadmin/entities/teamadmin.entity';
import { Technician } from '../technician/entities/technician.entity';
import { TechnicianModule } from '../technician/technician.module';
import { IncidentHistory } from './entities/incident-history.entity';
import { Incident } from './entities/incident.entity';
import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';
import { TechnicianPerformance } from './entities/technician-performance.entity'; // new**
import { ErpModule } from 'src/erp/erp.module';


@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      Incident,
      Technician,
      IncidentHistory,
      CategoryItem,
      TeamAdmin,
      TechnicianPerformance, //new**
      SubCategory,
    ]),
    TechnicianModule,
    NotificationsModule,
    ErpModule,
  ],
  controllers: [IncidentController],
  providers: [IncidentService],
})
export class IncidentModule { }
