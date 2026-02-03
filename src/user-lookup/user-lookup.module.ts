import { Module } from '@nestjs/common';
import { ErpModule } from '../erp/erp.module';
import { UserLookupController } from './user-lookup.controller';
import { UserLookupService } from './user-lookup.service';

@Module({
  imports: [ErpModule], 
  controllers: [UserLookupController],
  providers: [UserLookupService],
})
export class UserLookupModule {}
