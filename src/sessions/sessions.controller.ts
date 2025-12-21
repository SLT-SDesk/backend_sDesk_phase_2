import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../middlewares/jwt-auth.guard';
import { RolesGuard } from '../middlewares/roles.guard';
import { Roles } from 'src/middlewares/roles.decorator';
import { Session } from './entities/session.entity';

@Controller()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  //get all sessions
  @Get('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getAllSessions(): Promise<Session[]> {
    try {
      return await this.sessionsService.getAllSessions();
    } catch (error) {
      throw 'Failed to get sessions: ' + (error as Error).message;
    }
  }

  //Get all sessions for a specific technician by service number with technician details
  @Get('sessions/:serviceNumber')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async getSessionsByTechnician(@Param('serviceNumber') serviceNumber: string): Promise<Session[]> {
    try {
      return await this.sessionsService.getSessionsByTechnician(serviceNumber);          
    } catch (error) {
      throw "Failed to get sessions: " + (error as Error).message;      
    }
  }
}
