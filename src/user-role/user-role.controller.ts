import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRoleService } from './user-role.service';
import { UserRoleEnum } from './entities/user-role.entity';
import { JwtAuthGuard } from '../middlewares/jwt-auth.guard';
import { RolesGuard } from '../middlewares/roles.guard';
import { Roles } from '../middlewares/roles.decorator';

@Controller('user-role')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) { }

  @Post('assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async assignRole(
    @Body('serviceNumber') serviceNum: string,
    @Body('role') role: UserRoleEnum,
  ) {
    return this.userRoleService.assignRole(serviceNum, role);
  }
}
