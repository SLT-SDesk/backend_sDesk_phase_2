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

@Controller()
export class TeamAdminController {
  private readonly logger = new Logger(TeamAdminController.name);

  constructor(private readonly teamAdminService: TeamAdminService) {}

  @Post('admin/:teamId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async createTeamAdmin(
    @Param('teamId') teamId: string,
    @Body() teamAdminDto: TeamAdminDto,
  ): Promise<TeamAdmin> {
    try {
      return await this.teamAdminService.createTeamAdmin(teamAdminDto, teamId);
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
  async updateTeamAdminByTeamId(
    @Param('id') id: string,
    @Body() teamAdminDto: TeamAdminDto,
  ): Promise<TeamAdmin> {
    try {
      return await this.teamAdminService.updateTeamAdminByTeamId(
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
  async deleteTeamAdminByTeamId(@Param('id') id: string) {
    try {
      await this.teamAdminService.removeTeamAdminByTeamId(id);
      return {
        message: `Team admin with teamId ${id} successfully deleted`,
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
}
