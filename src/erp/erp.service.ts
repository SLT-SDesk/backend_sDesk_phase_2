import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ErpEmployee } from './interface/erp-employee.interface';

@Injectable()
export class ErpService {
  constructor() {}

  /**
   * [Rule 1 & 2 Implementation]
   * Fetches full employee details from the SLT ERP API using service number.
   * This matches the specific cURL command provided.
   * @param serviceNo The employee's service number (employeeNo in payload)
   */
  async getEmployeeDetailsForServiceNo(
    serviceNo: string,
  ): Promise<ErpEmployee | null> {
    try {
      const apiUrl = 'https://oneidentitytest.slt.com.lk/ERPAPIs/api/ERPData/GetAllEmployeeDetailsForServiceNo';
      
      const response = await axios.post(
        apiUrl,
        {
          organizationID: "string",
          costCenterCode: "string",
          employeeNo: serviceNo,
        },
        {
          headers: {
            'accept': 'text/plain',
            'UserName': 'dpuser3',
            'Password': 'dp@sltErp#',
            'Content-Type': 'application/json',
          },
        },
      );

      // Extract the first employee from the data array
      const employeeData = response.data?.data?.[0];
      
      if (!employeeData) {
        console.warn(`[ERP] No employee found for service number: ${serviceNo}`);
        return null;
      }

      // Map API response fields to ErpEmployee interface
      return {
        employeeNumber: employeeData.employeeNumber,
        employeeName: employeeData.employeeName,
        email: employeeData.email,
        mobileNo: employeeData.mobileNo || employeeData.mobilePhone,
        designation: employeeData.designation,
        gradeName: employeeData.gradeName,
      };
    } catch (error: any) {
      console.error(
        'ERP API error:',
        error?.response?.data || error.message,
      );

      // Return null so login doesn't crash if ERP is down
      return null;
    }
  }

  // Backward compatibility alias
  async getEmployeeByServiceNum(serviceNum: string) {
    return this.getEmployeeDetailsForServiceNo(serviceNum);
  }
}
