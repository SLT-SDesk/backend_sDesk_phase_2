import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TeamAdminModule } from '../teamadmin/teamadmin.module';
import { TechnicianModule } from '../technician/technician.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UserRoleModule } from '../user-role/user-role.module'; 
import { ErpModule } from 'src/erp/erp.module';

@Module({
  imports: [
    ConfigModule,
    TeamAdminModule,
    forwardRef(() => TechnicianModule),
    SessionsModule,
    UserRoleModule,
    ErpModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
