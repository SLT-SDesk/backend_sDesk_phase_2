import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './entities/location.entity';
import {
  CreateLocationDto,
  UpdateLocationDto,
} from './dto/create-location.dto';

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
  ) {}

  // Create a new location entry
  async create(dto: CreateLocationDto) {
    try {
      const exists = await this.locationRepository.findOneBy({
        locationCode: dto.locationCode,
      });
      if (exists) {
        throw new BadRequestException('Location Code must be unique');
      }
      const location = this.locationRepository.create(dto);
      return await this.locationRepository.save(location);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to create location');
    }
  }

  // Retrieve all location records from the database
  async findAll() {
    try {
      return await this.locationRepository.find();
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve locations');
    }
  }

  // Retrieve a single location by its id
  async findOne(id: string) {
    try {
      const location = await this.locationRepository.findOneBy({ id });
      if (!location) {
        throw new NotFoundException('Location not found');
      }
      return location;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve location');
    }
  }

  // Update an existing location by id
  async update(id: string, dto: UpdateLocationDto) {
    try {
      const existing = await this.locationRepository.findOneBy({ id });
      if (!existing) throw new NotFoundException('Location not found');
      await this.locationRepository.update({ id }, dto);
      return this.locationRepository.findOneBy({ id });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update location');
    }
  }

  // Delete a location by id
  async remove(id: string) {
    try {
      const location = await this.locationRepository.findOneBy({ id });
      if (!location) throw new NotFoundException('Location not found');
      return await this.locationRepository.remove(location);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to delete location');
    }
  }
}
