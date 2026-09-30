import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { Team } from './entities/team.entity';
import { JwtAuthGuard } from '../middlewares/jwt-auth.guard';
import { RolesGuard } from '../middlewares/roles.guard';
import { Roles } from '../middlewares/roles.decorator';

@Controller('team')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) { }

  @Post()
  @Roles('admin', 'superAdmin')
  async create(@Body() createTeamDto: CreateTeamDto): Promise<Team> {
    return this.teamService.create(createTeamDto);
  }

  @Get()
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async findAll(): Promise<Team[]> {
    return this.teamService.findAll();
  }

  @Get(':id')
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async findOne(@Param('id') id: string): Promise<Team> {
    return this.teamService.findOne(+id);
  }

  @Put(':teamId')
  @Roles('admin', 'superAdmin')
  async update(
    @Param('teamId') teamId: string,
    @Body() updateTeamDto: UpdateTeamDto,
  ): Promise<Team> {
    return this.teamService.update(+teamId, updateTeamDto);
  }

  @Delete(':teamId')
  @Roles('superAdmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('teamId') teamId: string): Promise<void> {
    return this.teamService.remove(+teamId);
  }
}