import { Controller, Get, Param } from '@nestjs/common';
import { UserLookupService } from './user-lookup.service';

@Controller('users')
export class UserLookupController {
  constructor(
    private readonly userLookupService: UserLookupService,
  ) {}

  @Get('lookup/:serviceNum')
  lookup(@Param('serviceNum') serviceNum: string) {
    return this.userLookupService.lookupByServiceNum(serviceNum);
  }
}
