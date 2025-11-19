import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { LocationService } from './location.service';
import {
  CreateLocationDto,
  UpdateLocationDto,
} from './dto/create-location.dto';
import { JwtAuthGuard } from '../middlewares/jwt-auth.guard';
import { RolesGuard } from '../middlewares/roles.guard';
import { Roles } from '../middlewares/roles.decorator';

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  // Create a new location entry
  async create(@Body() dto: CreateLocationDto) {
    try {
      return await this.locationService.create(dto);
    } catch (err) {
      if (err.code === '23505') {
        // Unique constraint violation (Postgres)
        throw new BadRequestException('Location Code must be unique');
      }
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  // Retrieve all location records from the database
  async findAll() {
    try {
      return await this.locationService.findAll();
    } catch (err) {
      throw new InternalServerErrorException('Unable to fetch locations');
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  // Retrieve a single location by its id
  async findOne(@Param('id') id: string) {
    try {
      const location = await this.locationService.findOne(id);
      if (!location) throw new NotFoundException('Location not found');
      return location;
    } catch (err) {
      throw err instanceof NotFoundException
        ? err
        : new InternalServerErrorException();
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  // Update a location entry by id
  async update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    try {
      return await this.locationService.update(id, dto);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to update location');
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  // Delete a location entry by id
  async remove(@Param('id') id: string) {
    try {
      return await this.locationService.remove(id);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to delete location');
    }
  }
}
