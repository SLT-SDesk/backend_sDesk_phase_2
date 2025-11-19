import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SLTUser } from './entities/sltuser.entity';

@Injectable()
export class SLTUsersService {
  // Removed index signature with any type; add specific properties or methods if needed
  constructor(
    @InjectRepository(SLTUser)
    private readonly sltUserRepository: Repository<SLTUser>,
  ) {}

  async findByAzureId(azureId: string): Promise<SLTUser | null> {
    return this.sltUserRepository.findOne({ where: { azureId } });
  }

  async createUser(data: Partial<SLTUser>): Promise<SLTUser> {
    const entity = this.sltUserRepository.create(data);
    try {
      return await this.sltUserRepository.save(entity);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        typeof (error as unknown as { code?: string })?.code === 'string' &&
        (error as unknown as { code: string }).code === '23505'
      ) {
        throw new ConflictException(
          'User with this Azure ID or serviceNum already exists',
        );
      }
      if (
        typeof error === 'object' &&
        error &&
        'message' in error &&
        typeof (error as { message?: string }).message === 'string'
      ) {
        throw new InternalServerErrorException(
          (error as { message: string }).message,
        );
      }
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async findAll(): Promise<SLTUser[]> {
    return this.sltUserRepository.find();
  }

  async updateUser(
    azureId: string,
    userData: Partial<SLTUser>,
  ): Promise<SLTUser | null> {
    const user = await this.sltUserRepository.findOne({ where: { azureId } });
    if (!user) return null;
    Object.assign(user, userData);
    try {
      return await this.sltUserRepository.save(user);
    } catch {
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async deleteUser(azureId: string): Promise<{ deleted: boolean }> {
    const result = await this.sltUserRepository.delete({ azureId });
    return { deleted: result.affected === 1 };
  }

  async findByEmail(email: string): Promise<SLTUser | null> {
    return this.sltUserRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  async updateUserRoleById(id: string, role: string): Promise<SLTUser | null> {
    const user = await this.sltUserRepository.findOne({ where: { id } });
    if (!user) return null;
    user.role = role as SLTUser['role'];
    try {
      return await this.sltUserRepository.save(user);
    } catch {
      throw new InternalServerErrorException('Failed to update user role');
    }
  }

  async findByServiceNum(serviceNum: string): Promise<SLTUser | null> {
    return this.sltUserRepository.findOne({ where: { serviceNum } });
  }

  async updateUserByServiceNum(
    serviceNum: string,
    userData: Partial<SLTUser>,
  ): Promise<SLTUser | null> {
    const user = await this.sltUserRepository.findOne({
      where: { serviceNum },
    });
    if (!user) return null;
    Object.assign(user, userData);
    try {
      return await this.sltUserRepository.save(user);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
      ) {
        throw new InternalServerErrorException(
          (error as { message: string }).message,
        );
      }
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async deleteUserByServiceNum(
    serviceNum: string,
  ): Promise<{ deleted: boolean }> {
    try {
      const result = await this.sltUserRepository.delete({ serviceNum });
      return { deleted: result.affected === 1 };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
      ) {
        throw new InternalServerErrorException(
          (error as { message: string }).message,
        );
      }
      throw new InternalServerErrorException('Failed to delete user');
    }
  }
}
