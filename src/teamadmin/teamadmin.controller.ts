import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { TeamAdminService } from './teamadmin.service';
import { TeamAdmin } from './entities/teamadmin.entity';
import { TeamAdminDto } from './dto/teamadmin-dto';
import { JwtAuthGuard } from '../middlewares/jwt-auth.guard';
import { RolesGuard } from '../middlewares/roles.guard';
import { Roles } from '../middlewares/roles.decorator';
import { Req } from '@nestjs/common';
// new imports for roles
import { UserRoleService } from '../user-role/user-role.service';
import { UserRoleEnum } from '../user-role/entities/user-role.entity';

@Controller()
export class TeamAdminController {
  private readonly logger = new Logger(TeamAdminController.name);

  constructor(
    private readonly teamAdminService: TeamAdminService,
    private readonly userRoleService: UserRoleService, // ensure role table updated
  ) { }


  @Post('admin/:teamId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async createTeamAdmin(
    @Param('teamId') teamId: string,
    @Body() teamAdminDto: TeamAdminDto,
  ): Promise<TeamAdmin> {
    try {
      const created = await this.teamAdminService.createTeamAdmin(teamAdminDto, teamId);

      // also assign role so authentication recognizes this user as an admin
      try {
        await this.userRoleService.assignRole(
          teamAdminDto.serviceNumber,
          UserRoleEnum.ADMIN,
        );
      } catch (assignErr) {
        console.error('Unable to assign user role for new admin', assignErr);
      }

      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        `Failed to create team admin: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async updateTeamAdmin(
    @Param('id') id: string,
    @Body() teamAdminDto: TeamAdminDto,
  ): Promise<TeamAdmin> {
    try {
      return await this.teamAdminService.updateTeamAdmin(
        id,
        teamAdminDto,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update team admin: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async deleteTeamAdmin(@Param('id') id: string) {
    try {
      await this.teamAdminService.removeTeamAdmin(id);
      return {
        message: `Team admin with ID ${id} successfully deleted`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete team admin: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('admins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getAllTeamAdmins(): Promise<TeamAdmin[]> {
    try {
      return await this.teamAdminService.findAllTeamAdmins();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        `Failed to retrieve team admins: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('admin/serviceNumber/:serviceNumber')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getTeamAdminByServiceNumber(
    @Param('serviceNumber') serviceNumber: string,
  ): Promise<TeamAdmin> {
    try {
      const admin =
        await this.teamAdminService.findTeamAdminByServiceNumber(serviceNumber);
      if (!admin) {
        throw new HttpException(
          `Team admin with serviceNumber ${serviceNumber} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      return admin;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to retrieve team admin: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('admin/me')
  @UseGuards(JwtAuthGuard)
  async getMyTeamAdmin(@Req() req): Promise<TeamAdmin> {
    const serviceNumber = req.user?.serviceNumber;

    if (!serviceNumber) {
      throw new HttpException(
        'Service number not found in token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const admin =
      await this.teamAdminService.findTeamAdminByServiceNumber(serviceNumber);

    if (!admin) {
      throw new HttpException(
        'Team admin not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return admin;
  }



}
