import { Test, TestingModule } from '@nestjs/testing';
import { TechnicianService } from '../technician.service';
import { Technician } from '../entities/technician.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTechnicianDto } from '../dto/create-technician.dto';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

describe('TechnicianService', () => {
  let service: TechnicianService;
  let repo: Repository<Technician>;

  // Create mocks and cast them to the real types to avoid TypeScript shape errors.
  // NOTE: this is a pragmatic test-time cast. Later you should align the mock
  // fields with your entity/DTO definitions for stronger type safety.
  const mockTechnician = {
    id: '1',
    serviceNum: 'SN123',
    name: 'John Doe',
    team: 'Team A',
    cat1: 'C1',
    cat2: 'C2',
    cat3: 'C3',
    cat4: 'C4',
    active: true,
    tier: '1',
    // include whatever other fields you need for tests; casting prevents TS errors
    teamLevel: 'T1',
    designation: 'Technician',
    email: 'john@example.com',
    contactNumber: '1234567890',
    teamLeader: true,
    assignAfterSignOff: false,
    permanentMember: true,
    subrootUser: false,
  } as unknown as Technician;

  const mockCreateDto = {
    serviceNum: 'SN123',
    name: 'John Doe',
    team: 'Team A',
    cat1: 'C1',
    cat2: 'C2',
    cat3: 'C3',
    cat4: 'C4',
    active: true,
    tier: '1',
    teamLevel: 'T1',
    designation: 'Technician',
    email: 'john@example.com',
    contactNumber: '1234567890',
    teamLeader: true,
    assignAfterSignOff: false,
    permanentMember: true,
    subrootUser: false,
  } as unknown as CreateTechnicianDto;

  const mockRepo = {
    create: jest.fn().mockReturnValue(mockTechnician),
    save: jest.fn().mockResolvedValue(mockTechnician),
    find: jest.fn().mockResolvedValue([mockTechnician]),
    findOne: jest.fn().mockResolvedValue(mockTechnician),
    delete: jest.fn().mockResolvedValue({ affected: 1, raw: {} }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TechnicianService,
        {
          provide: getRepositoryToken(Technician),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<TechnicianService>(TechnicianService);
    repo = module.get<Repository<Technician>>(getRepositoryToken(Technician));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a technician', async () => {
      const result = await service.createTechnician(mockCreateDto);
      expect(repo.create).toHaveBeenCalledWith(mockCreateDto);
      expect(result).toEqual(mockTechnician);
    });

    it('should throw ConflictException on duplicate entry', async () => {
      repo.save = jest.fn().mockRejectedValue({ code: '23505' });
      await expect(service.createTechnician(mockCreateDto)).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on unknown error', async () => {
      repo.save = jest.fn().mockRejectedValue({ code: 'OTHER' });
      await expect(service.createTechnician(mockCreateDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findAllTechncians', () => {
    it('should return array of technicians', async () => {
      const result = await service.findAllTechncians();
      expect(result).toEqual([mockTechnician]);
    });

    it('should throw InternalServerErrorException on error', async () => {
      repo.find = jest.fn().mockRejectedValue(new Error());
      await expect(service.findAllTechncians()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findOneTechnician', () => {
    it('should return one technician by serviceNum', async () => {
      const result = await service.findOneTechnician('SN123');
      expect(result).toEqual(mockTechnician);
    });

    it('should throw NotFoundException if not found', async () => {
      repo.findOne = jest.fn().mockResolvedValue(null);
      await expect(service.findOneTechnician('NOT_EXIST')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on error', async () => {
      repo.findOne = jest.fn().mockRejectedValue(new Error());
      await expect(service.findOneTechnician('SN123')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateTechnician', () => {
    it('should update and return the technician', async () => {
      repo.findOne = jest.fn().mockResolvedValue(mockTechnician);
      repo.save = jest.fn().mockResolvedValue({ ...mockTechnician, name: 'Updated' } as Technician);

      const result = await service.updateTechnician('SN123', { ...mockCreateDto, name: 'Updated' } as any);

      expect(result.name).toBe('Updated');
      expect(result).toEqual(expect.objectContaining({ name: 'Updated' }));
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(service, 'findOneTechnician').mockRejectedValue(new NotFoundException());
      await expect(service.updateTechnician('SN404', { ...mockCreateDto, name: 'X' } as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(service, 'findOneTechnician').mockResolvedValue(mockTechnician);
      repo.save = jest.fn().mockRejectedValue(new Error());
      await expect(service.updateTechnician('SN123', { ...mockCreateDto, name: 'X' } as any)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteTechnician', () => {
    it('should delete a technician', async () => {
      const result = await service.deleteTechnician('SN123');
      expect(repo.delete).toHaveBeenCalledWith({ serviceNum: 'SN123' });
      expect(result).toBeUndefined();
    });

    it('should throw NotFoundException if affected = 0', async () => {
      repo.delete = jest.fn().mockResolvedValue({ affected: 0, raw: {} });
      await expect(service.deleteTechnician('SN404')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on error', async () => {
      repo.delete = jest.fn().mockRejectedValue(new Error());
      await expect(service.deleteTechnician('SN123')).rejects.toThrow(InternalServerErrorException);
    });
  });
});
