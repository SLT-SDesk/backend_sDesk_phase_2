import { Injectable, NotFoundException } from '@nestjs/common';
import { ErpService } from '../erp/erp.service';

@Injectable()
export class UserLookupService {
  constructor(
    private readonly erpService: ErpService,
  ) {}

  async lookupByServiceNum(serviceNum: string) {
    const employee = await this.erpService.getEmployeeByServiceNum(serviceNum);

    if (!employee) {
      throw new NotFoundException('User not found');
    }

    // TEMP: until DB role check is added
    const role = 'user';

    return {
      serviceNum: employee.employeeNumber,
      display_name: employee.employeeName,
      email: employee.email,
      contactNumber: employee.mobileNo,
      role,               // 🔥 REQUIRED
      designation: employee.designation,
    };
  }
}
