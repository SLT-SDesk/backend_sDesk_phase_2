// src/team/team.service.ts
import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
  ) {}

  async create(createTeamDto: CreateTeamDto): Promise<Team> {
    
    if (!createTeamDto || !createTeamDto.name) {
      throw new BadRequestException('Team name is required');
    }
    
    
    const existingTeam = await this.teamRepository.findOne({
      where: { name: createTeamDto.name }
    });
    
    if (existingTeam) {
      throw new ConflictException('Team with this name already exists');
    }

    const team = this.teamRepository.create(createTeamDto);
    return this.teamRepository.save(team);
  }

  async findAll(): Promise<Team[]> {
    return this.teamRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  async findOne(id: number): Promise<Team> {
    
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid team ID');
    }

    const team = await this.teamRepository.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }
    return team;
  }

  async update(id: number, updateTeamDto: UpdateTeamDto): Promise<Team> {
    
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid team ID');
    }

    
    if (!updateTeamDto || Object.keys(updateTeamDto).length === 0) {
      throw new BadRequestException('At least one field must be provided for update');
    }

   
    const team = await this.findOne(id);
    
    
    if (updateTeamDto.name && updateTeamDto.name !== team.name) {
      const existingTeam = await this.teamRepository.findOne({ 
        where: { name: updateTeamDto.name } 
      });
      
      if (existingTeam) {
        throw new ConflictException('Team with this name already exists');
      }
    }

    
    Object.assign(team, updateTeamDto);
    return this.teamRepository.save(team);
  }

  async remove(id: number): Promise<void> {
    
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid team ID');
    }

    
    await this.findOne(id);
    
    const result = await this.teamRepository.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }
  }
}