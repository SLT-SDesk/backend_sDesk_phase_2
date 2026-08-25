
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamAdminController } from './teamadmin.controller';
import { TeamAdminService } from './teamadmin.service';
import { TeamAdmin } from './entities/teamadmin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TeamAdmin])],
  controllers: [TeamAdminController],
  providers: [TeamAdminService],
  exports: [TeamAdminService],
})
export class TeamAdminModule {}