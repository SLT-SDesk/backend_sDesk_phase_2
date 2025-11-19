import { Test, TestingModule } from '@nestjs/testing';
import { SLTUsersService } from '../sltusers.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SLTUser } from '../entities/sltuser.entity';
import { Repository, QueryFailedError } from 'typeorm';
import { ConflictException, InternalServerErrorException } from '@nestjs/common';

describe('SLTUsersService', () => {
  let service: SLTUsersService;
  let repo: Repository<SLTUser>;

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

  const repoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SLTUsersService,
        { provide: getRepositoryToken(SLTUser), useValue: repoMock },
      ],
    }).compile();
    service = module.get<SLTUsersService>(SLTUsersService);
    repo = module.get<Repository<SLTUser>>(getRepositoryToken(SLTUser));
    
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByAzureId', () => {
    it('should find a user by azureId', async () => {
      repoMock.findOne.mockResolvedValue(mockUser);
      
      const result = await service.findByAzureId('azure-1');
      
      expect(result).toEqual(mockUser);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { azureId: 'azure-1' } });
    });

    it('should return null if user not found by azureId', async () => {
      repoMock.findOne.mockResolvedValue(null);
      
      const result = await service.findByAzureId('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      repoMock.create.mockReturnValue(mockUser);
      repoMock.save.mockResolvedValue(mockUser);
      
      const result = await service.createUser(mockUser);
      
      expect(result).toEqual(mockUser);
      expect(repo.create).toHaveBeenCalledWith(mockUser);
      expect(repo.save).toHaveBeenCalledWith(mockUser);
    });

    it('should throw ConflictException when duplicate user exists (code 23505)', async () => {
      repoMock.create.mockReturnValue(mockUser);
      const error = new QueryFailedError('query', [], new Error('duplicate key'));
      (error as any).code = '23505';
      repoMock.save.mockRejectedValue(error);
      
      await expect(service.createUser(mockUser)).rejects.toThrow(ConflictException);
      await expect(service.createUser(mockUser)).rejects.toThrow(
        'User with this Azure ID or serviceNum already exists'
      );
    });

    it('should throw InternalServerErrorException with error message when error has message', async () => {
      repoMock.create.mockReturnValue(mockUser);
      const error = { message: 'Database connection failed' };
      repoMock.save.mockRejectedValue(error);
      
      await expect(service.createUser(mockUser)).rejects.toThrow(InternalServerErrorException);
      await expect(service.createUser(mockUser)).rejects.toThrow('Database connection failed');
    });

    it('should throw InternalServerErrorException with generic message for unknown errors', async () => {
      repoMock.create.mockReturnValue(mockUser);
      repoMock.save.mockRejectedValue('Unknown error');
      
      await expect(service.createUser(mockUser)).rejects.toThrow(InternalServerErrorException);
      await expect(service.createUser(mockUser)).rejects.toThrow('Failed to create user');
    });
  });

  describe('findAll', () => {
    it('should find all users', async () => {
      repoMock.find.mockResolvedValue([mockUser]);
      
      const result = await service.findAll();
      
      expect(result).toEqual([mockUser]);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('should update a user by azureId', async () => {
      const updatedUser = { ...mockUser, display_name: 'Updated User' };
      repoMock.findOne.mockResolvedValue(mockUser);
      repoMock.save.mockResolvedValue(updatedUser);
      
      const result = await service.updateUser('azure-1', { display_name: 'Updated User' });
      
      expect(result).toEqual(updatedUser);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { azureId: 'azure-1' } });
      expect(repo.save).toHaveBeenCalled();
    });

    it('should return null if user not found by azureId', async () => {
      repoMock.findOne.mockResolvedValue(null);
      
      const result = await service.updateUser('non-existent', { display_name: 'Updated' });
      
      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException when save fails', async () => {
      repoMock.findOne.mockResolvedValue(mockUser);
      repoMock.save.mockRejectedValue(new Error('Save failed'));
      
      await expect(service.updateUser('azure-1', { display_name: 'Updated' }))
        .rejects.toThrow(InternalServerErrorException);
      await expect(service.updateUser('azure-1', { display_name: 'Updated' }))
        .rejects.toThrow('Failed to update user');
    });
  });

  describe('deleteUser', () => {
    it('should delete a user by azureId successfully', async () => {
      repoMock.delete.mockResolvedValue({ affected: 1 });
      
      const result = await service.deleteUser('azure-1');
      
      expect(result).toEqual({ deleted: true });
      expect(repo.delete).toHaveBeenCalledWith({ azureId: 'azure-1' });
    });

    it('should return deleted false if user not found', async () => {
      repoMock.delete.mockResolvedValue({ affected: 0 });
      
      const result = await service.deleteUser('non-existent');
      
      expect(result).toEqual({ deleted: false });
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email (case-insensitive)', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      repoMock.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      
      const result = await service.findByEmail('test@example.com');
      
      expect(result).toEqual(mockUser);
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'LOWER(user.email) = LOWER(:email)',
        { email: 'test@example.com' }
      );
    });

    it('should return null if user not found by email', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      repoMock.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      
      const result = await service.findByEmail('nonexistent@example.com');
      
      expect(result).toBeNull();
    });
  });

  describe('updateUserRoleById', () => {
    it('should update user role by id successfully', async () => {
      const updatedUser = { ...mockUser, role: 'admin' as SLTUser['role'] };
      repoMock.findOne.mockResolvedValue(mockUser);
      repoMock.save.mockResolvedValue(updatedUser);
      
      const result = await service.updateUserRoleById('1', 'admin');
      
      expect(result).toEqual(updatedUser);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(repo.save).toHaveBeenCalled();
    });

    it('should return null if user not found by id', async () => {
      repoMock.findOne.mockResolvedValue(null);
      
      const result = await service.updateUserRoleById('non-existent', 'admin');
      
      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException when save fails', async () => {
      repoMock.findOne.mockResolvedValue(mockUser);
      repoMock.save.mockRejectedValue(new Error('Save failed'));
      
      await expect(service.updateUserRoleById('1', 'admin'))
        .rejects.toThrow(InternalServerErrorException);
      await expect(service.updateUserRoleById('1', 'admin'))
        .rejects.toThrow('Failed to update user role');
    });
  });

  describe('findByServiceNum', () => {
    it('should find a user by serviceNum', async () => {
      repoMock.findOne.mockResolvedValue(mockUser);
      
      const result = await service.findByServiceNum('srv-1');
      
      expect(result).toEqual(mockUser);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { serviceNum: 'srv-1' } });
    });

    it('should return null if user not found by serviceNum', async () => {
      repoMock.findOne.mockResolvedValue(null);
      
      const result = await service.findByServiceNum('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('updateUserByServiceNum', () => {
    it('should update a user by serviceNum successfully', async () => {
      const updatedUser = { ...mockUser, display_name: 'Updated User' };
      repoMock.findOne.mockResolvedValue(mockUser);
      repoMock.save.mockResolvedValue(updatedUser);
      
      const result = await service.updateUserByServiceNum('srv-1', { display_name: 'Updated User' });
      
      expect(result).toEqual(updatedUser);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { serviceNum: 'srv-1' } });
      expect(repo.save).toHaveBeenCalled();
    });

    it('should return null if user not found by serviceNum', async () => {
      repoMock.findOne.mockResolvedValue(null);
      
      const result = await service.updateUserByServiceNum('non-existent', { display_name: 'Updated' });
      
      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException with error message when error has message', async () => {
      repoMock.findOne.mockResolvedValue(mockUser);
      const error = { message: 'Database error' };
      repoMock.save.mockRejectedValue(error);
      
      await expect(service.updateUserByServiceNum('srv-1', { display_name: 'Updated' }))
        .rejects.toThrow(InternalServerErrorException);
      await expect(service.updateUserByServiceNum('srv-1', { display_name: 'Updated' }))
        .rejects.toThrow('Database error');
    });

    it('should throw InternalServerErrorException with generic message for unknown errors', async () => {
      repoMock.findOne.mockResolvedValue(mockUser);
      repoMock.save.mockRejectedValue('Unknown error');
      
      await expect(service.updateUserByServiceNum('srv-1', { display_name: 'Updated' }))
        .rejects.toThrow(InternalServerErrorException);
      await expect(service.updateUserByServiceNum('srv-1', { display_name: 'Updated' }))
        .rejects.toThrow('Failed to update user');
    });
  });

  describe('deleteUserByServiceNum', () => {
    it('should delete a user by serviceNum successfully', async () => {
      repoMock.delete.mockResolvedValue({ affected: 1 });
      
      const result = await service.deleteUserByServiceNum('srv-1');
      
      expect(result).toEqual({ deleted: true });
      expect(repo.delete).toHaveBeenCalledWith({ serviceNum: 'srv-1' });
    });

    it('should return deleted false if user not found', async () => {
      repoMock.delete.mockResolvedValue({ affected: 0 });
      
      const result = await service.deleteUserByServiceNum('non-existent');
      
      expect(result).toEqual({ deleted: false });
    });

    it('should throw InternalServerErrorException with error message when error has message', async () => {
      const error = { message: 'Database error' };
      repoMock.delete.mockRejectedValue(error);
      
      await expect(service.deleteUserByServiceNum('srv-1'))
        .rejects.toThrow(InternalServerErrorException);
      await expect(service.deleteUserByServiceNum('srv-1'))
        .rejects.toThrow('Database error');
    });

    it('should throw InternalServerErrorException with generic message for unknown errors', async () => {
      repoMock.delete.mockRejectedValue('Unknown error');
      
      await expect(service.deleteUserByServiceNum('srv-1'))
        .rejects.toThrow(InternalServerErrorException);
      await expect(service.deleteUserByServiceNum('srv-1'))
        .rejects.toThrow('Failed to delete user');
    });
  });
});