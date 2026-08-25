import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { sign, decode, verify } from 'jsonwebtoken';
import { User, JwtPayload } from './interface/auth.interface';

// Define DecodedIdToken interface to match expected id_token structure
interface DecodedIdToken {
  oid?: string;
  preferred_username?: string;
  name?: string;
  [key: string]: unknown;
}
import { SLTUsersService } from '../sltusers/sltusers.service';

import { SLTUser } from '../sltusers/entities/sltuser.entity';
import { v4 as uuidv4 } from 'uuid';

const refreshTokensStore = new Map<string, string>();
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
    private readonly sltUsersService: SLTUsersService,
  ) {}

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

  generateTokens(user: SLTUser) {
    const accessToken = sign(
      {
        name: user.display_name,
        email: user.email,
        role: user.role,
        serviceNum: user.serviceNum,
        contactNumber: user.contactNumber,
      },
      this.configService.get<string>('JWT_SECRET', 'your-secret-key'),
      { expiresIn: '15m' }, // Short-lived access token
    );
    const refreshToken = uuidv4();
    refreshTokensStore.set(refreshToken, user.email);
    return { accessToken, refreshToken };
  }

  async handleMicrosoftLogin(
    code: string,
    state: string,
    redirect_uri: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    try {
      if (state !== '12345') {
        throw new BadRequestException('Invalid state');
      }
      const tokenResponse = await axios.post<MicrosoftTokenResponse>(
        `https://login.microsoftonline.com/${this.configService.get('AZURE_TENANT_ID')}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: this.configService.get('AZURE_CLIENT_ID') || '',
          client_secret: this.configService.get('AZURE_CLIENT_SECRET') || '',
          code,
          redirect_uri,
          grant_type: 'authorization_code',
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

      if (id_token) {
        const decodedIdToken = decode(id_token) as DecodedIdToken;
        const azureId = this.getStringFromDecoded(decodedIdToken, 'oid');
        const email = this.getStringFromDecoded(
          decodedIdToken,
          'preferred_username',
        );
        const name = this.getStringFromDecoded(decodedIdToken, 'name');
        let serviceNum = '';
        if (email && typeof email === 'string') {
          serviceNum = email.split('@')[0];
        }
        if (!azureId || !email) {
          throw new UnauthorizedException('Missing user info in id_token');
        }
        let user: SLTUser | null =
          await this.sltUsersService.findByAzureId(azureId);
        if (!user) {
          user = await this.sltUsersService.createUser({
            azureId,
            display_name: name,
            email,
            serviceNum,
            role: 'user',
            contactNumber,
          });
        } else {
          const updates: Partial<SLTUser> = {};
          // check if name changed
          if (name && user.display_name !== name) {
            updates.display_name = name;
          }
          // check if contact number changed
          if (contactNumber && contactNumber !== user.contactNumber) {
            updates.contactNumber = contactNumber;
          }
          // chack if the email changed
          if (email && email !== user.email) {
            updates.email = email;
          }
          //Skip the update if no changes
          if (Object.keys(updates).length > 0) {
            const updated = await this.sltUsersService.updateUser(
              azureId,
              updates,
            );
            if (updated) {
              user = updated;
            }
          }
        }
        if (!user) throw new UnauthorizedException('User creation failed');
        const { accessToken, refreshToken } = this.generateTokens(user);

        return {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.display_name,
            role: user.role,
            serviceNum: user.serviceNum,
            contactNumber: user.contactNumber,
          },
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
    try {
      if (typeof refreshToken !== 'string' || !refreshToken) {
        throw new UnauthorizedException('No refresh token provided');
      }
      const email = refreshTokensStore.get(refreshToken);
      if (!email) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const user = await this.sltUsersService.findByEmail(email);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      const accessToken = sign(
        {
          name: user.display_name,
          email: user.email,
          role: user.role,
          serviceNum: user.serviceNum,
          contactNumber: user.contactNumber,
        },
        this.configService.get<string>('JWT_SECRET', 'your-secret-key'),
        { expiresIn: '15m' },
      );
      return typeof accessToken === 'string' ? accessToken : '';
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Error refreshing token');
    }
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
