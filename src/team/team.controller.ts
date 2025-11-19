// src/team/team.controller.ts
import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { Team } from './entities/team.entity';



@Controller('team')
//@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  
  @Post()
  //@Roles(Role.Admin, Role.SuperAdmin)
  async create(@Body() createTeamDto: CreateTeamDto): Promise<Team> {
    return this.teamService.create(createTeamDto);
  }

  
  @Get()
  //@Roles(Role.Admin, Role.SuperAdmin)
  async findAll(): Promise<Team[]> {
    return this.teamService.findAll();
  }

  
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Team> {
    return this.teamService.findOne(+id);
  }

  
  @Put(':teamId')
 // @Roles(Role.Admin, Role.SuperAdmin)
  async update(
    @Param('teamId') teamId: string,
    @Body() updateTeamDto: UpdateTeamDto,
  ): Promise<Team> {
    return this.teamService.update(+teamId, updateTeamDto);
  }


  @Delete(':teamId')
  //@Roles(Role.Admin, Role.SuperAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('teamId') teamId: string): Promise<void> {
    return this.teamService.remove(+teamId);
  }
}