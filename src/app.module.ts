import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { CategoryModule } from './Categories/Categories.module';
import {
    CategoryItem,
    MainCategory,
    SubCategory,
} from './Categories/Entities/Categories.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { IncidentHistory } from './incident/entities/incident-history.entity';
import { Incident } from './incident/entities/incident.entity';
import { IncidentModule } from './incident/incident.module';
import { Location } from './location/entities/location.entity';
import { LocationModule } from './location/location.module';
import { Notification } from './notifications/notification.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { SLTUser } from './sltusers/entities/sltuser.entity';
import { SLTUsersModule } from './sltusers/sltusers.module';
import { Team } from './team/entities/team.entity';
import { TeamAdmin } from './teamadmin/entities/teamadmin.entity';
import { TeamAdminModule } from './teamadmin/teamadmin.module';
import { Technician } from './technician/entities/technician.entity';
import { TechnicianModule } from './technician/technician.module';


dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [
        TeamAdmin,
        Incident,
        Notification,
        MainCategory,
        SubCategory,
        CategoryItem,
        SLTUser,
        Team,
        Technician,
        Location,
         IncidentHistory,
      ],
      synchronize: true,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }),
    IncidentModule,
    TeamAdminModule,
    CategoryModule,
    AuthModule,
    SLTUsersModule,
    TechnicianModule,
    LocationModule,
  NotificationsModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}  