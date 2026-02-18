import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole, UserRoleEnum } from './entities/user-role.entity';

@Injectable()
export class UserRoleService {
  constructor(
    @InjectRepository(UserRole)
    private readonly repo: Repository<UserRole>,
  ) {}

  async getRoleByServiceNum(serviceNum: string): Promise<UserRoleEnum> {
    const record = await this.repo.findOne({ where: { serviceNum } });

    console.log(
      'ROLE CHECK:',
      serviceNum,
      record?.role ?? UserRoleEnum.USER,
    );

    return record?.role ?? UserRoleEnum.USER;
  }

  async assignRole(
    serviceNum: string,
    role: UserRoleEnum,
  ): Promise<UserRole> {
    let record = await this.repo.findOne({ where: { serviceNum } });

    if (!record) {
      record = this.repo.create({
        serviceNum,
        role,
      });
    } else {
      record.role = role;
    }

    return this.repo.save(record);
  }
}
