import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserLookupService } from './user-lookup.service';
import { JwtAuthGuard } from '../middlewares/jwt-auth.guard';
import { RolesGuard } from '../middlewares/roles.guard';
import { Roles } from '../middlewares/roles.decorator';

@Controller('users')
export class UserLookupController {
  constructor(
    private readonly userLookupService: UserLookupService,
  ) { }

  @Get('lookup/:serviceNum')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin', 'admin', 'technician', 'teamLeader', 'user')
  lookup(@Param('serviceNum') serviceNum: string) {
    return this.userLookupService.lookupByServiceNum(serviceNum);
  }
}
