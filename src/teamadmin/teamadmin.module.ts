
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamAdminController } from './teamadmin.controller';
import { TeamAdminService } from './teamadmin.service';
import { TeamAdmin } from './entities/teamadmin.entity';
import { UserRoleModule } from '../user-role/user-role.module';

@Module({
  imports: [TypeOrmModule.forFeature([TeamAdmin]), forwardRef(() => UserRoleModule)],
  controllers: [TeamAdminController],
  providers: [TeamAdminService],
  exports: [TeamAdminService],
})
export class TeamAdminModule {}