import { Test, TestingModule } from '@nestjs/testing';
import { LocationController } from '../location.controller';
import { LocationService } from '../location.service';
import { CreateLocationDto, UpdateLocationDto } from '../dto/create-location.dto';
import { Region } from '../enums/region.enum';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';

describe('LocationController', () => {
  let controller: LocationController;
  let service: LocationService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationController],
      providers: [
        {
          provide: LocationService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<LocationController>(LocationController);
    service = module.get<LocationService>(LocationService);
  });

  afterEach(() => jest.clearAllMocks());
//1
  it('should create a location successfully', async () => {
    const dto: CreateLocationDto = {
      locationCode: 'LOC002',
      locationName: 'Branch B',
      region: Region.R2,
      province: 'Eastern',
    };
    const result = {
      id: '1',
      locationCode: dto.locationCode,
      locationName: dto.locationName,
      region: dto.region,
      province: dto.province,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockService.create.mockResolvedValue(result);

    // Expect controller.create() to return the saved location
    expect(await controller.create(dto)).toEqual(result);
    expect(mockService.create).toBeCalledWith(dto);
  });
//2
  it('should throw BadRequestException if code is not unique', async () => {
    const dto: CreateLocationDto = {
      locationCode: 'LOC002',
      locationName: 'Branch B',
      region: Region.R2,
      province: 'Eastern',
    };

    // Simulate Postgres unique constraint error
    mockService.create.mockRejectedValue({ code: '23505' });

    await expect(controller.create(dto)).rejects.toBeInstanceOf(BadRequestException);
  });
//3
  it('should throw InternalServerErrorException on generic create error', async () => {
    const dto: CreateLocationDto = {
      locationCode: 'LOC003',
      locationName: 'Branch C',
      region: Region.R2,
      province: 'Eastern',
    };

    mockService.create.mockRejectedValue(new Error('Some error'));

    await expect(controller.create(dto)).rejects.toBeInstanceOf(InternalServerErrorException);
  });

//4
  it('should return all locations', async () => {
    const result = [
      {
        id: '1',
        locationCode: 'LOC001',
        locationName: 'Branch A',
        region: Region.R1,
        province: 'Western',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockService.findAll.mockResolvedValue(result);

    expect(await controller.findAll()).toEqual(result);
    expect(mockService.findAll).toBeCalled();
  });

  //5
  it('should throw InternalServerErrorException when findAll fails', async () => {
    mockService.findAll.mockRejectedValue(new Error('DB error'));
    await expect(controller.findAll()).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  //6
  it('should return one location by id', async () => {
    const result = {
      id: '2',
      locationCode: 'LOC002',
      locationName: 'Branch B',
      region: Region.R2,
      province: 'Eastern',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockService.findOne.mockResolvedValue(result);

    expect(await controller.findOne('2')).toEqual(result);
    expect(mockService.findOne).toBeCalledWith('2');
  });

  //7
  it('should throw NotFoundException if location does not exist', async () => {
    mockService.findOne.mockRejectedValue(new NotFoundException());
    await expect(controller.findOne('99')).rejects.toBeInstanceOf(NotFoundException);
  });

  //8
  it('should throw InternalServerErrorException on generic findOne error', async () => {
    mockService.findOne.mockRejectedValue(new Error('DB error'));
    await expect(controller.findOne('99')).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  //9
  it('should update a location successfully', async () => {
    const updateDto: UpdateLocationDto = {
      locationName: 'Updated Branch',
    };
    const result = {
      id: '3',
      locationCode: 'LOC003',
      locationName: 'Updated Branch',
      region: Region.R2,
      province: 'Eastern',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockService.update.mockResolvedValue(result);

    expect(await controller.update('3', updateDto)).toEqual(result);
    expect(mockService.update).toBeCalledWith('3', updateDto);
  });

  //10
  it('should throw NotFoundException if location to update not found', async () => {
    const updateDto: UpdateLocationDto = { locationName: 'Does Not Exist' };
    mockService.update.mockRejectedValue(new NotFoundException());
    await expect(controller.update('99', updateDto)).rejects.toBeInstanceOf(NotFoundException);
  });

  //11
  it('should throw InternalServerErrorException on generic update error', async () => {
    const updateDto: UpdateLocationDto = { locationName: 'Error Branch' };
    mockService.update.mockRejectedValue(new Error('DB error'));
    await expect(controller.update('4', updateDto)).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  //12
  it('should delete a location successfully', async () => {
    const result = {
      id: '5',
      locationCode: 'LOC005',
      locationName: 'To Be Deleted',
      region: Region.R2,
      province: 'Eastern',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockService.remove.mockResolvedValue(result);

    expect(await controller.remove('5')).toEqual(result);
    expect(mockService.remove).toBeCalledWith('5');
  });

  //13
  it('should throw NotFoundException if location to delete not found', async () => {
    mockService.remove.mockRejectedValue(new NotFoundException());
    await expect(controller.remove('99')).rejects.toBeInstanceOf(NotFoundException);
  });

  //14
  it('should throw InternalServerErrorException on generic delete error', async () => {
    mockService.remove.mockRejectedValue(new Error('DB error'));
    await expect(controller.remove('6')).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
