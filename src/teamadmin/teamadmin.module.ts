
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamAdminController } from './teamadmin.controller';
import { TeamAdminService } from './teamadmin.service';
import { TeamAdmin } from './entities/teamadmin.entity';
import { UserRoleModule } from '../user-role/user-role.module';
import { TechnicianModule } from '../technician/technician.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamAdmin]),
    forwardRef(() => UserRoleModule),
    forwardRef(() => TechnicianModule),
  ],
  controllers: [TeamAdminController],
  providers: [TeamAdminService],
  exports: [TeamAdminService],
})
export class TeamAdminModule { }