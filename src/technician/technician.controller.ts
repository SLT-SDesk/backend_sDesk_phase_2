/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpException,
  HttpStatus,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../middlewares/jwt-auth.guard';
import { RolesGuard } from '../middlewares/roles.guard';
import { Roles } from '../middlewares/roles.decorator';
import { TechnicianService } from './technician.service';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { Technician } from './entities/technician.entity';
import { AuthService } from '../auth/auth.service';
import { Response, Request } from 'express';
import { Session } from '../sessions/entities/session.entity';
// new imports for role management
import { UserRoleService } from '../user-role/user-role.service';
import { UserRoleEnum } from '../user-role/entities/user-role.entity';

@Controller()
export class TechnicianController {
  constructor(
    private readonly technicianService: TechnicianService,
    private readonly authService: AuthService,
    private readonly userRoleService: UserRoleService, // added for automatic role assignment
  ) {}

  @Get('technician/sessions/:serviceNum')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getTechnicianWithSessions(
    @Param('serviceNum') serviceNum: string,
  ): Promise<Technician> {
    try {
      return await this.technicianService.getTechnicianWithSessions(serviceNum);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch technician with sessions.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('technician/sessions-teamId/:teamId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getAllTechnicianNameWithSessionsByMainCategory(
    @Param('teamId') teamId: string,
  ): Promise<{
    serviceNum: string;
    name: string;
    sessions: Session[];
  } []> {
    try {
      return await this.technicianService.getAllTechnicianNameWithSessionsByMainCategory(teamId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch technician name with sessions by main category.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('technician')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async add(
    @Body() dto: CreateTechnicianDto,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<any> {
    const accessToken = req.cookies?.jwt;

    let isActive = false;
    let shouldClearCookies = false;

    if (accessToken) {
      try {
        const user = this.authService.getUserFromAccessToken(accessToken);
        if (user && user.role === 'technician') {
          isActive = true;
        } else {
          shouldClearCookies = true;
        }
      } catch {
        shouldClearCookies = true;
      }
    } else {
      shouldClearCookies = true;
    }

    dto.active = isActive;
    const technician = await this.technicianService.createTechnician(dto);

    // make sure the user_roles table reflects the new technician role
    try {
      await this.userRoleService.assignRole(
        technician.serviceNum,
        UserRoleEnum.TECHNICIAN,
      );
    } catch (assignErr) {
      // log but do not block the response; user should still be created
      console.error('Failed to assign role for technician', assignErr);
    }

    if (shouldClearCookies) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
    }

    return res.json(technician);
  }

  @Get('technicians')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async findAllTechnicians(): Promise<Technician[]> {
    try {
      return await this.technicianService.findAllTechncians();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch technicians.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('check-status')
  async checkStatus() {
    try {
      return await this.technicianService.checkTechnicianStatus();
    } catch (error) {
      throw new HttpException(
        'Unable to fetch technician status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('technician/:serviceNum')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async findOneTechnician(
    @Param('serviceNum') serviceNum: string,
  ): Promise<Technician> {
    try {
      return await this.technicianService.findOneTechnician(serviceNum);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch technician.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('technician/:serviceNum')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'technician')
  async updateTechnician(
    @Param('serviceNum') serviceNum: string,
    @Body() dto: CreateTechnicianDto,
  ): Promise<Technician> {
    try {
      return await this.technicianService.updateTechnician(serviceNum, dto);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update technician.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('technician/:serviceNum')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteTechnician(
    @Param('serviceNum') serviceNum: string,
  ): Promise<{ message: string }> {
    try {
      await this.technicianService.deleteTechnician(serviceNum);
      
      // Also clean up the user_roles table entry for consistency
      try {
        await this.userRoleService.removeRole(serviceNum);
      } catch (e) {
        console.warn('Failed to remove user role entry during technician deletion', e);
      }
      
      return { message: 'Technician deleted successfully.' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete technician.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  @Put('technician/:serviceNum/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async deactivateTechnician(@Param('serviceNum') serviceNum: string) {
    try {
      await this.technicianService.updateTechnicianActive(serviceNum, false);
      return { message: 'Technician deactivated' };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to deactivate technician',
          details: error.message || error,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  @Put('technician/:serviceNum/force-logout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superAdmin')
  async forceLogoutTechnician(
    @Param('serviceNum') serviceNum: string,
    @Req() req: Request,
  ) {
    try {
      await this.technicianService.updateTechnicianActive(serviceNum, false);
      return { message: 'Technician force logout initiated', serviceNum };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to force logout technician',
          details: error.message || error,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
