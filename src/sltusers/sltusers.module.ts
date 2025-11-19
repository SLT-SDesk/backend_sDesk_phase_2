import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SLTUsersController } from './sltusers.controller';
import { SLTUsersService } from './sltusers.service';
import { SLTUser } from './entities/sltuser.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [TypeOrmModule.forFeature([SLTUser]), ConfigModule],
  controllers: [SLTUsersController],
  providers: [SLTUsersService],
  exports: [SLTUsersService],
})
export class SLTUsersModule {}
