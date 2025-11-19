/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Technician } from './entities/technician.entity';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { notifyInactiveByAdmin, emitTechnicianStatusChange } from '../main';

@Injectable()
export class TechnicianService {
  constructor(
    @InjectRepository(Technician)
    private readonly technicianRepo: Repository<Technician>,
  ) {}

  // Create a technician
  async createTechnician(dto: CreateTechnicianDto): Promise<Technician> {
    try {
      const technician = this.technicianRepo.create(dto);
      return await this.technicianRepo.save(technician);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Technician with the same Service Number or Email already exists.',
        );
      }
      throw new InternalServerErrorException('Failed to create technician.');
    }
  }

  // Get all technicians
  async findAllTechncians(): Promise<Technician[]> {
    try {
      return await this.technicianRepo.find();
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch technicians.');
    }
  }

  // Find technician by service number
  async findOneTechnician(serviceNum: string): Promise<Technician> {
    try {
      const technician = await this.technicianRepo.findOne({
        where: { serviceNum },
      });
      if (!technician) {
        throw new NotFoundException(
          `Technician with Service Number "${serviceNum}" not found.`,
        );
      }
      return technician;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error fetching technician.');
    }
  }

  // Update technician

  async updateTechnician(
    serviceNum: string,
    dto: CreateTechnicianDto,
  ): Promise<Technician> {
    try {
      const technician = await this.findOneTechnician(serviceNum);

      const wasActive = technician.active;
      const willBeActive = dto.active;

      Object.assign(technician, dto);
      const savedTech = await this.technicianRepo.save(technician);

      // WebSocket notifications
      emitTechnicianStatusChange(serviceNum, willBeActive);

      // If changing from active → inactive
      if (wasActive && willBeActive === false) {
        notifyInactiveByAdmin(serviceNum);
      }

      return savedTech;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update technician.');
    }
  }

  // Delete technician by service number
  async deleteTechnician(serviceNum: string): Promise<void> {
    try {
      const result = await this.technicianRepo.delete({ serviceNum });
      if (result.affected === 0) {
        throw new NotFoundException(
          `Technician with Service Number "${serviceNum}" not found.`,
        );
      }
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to delete technician.');
    }
  }

  async updateTechnicianActive(
    serviceNum: string,
    active: boolean,
  ): Promise<void> {
    const result = await this.technicianRepo.update({ serviceNum }, { active });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Technician with Service Number "${serviceNum}" not found.`,
      );
    }
  }

  async findActiveTechnicians(): Promise<Technician[]> {
    return this.technicianRepo.find({ where: { active: true } });
  }

  async checkTechnicianStatus(): Promise<
    { serviceNum: string; active: string }[]
  > {
    try {
      const all = await this.technicianRepo.find();
      return all.map((t) => ({ serviceNum: t.serviceNum, active: 'true' })); // simplified logic
    } catch (error) {
      throw new Error('Failed to retrieve technician status');
    }
  }
}
