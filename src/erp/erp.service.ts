import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ErpEmployee } from './interface/erp-employee.interface';

@Injectable()
export class ErpService {
  private readonly url: string;
  private readonly username: string;
  private readonly password: string;

  constructor(private readonly configService: ConfigService) {
    this.url =
      this.configService.get<string>('ERP_EMPLOYEE_API_URL')!;
    this.username = this.configService.get<string>('ERP_USERNAME')!;
    this.password = this.configService.get<string>('ERP_PASSWORD')!;

    // TEMP DEBUG (REMOVE AFTER TEST)
  console.log('ERP ENV CHECK:', {
    username: this.username,
    password: this.password,
    passwordLength: this.password?.length,
  });
  }

  
  async getEmployeeByServiceNum(
    serviceNum: string,
  ): Promise<ErpEmployee | null> {
    try {
      const response = await axios.post(
        this.url,
        {
          organizationID: 'string',
          costCenterCode: 'string',
          employeeNo: serviceNum,
        },
        {
          headers: {
            Accept: 'text/plain',
            'Content-Type': 'application/json',

            // EXACTLY like curl
            UserName: this.username,
            Password: this.password,
          },
        },
      );

      return response.data?.data?.[0] ?? null;
    } catch (error: any) {
      console.error(
        'ERP API error:',
        error?.response?.data || error.message,
      );

      throw new UnauthorizedException(
        'Failed to fetch employee from ERP',
      );
    }
  }

}
