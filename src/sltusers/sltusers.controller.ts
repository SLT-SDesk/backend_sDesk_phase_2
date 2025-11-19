import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SLTUsersService } from './sltusers.service';
import { SLTUser } from './entities/sltuser.entity';
import { JwtAuthGuard } from '../middlewares/jwt-auth.guard';
import { RolesGuard } from '../middlewares/roles.guard';
import { Roles } from '../middlewares/roles.decorator';

@Controller('sltusers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SLTUsersController {
  constructor(private readonly sltUsersService: SLTUsersService) {}

  @Get()
  @Roles('admin', 'superAdmin', 'technician', 'user')
  async getAllUsers(): Promise<SLTUser[]> {
    try {
      return await this.sltUsersService.findAll();
    } catch {
      throw new HttpException(
        'Failed to fetch users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('serviceNum/:serviceNum')
  @Roles('admin', 'superAdmin', 'technician', 'user')
  async getUserByServiceNum(
    @Param('serviceNum') serviceNum: string,
  ): Promise<SLTUser | null> {
    try {
      const user = await this.sltUsersService.findByServiceNum(serviceNum);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return user;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Failed to fetch user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @Roles('admin', 'superAdmin')
  async createUser(@Body() userData: Partial<SLTUser>): Promise<SLTUser> {
    try {
      return await this.sltUsersService.createUser(userData);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as { message?: string }).message === 'string'
          ? (error as { message: string }).message
          : 'Failed to create user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':serviceNum')
  @Roles('admin', 'superAdmin')
  async updateUser(
    @Param('serviceNum') serviceNum: string,
    @Body() userData: Partial<SLTUser>,
  ): Promise<SLTUser | null> {
    try {
      const user = await this.sltUsersService.updateUserByServiceNum(
        serviceNum,
        userData,
      );
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return user;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Failed to update user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':serviceNum')
  @Roles('admin', 'superAdmin')
  async deleteUser(
    @Param('serviceNum') serviceNum: string,
  ): Promise<{ deleted: boolean }> {
    try {
      const result =
        await this.sltUsersService.deleteUserByServiceNum(serviceNum);
      if (!result.deleted) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Failed to delete user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
