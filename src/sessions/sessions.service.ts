import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Session } from './entities/session.entity';
import { InjectRepository } from '@nestjs/typeorm/dist/common/typeorm.decorators';
import { Repository } from 'typeorm/repository/Repository';
import { IsNull } from 'typeorm';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
  ) {}

  async createSession(serviceNumber: string): Promise<Session> {
    try {
      const session = this.sessionsRepository.create({
        technician_service_number: serviceNumber,
        login_time: new Date(),
        logout_time: null,
      });
      return await this.sessionsRepository.save(session);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to create session record: ' + (error as Error).message,
      );
    }
  }

  async endSession(serviceNumber: string): Promise<Session> {
    try {
      const openSession = await this.sessionsRepository.findOne({
        where: {
          technician_service_number: serviceNumber,
          logout_time: IsNull(),
        },
        order: { login_time: 'DESC' },
      });
      if (!openSession) {
        throw new NotFoundException(
          'No open session found for this technician',
        );
      }
      openSession.logout_time = new Date();
      return await this.sessionsRepository.save(openSession);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to close session record: ' + (error as Error).message,
      );
    }
  }

  

}
