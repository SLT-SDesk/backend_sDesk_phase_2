
import {  forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Technician } from './entities/technician.entity';
import { TechnicianService } from './technician.service';
import { TechnicianController } from './technician.controller';
import { AuthModule } from '../auth/auth.module';
import { UserRoleModule } from '../user-role/user-role.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([Technician]),
    forwardRef(() => AuthModule),
    forwardRef(() => UserRoleModule),
  ],
  providers: [TechnicianService],
  controllers: [TechnicianController],
  exports: [TechnicianService],
})
export class TechnicianModule {}
