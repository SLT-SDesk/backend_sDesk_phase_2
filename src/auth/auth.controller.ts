import { Controller, Post, Body, Res, Req, Get, Headers } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { MicrosoftLoginDto } from './dto/microsoft-login.dto';
import { verify } from 'jsonwebtoken';
import { TeamAdminService } from '../teamadmin/teamadmin.service';
import { TechnicianService } from '../technician/technician.service';
import { emitTechnicianStatusChange } from '../main';
import { User } from './interface/auth.interface';
import { UserPayload } from './interface/user-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly teamAdminService: TeamAdminService,
    private readonly technicianService: TechnicianService,
  ) {}

  @Post('login')
  async microsoftLogin(
    @Body() body: MicrosoftLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    success: boolean;
    user?: User;
    message?: string;
    accessToken?: string;
  }> {
    try {
      const { accessToken, refreshToken, user } =
        await this.authService.handleMicrosoftLogin(
          body.code,
          body.state,
          body.redirect_uri,
        );

      //  Update technician to active if login was successful
      if (user.role === 'technician' && user.serviceNum) {
        await this.technicianService.updateTechnicianActive(
          user.serviceNum,
          true,
        );

        // Emit WebSocket event so all admins update instantly
        emitTechnicianStatusChange(user.serviceNum, true);
      }

      // Set refresh token cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true, // Must be true in production
        sameSite: 'none', // Allows cross-origin
        path: '/auth/refresh-token', // Optional, restricts cookie to refresh endpoint
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Set access token cookie
      res.cookie('jwt', accessToken, {
        httpOnly: true,
        secure: true, // Must be true in production
        sameSite: 'none', // Allows cross-origin
        maxAge: 60 * 60 * 1000,
      });

      return { success: true, user, accessToken };
    } catch {
      return { success: false, message: 'Login failed' };
    }
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const refreshToken = req.cookies?.refreshToken;
      const token = req.cookies?.jwt;

      if (token) {
        try {
          const payload = verify(
            token,
            process.env.JWT_SECRET || 'your-secret-key',
          ) as UserPayload;
          if (payload.role === 'technician' && payload.serviceNum) {
            await this.technicianService.updateTechnicianActive(
              payload.serviceNum,
              false,
            );
            if (payload.role === 'technician' && payload.serviceNum) {
              await this.technicianService.updateTechnicianActive(
                payload.serviceNum,
                false,
              );
              emitTechnicianStatusChange(payload.serviceNum, false);
            }
          }
        } catch (e) {
          return {
            success: false,
            message: `Technician status update error: ${e instanceof Error ? e.message : e}`,
          };
        }
      }

      if (typeof refreshToken === 'string') {
        try {
          this.authService.revokeRefreshToken(refreshToken);
        } catch (e) {
          return {
            success: false,
            message: `Refresh token revoke error: ${e instanceof Error ? e.message : e}`,
          };
        }
      }

      try {
        res.clearCookie('refreshToken', {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/auth/refresh-token',
        });
      } catch (e) {
        return {
          success: false,
          message: `Clear refreshToken cookie error: ${e instanceof Error ? e.message : e}`,
        };
      }

      try {
        res.clearCookie('jwt', {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
        });
      } catch (e) {
        return {
          success: false,
          message: `Clear jwt cookie error: ${e instanceof Error ? e.message : e}`,
        };
      }

      return { success: true, message: 'Logged out successfully' };
    } catch {
      return { success: false, message: 'Logout failed' };
    }
  }

  @Post('refresh-token')
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean; accessToken?: string; message?: string }> {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (typeof refreshToken !== 'string') {
        res.clearCookie('jwt', {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/auth/refresh-token',
        });
        return { success: false, message: 'No refresh token provided' };
      }

      const accessToken = await this.authService.refreshJwtToken(refreshToken);
      res.cookie('jwt', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 60 * 60 * 1000,
      });

      return { success: true, accessToken };
    } catch {
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      });
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/auth/refresh-token',
      });
      return { success: false, message: 'Token refresh failed' };
    }
  }

  @Get('logged-user')
  async getLoggedUser(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return { success: false, message: 'No token provided' };
    }

    try {
      const payload = verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key',
      ) as UserPayload;

      if (payload.role === 'admin' && payload.serviceNum) {
        const admin = await this.teamAdminService.findTeamAdminByServiceNumber(
          payload.serviceNum,
        );
        if (admin) {
          return { success: true, user: { ...admin, role: 'admin' } };
        } else {
          return {
            success: false,
            message: 'Admin not found for this service number',
          };
        }
      }

      if (payload.role === 'technician' && payload.serviceNum) {
        const technician = await this.technicianService.findOneTechnician(
          payload.serviceNum,
        );
        if (technician) {
          return { success: true, user: { ...technician, role: 'technician' } };
        } else {
          return {
            success: false,
            message: 'Technician not found for this service number',
          };
        }
      }

      if (payload.role === 'user') {
        return { success: true, user: { ...payload, role: 'user' } };
      }

      return { success: true, user: payload };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TokenExpiredError') {
          return { success: false, message: 'Token expired' };
        }
        if (error.name === 'JsonWebTokenError') {
          return { success: false, message: 'Invalid token' };
        }
      }
      return { success: false, message: 'Token verification failed' };
    }
  }
}
