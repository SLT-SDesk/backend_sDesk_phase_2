import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LocationService } from '../location.service';
import { Location } from '../entities/location.entity';
import { Repository } from 'typeorm';
import { CreateLocationDto, UpdateLocationDto } from '../dto/create-location.dto';
import { Region } from '../enums/region.enum';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('LocationService', () => {
  let service: LocationService;
  let repo: jest.Mocked<Repository<Location>>;

  const mockRepo = {
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        {
          provide: getRepositoryToken(Location),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
    repo = module.get(getRepositoryToken(Location));
  });

  afterEach(() => jest.clearAllMocks());

 // create
 //1
  it('should create a new location successfully', async () => {
    const dto: CreateLocationDto = {
      locationCode: 'LOC001',
      locationName: 'Main Branch',
      region: Region.METRO,
      province: 'Western',
    };

    repo.findOneBy.mockResolvedValue(null);
    repo.create.mockReturnValue(dto as any);
    repo.save.mockResolvedValue({ ...dto, id: '1' } as any);

    const result = await service.create(dto);
    expect(result).toEqual({ ...dto, id: '1' });
    expect(repo.findOneBy).toHaveBeenCalledWith({ locationCode: 'LOC001' });
  });
// unique
//2
  it('should throw BadRequestException if locationCode is not unique', async () => {
    repo.findOneBy.mockResolvedValue({ id: '1', locationCode: 'LOC001' } as any);

    await expect(
      service.create({
        locationCode: 'LOC001',
        locationName: 'Branch A',
        region: Region.METRO,
        province: 'North',
      }),
    ).rejects.toThrow(BadRequestException);
  });
//unexpected create error
//3
  it('should throw InternalServerErrorException for unexpected create error', async () => {
    repo.findOneBy.mockRejectedValue(new Error('DB error'));
    await expect(
      service.create({
        locationCode: 'LOC002',
        locationName: 'Error Branch',
        region: Region.METRO,
        province: 'Central',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

//4
  it('should return all locations', async () => {
    const locations = [{ id: '1', locationName: 'Test' }] as any;
    repo.find.mockResolvedValue(locations);
    const result = await service.findAll();
    expect(result).toEqual(locations);
  });
//5
  it('should throw InternalServerErrorException if findAll fails', async () => {
    repo.find.mockRejectedValue(new Error('DB error'));
    await expect(service.findAll()).rejects.toThrow(InternalServerErrorException);
  });

 //6
  it('should find one location by ID', async () => {
    const mockLocation = { id: '1', locationName: 'Test' } as any;
    repo.findOneBy.mockResolvedValue(mockLocation);

    const result = await service.findOne('1');
    expect(result).toEqual(mockLocation);
  });
//7
  it('should throw NotFoundException if location not found', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.findOne('99')).rejects.toThrow(NotFoundException);
  });
//8
  it('should throw InternalServerErrorException for other findOne errors', async () => {
    repo.findOneBy.mockRejectedValue(new Error('Unexpected'));
    await expect(service.findOne('99')).rejects.toThrow(InternalServerErrorException);
  });
//9
  it('should update a location successfully', async () => {
    const id = '1';
    const dto: UpdateLocationDto = {
      locationName: 'Updated',
      region: Region.METRO,
      province: 'Western',
    };
    const existing = {
      id: '1',
      locationCode: 'LOC001',
      locationName: 'Old Name',
      region: Region.METRO,
      province: 'Western',
    } as any;

    repo.findOneBy.mockResolvedValueOnce(existing);
    repo.update.mockResolvedValue({} as any);
    repo.findOneBy.mockResolvedValueOnce({ id, ...dto } as any);

    const result = await service.update(id, dto);
    expect(result).not.toBeNull();
    expect(result!.locationName).toBe('Updated');
  });
//10
  it('should throw NotFoundException if location not found during update', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.update('1', { locationName: 'Nope' })).rejects.toThrow(NotFoundException);
  });
//11
  it('should throw InternalServerErrorException on update error', async () => {
    repo.findOneBy.mockRejectedValue(new Error('DB fail'));
    await expect(service.update('1', { locationName: 'Error' })).rejects.toThrow(
      InternalServerErrorException,
    );
  });
//12
  it('should delete a location successfully', async () => {
    const existing = { id: '1', locationName: 'Delete Me' } as any;
    repo.findOneBy.mockResolvedValue(existing);
    repo.remove.mockResolvedValue(existing);

    const result = await service.remove('1');
    expect(result).toEqual(existing);
  });
//13
  it(' should throw NotFoundException if deleting a non-existing location', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.remove('123')).rejects.toThrow(NotFoundException);
  });
//14
  it('should throw InternalServerErrorException if remove fails', async () => {
    repo.findOneBy.mockRejectedValue(new Error('DB fail'));
    await expect(service.remove('1')).rejects.toThrow(InternalServerErrorException);
  });
});
