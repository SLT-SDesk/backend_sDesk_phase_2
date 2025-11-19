import { Test, TestingModule } from '@nestjs/testing';
import { SLTUsersController } from '../sltusers.controller';
import { SLTUsersService } from '../sltusers.service';
import { SLTUser } from '../entities/sltuser.entity';
import { HttpException } from '@nestjs/common';

describe('SLTUsersController', () => {
  let controller: SLTUsersController;
  let service: SLTUsersService;

  const mockUser: SLTUser = {
    id: '1',
    azureId: 'azure-1',
    serviceNum: 'srv-1',
    display_name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockService = {
    findAll: jest.fn().mockResolvedValue([mockUser]),
    findByServiceNum: jest.fn().mockResolvedValue(mockUser),
    createUser: jest.fn().mockResolvedValue(mockUser),
    updateUserByServiceNum: jest.fn().mockResolvedValue(mockUser),
    deleteUserByServiceNum: jest.fn().mockResolvedValue({ deleted: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SLTUsersController],
      providers: [{ provide: SLTUsersService, useValue: mockService }],
    }).compile();
    controller = module.get<SLTUsersController>(SLTUsersController);
    service = module.get<SLTUsersService>(SLTUsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get all users', async () => {
    expect(await controller.getAllUsers()).toEqual([mockUser]);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should get user by serviceNum', async () => {
    expect(await controller.getUserByServiceNum('srv-1')).toEqual(mockUser);
    expect(service.findByServiceNum).toHaveBeenCalledWith('srv-1');
  });

  it('should create a user', async () => {
    expect(await controller.createUser(mockUser)).toEqual(mockUser);
    expect(service.createUser).toHaveBeenCalledWith(mockUser);
  });

  it('should update a user by serviceNum', async () => {
    expect(
      await controller.updateUser('srv-1', { display_name: 'Updated' }),
    ).toEqual(mockUser);
    expect(service.updateUserByServiceNum).toHaveBeenCalledWith('srv-1', {
      display_name: 'Updated',
    });
  });

  it('should delete a user by serviceNum', async () => {
    expect(await controller.deleteUser('srv-1')).toEqual({ deleted: true });
    expect(service.deleteUserByServiceNum).toHaveBeenCalledWith('srv-1');
  });

  it('should throw 404 if user not found in getUserByServiceNum', async () => {
    jest.spyOn(service, 'findByServiceNum').mockResolvedValueOnce(null);
    await expect(controller.getUserByServiceNum('notfound')).rejects.toThrow(
      HttpException,
    );
  });

  it('should throw 404 if user not found in updateUser', async () => {
    jest.spyOn(service, 'updateUserByServiceNum').mockResolvedValueOnce(null);
    await expect(controller.updateUser('notfound', {})).rejects.toThrow(
      HttpException,
    );
  });

  it('should throw 404 if user not found in deleteUser', async () => {
    jest
      .spyOn(service, 'deleteUserByServiceNum')
      .mockResolvedValueOnce({ deleted: false });
    await expect(controller.deleteUser('notfound')).rejects.toThrow(
      HttpException,
    );
  });
});
