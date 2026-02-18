import { Body, Controller, Post } from '@nestjs/common';
import { UserRoleService } from './user-role.service';
import { UserRoleEnum } from './entities/user-role.entity';

@Controller('user-role')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Post('assign')
  async assignRole(
    @Body('serviceNumber') serviceNum: string,
    @Body('role') role: UserRoleEnum,
  ) {
    return this.userRoleService.assignRole(serviceNum, role);
  }
}
