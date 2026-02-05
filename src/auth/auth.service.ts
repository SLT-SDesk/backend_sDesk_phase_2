import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { sign, decode, verify } from 'jsonwebtoken';
import { User, JwtPayload, Role } from './interface/auth.interface';
import { ErpEmployee } from 'src/erp/interface/erp-employee.interface';

// Define DecodedIdToken interface to match expected id_token structure
interface DecodedIdToken {
  oid?: string;
  preferred_username?: string;
  name?: string;
  [key: string]: unknown;
}
import { v4 as uuidv4 } from 'uuid';
import { UserRoleService } from 'src/user-role/user-role.service';
import { ErpService } from 'src/erp/erp.service';

const refreshTokensStore = new Map<
  string,
  {
    serviceNum: string;
    name: string;
    email: string;
  }
>();

interface MicrosoftTokenResponse {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  [key: string]: any;
}

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private readonly userRoleService: UserRoleService,
    private readonly erpService: ErpService,
  ) { }

  private getStringFromDecoded(
    decoded: DecodedIdToken | null | undefined,
    key: string,
  ): string {
    if (decoded && typeof decoded === 'object' && key in decoded) {
      const value = (decoded as Record<string, unknown>)[key];
      return typeof value === 'string' ? value : '';
    }
    return '';
  }


  async handleMicrosoftLogin(
    code: string,
    state: string,
    redirect_uri: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {

    console.log('🔥 handleMicrosoftLogin HIT');
    console.log('ENV:', process.env.NODE_ENV);
    console.log('CODE:', code);
    console.log('REDIRECT_URI:', redirect_uri);

    try {
      if (state !== '12345') {
        throw new BadRequestException('Invalid state');
      }
      const tokenResponse = await axios.post(
        `https://login.microsoftonline.com/${this.configService.get('AZURE_TENANT_ID')}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: this.configService.get('AZURE_CLIENT_ID') || '',
          client_secret: this.configService.get('AZURE_CLIENT_SECRET') || '',
          code,
          redirect_uri,
          grant_type: 'authorization_code',
          scope: 'openid profile email offline_access',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );



      const id_token: string | undefined = (
        tokenResponse.data as { id_token?: string }
      ).id_token;
      const access_token: string | undefined = (
        tokenResponse.data as { access_token?: string }
      ).access_token;
      let contactNumber: string | undefined = undefined;

      // Fetch contact number from Microsoft Graph API if access_token is available
      if (access_token) {
        try {
          const graphResponse = await axios.get(
            'https://graph.microsoft.com/v1.0/me',
            {
              headers: { Authorization: `Bearer ${access_token}` },
            },
          );
          // Try to get mobilePhone or businessPhones[0]
          const data = graphResponse.data as {
            mobilePhone?: string;
            businessPhones?: string[];
          };
          contactNumber =
            data.mobilePhone ||
            (Array.isArray(data.businessPhones)
              ? data.businessPhones[0]
              : undefined);
        } catch (e) {
          let errMsg = 'Unknown error';
          if (e && typeof e === 'object' && 'message' in e) {
            errMsg = (e as { message: string }).message;
          } else if (typeof e === 'string') {
            errMsg = e;
          }
          throw new UnauthorizedException(
            'Failed to fetch contact number from Microsoft Graph API: ' +
            errMsg,
          );
        }
      }
      //changed new**s
      if (id_token) {
        const decodedIdToken = decode(id_token) as DecodedIdToken;
        const azureId = this.getStringFromDecoded(decodedIdToken, 'oid');
        const email =
          this.getStringFromDecoded(decodedIdToken, 'preferred_username') ||
          this.getStringFromDecoded(decodedIdToken, 'email') ||
          this.getStringFromDecoded(decodedIdToken, 'upn');

        console.log('Decoded ID token:', decodedIdToken);
        console.log('Resolved email:', email);

        // changed new**s
        const name = this.getStringFromDecoded(decodedIdToken, 'name');
        let serviceNum = '';

        if (email && typeof email === 'string') {
          const prefix = email.split('@')[0];
          serviceNum = prefix;
          console.log('Extracted serviceNum from email:', serviceNum);


        }

        if (!azureId || !email) {
          throw new UnauthorizedException('Missing user info in id_token');
        }

        // Canonical identity values
        let finalServiceNum = serviceNum;
        let finalDisplayName = name;
        let finalEmail = email;
        let finalContactNumber = contactNumber;

        // ERP integration (DEV + PROD)
        let employee: ErpEmployee | null = null;

        const shouldCallErp =
          process.env.NODE_ENV === 'production' ||
          process.env.NODE_ENV === 'development';

        if (shouldCallErp) {
          console.log('Calling ERP with service number:', serviceNum);

          employee = await this.erpService.getEmployeeByServiceNum(serviceNum);

          console.log('ERP EMPLOYEE:', employee);

          if (!employee) {
            throw new UnauthorizedException(
              `Employee not found in ERP for service number ${serviceNum}`,
            );
          }

          finalServiceNum = employee.employeeNumber;
          finalDisplayName = employee.employeeName;
          finalEmail = employee.email?.trim() || email;
          finalContactNumber = employee.mobileNo;
        }



        // Role must use finalServiceNum
        let role = await this.userRoleService.getRoleByServiceNum(finalServiceNum);

        if (!role) {
          throw new UnauthorizedException(
            `No role assigned for service number ${finalServiceNum}`,
          );
        }

        // Generate JWT tokens new**s
        const payload: JwtPayload = {
          serviceNum: finalServiceNum,
          name: finalDisplayName,
          email: finalEmail,
          role,
          contactNumber: finalContactNumber,
        };

        const accessToken = sign(
          payload,
          this.configService.get<string>('JWT_SECRET')!,
          { expiresIn: '15m' },
        );

        const refreshToken = uuidv4();
        refreshTokensStore.set(refreshToken, {
          serviceNum: finalServiceNum,
          name: finalDisplayName,
          email: finalEmail,
        });



        return {
          accessToken,
          refreshToken,
          user: payload,
        };

      }
      throw new UnauthorizedException('No id_token received from Microsoft.');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        let errorMsg: string = error.message;
        const data: unknown = error.response?.data;
        if (
          data &&
          typeof data === 'object' &&
          data !== null &&
          'error' in data &&
          typeof (data as { error?: unknown }).error === 'string'
        ) {
          errorMsg = (data as { error: string }).error;
        }
        throw new UnauthorizedException('Authentication failed: ' + errorMsg);
      }
      throw new UnauthorizedException(
        'Authentication failed: ' +
        ((error as Error).message ?? 'Unknown error'),
      );
    }
  }

  async refreshJwtToken(refreshToken: string): Promise<string> {
    const data = refreshTokensStore.get(refreshToken);

    if (!data) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const role = await this.userRoleService.getRoleByServiceNum(
      data.serviceNum,
    );

    const payload: JwtPayload = {
      serviceNum: data.serviceNum,
      name: data.name,     // REAL NAME
      email: data.email,   // REAL EMAIL
      role,
    };

    return sign(
      payload,
      this.configService.get<string>('JWT_SECRET')!,
      { expiresIn: '15m' },
    );
  }



  revokeRefreshToken(refreshToken: string) {
    refreshTokensStore.delete(refreshToken);
  }

  getUserFromAccessToken(token: string): JwtPayload {
    try {
      if (typeof token !== 'string' || !token) {
        throw new UnauthorizedException('No token provided');
      }
      try {
        const payload = verify(
          token,
          this.configService.get<string>('JWT_SECRET', 'your-secret-key'),
        ) as JwtPayload;
        return payload;
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          typeof (error as { name: unknown }).name === 'string'
        ) {
          const errorName = (error as { name: string }).name;
          if (errorName === 'TokenExpiredError') {
            throw new UnauthorizedException('Token expired');
          } else if (errorName === 'JsonWebTokenError') {
            throw new UnauthorizedException('Invalid token');
          }
        }
        throw new UnauthorizedException('Token verification failed');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Unexpected error');
    }
  }
}
