import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamAdmin } from './entities/teamadmin.entity';
import { TeamAdminDto } from './dto/teamadmin-dto';

@Injectable()
export class TeamAdminService {
  private readonly logger = new Logger(TeamAdminService.name);

  constructor(
    @InjectRepository(TeamAdmin)
    private teamAdminRepository: Repository<TeamAdmin>,
  ) {}

  async createTeamAdmin(
    teamAdminDto: TeamAdminDto,
    teamId: string,
  ): Promise<TeamAdmin> {
    try {
      // Ensure the teamId from the URL param is used
      const teamAdmin = this.teamAdminRepository.create({
        ...teamAdminDto,
        teamId,
      });
      return await this.teamAdminRepository.save(teamAdmin);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to create team admin: ${message}`,
      );
    }
  }

  async updateTeamAdmin(
    id: string,
    teamAdminDto: TeamAdminDto,
  ): Promise<TeamAdmin> {
    try {
      const teamAdmin = await this.findTeamAdminById(id);
      if (!teamAdmin) {
        throw new NotFoundException(`Team admin with ID ${id} not found`);
      }

      // Check if team is being changed
      if (teamAdminDto.teamId !== teamAdmin.teamId) {
        const existingAdmin = await this.findTeamAdminByTeamId(teamAdminDto.teamId);
        if (existingAdmin && existingAdmin.id !== id) {
          throw new InternalServerErrorException(
            `Team ${teamAdminDto.teamName} already has an assigned administrator.`,
          );
        }
      }

      Object.assign(teamAdmin, teamAdminDto);
      return await this.teamAdminRepository.save(teamAdmin);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to update team admin: ${message}`,
      );
    }
  }

  async removeTeamAdmin(id: string): Promise<void> {
    try {
      const teamAdmin = await this.findTeamAdminById(id);
      if (!teamAdmin) {
        throw new NotFoundException(`Team admin with ID ${id} not found`);
      }
      const result = await this.teamAdminRepository.delete(id);
      if (result.affected === 0) {
        throw new InternalServerErrorException(
          `Failed to delete team admin with ID ${id}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to delete team admin: ${message}`,
      );
    }
  }

  async findAllTeamAdmins(): Promise<TeamAdmin[]> {
    try {
      return await this.teamAdminRepository.find();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to retrieve team admins: ${message}`,
      );
    }
  }

  async findTeamAdminByTeamId(teamId: string): Promise<TeamAdmin | null> {
    try {
      return await this.teamAdminRepository.findOne({ where: { teamId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to find team admin by teamId ${teamId}: ${message}`,
      );
    }
  }

  async findTeamAdminById(id: string): Promise<TeamAdmin | null> {
    try {
      return await this.teamAdminRepository.findOne({ where: { id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to find team admin by ID ${id}: ${message}`,
      );
    }
  }

  async findTeamAdminByServiceNumber(
    serviceNumber: string,
  ): Promise<TeamAdmin | null> {
    try {
      return await this.teamAdminRepository.findOne({
        where: { serviceNumber },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to find team admin by serviceNumber ${serviceNumber}: ${message}`,
      );
    }
  }
}
