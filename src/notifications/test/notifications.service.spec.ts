import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Notification } from '../notification.entity';
import { NotificationsService } from '../notifications.service';
import { SmsService } from '../sms.service';
import { ErpService } from '../../erp/erp.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: Repository<Notification>;
  let smsService: SmsService;
  let erpService: ErpService;

  const mockNotification: Notification = {
    id: 1,
    recipientServiceNumber: 'S1',
    message: 'Test notification',
    incidentNumber: 'IN123',
    actorName: 'John Doe',
    actorServiceNum: 'S2',
    read: false,
    createdOn: new Date('2025-01-01'),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockSmsService = {
    sendSms: jest.fn(),
  };

  const mockErpService = {
    getEmployeeDetailsForServiceNo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository,
        },
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
        {
          provide: ErpService,
          useValue: mockErpService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repository = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    smsService = module.get<SmsService>(SmsService);
    erpService = module.get<ErpService>(ErpService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendIncidentCreatedSms', () => {
    it('should fetch employee and send SMS when employee is found', async () => {
      mockErpService.getEmployeeDetailsForServiceNo.mockResolvedValueOnce({
        employeeNumber: '010330',
        mobileNo: '+94714291238',
      });
      mockSmsService.sendSms.mockResolvedValueOnce({
        success: true,
        messageId: '12345',
      });

      const res = await service.sendIncidentCreatedSms('IN2026.08.24.0001', '010330');

      expect(res).toBe(true);
      expect(mockErpService.getEmployeeDetailsForServiceNo).toHaveBeenCalledWith('010330');
      expect(mockSmsService.sendSms).toHaveBeenCalledWith(
        '+94714291238',
        'Ref/No - IN2026.08.24.0001 incident is created',
      );
    });

    it('should return false if employee mobile number is missing', async () => {
      mockErpService.getEmployeeDetailsForServiceNo.mockResolvedValueOnce({
        employeeNumber: '010330',
        mobileNo: null,
      });

      const res = await service.sendIncidentCreatedSms('IN2026.08.24.0001', '010330');

      expect(res).toBe(false);
      expect(mockSmsService.sendSms).not.toHaveBeenCalled();
    });

    it('should return false if ERP lookup fails or returns null', async () => {
      mockErpService.getEmployeeDetailsForServiceNo.mockResolvedValueOnce(null);

      const res = await service.sendIncidentCreatedSms('IN2026.08.24.0001', '010330');

      expect(res).toBe(false);
      expect(mockSmsService.sendSms).not.toHaveBeenCalled();
    });

    it('should return false if SMS send fails', async () => {
      mockErpService.getEmployeeDetailsForServiceNo.mockResolvedValueOnce({
        employeeNumber: '010330',
        mobileNo: '+94714291238',
      });
      mockSmsService.sendSms.mockResolvedValueOnce({
        success: false,
        error: 'SMSC Timeout',
      });

      const res = await service.sendIncidentCreatedSms('IN2026.08.24.0001', '010330');

      expect(res).toBe(false);
    });
  });

  describe('sendIncidentClosedSms', () => {
    it('should fetch employee and send closure SMS when employee is found', async () => {
      mockErpService.getEmployeeDetailsForServiceNo.mockResolvedValueOnce({
        employeeNumber: '010330',
        mobileNo: '+94714291238',
      });
      mockSmsService.sendSms.mockResolvedValueOnce({
        success: true,
        messageId: '12346',
      });

      const res = await service.sendIncidentClosedSms('IN2026.08.24.0001', '010330');

      expect(res).toBe(true);
      expect(mockErpService.getEmployeeDetailsForServiceNo).toHaveBeenCalledWith('010330');
      expect(mockSmsService.sendSms).toHaveBeenCalledWith(
        '+94714291238',
        'Ref/No - IN2026.08.24.0001 incident is closed',
      );
    });
  });

  describe('createNotification', () => {
    it('should create a notification with all fields', async () => {
      const payload = {
        recipientServiceNumber: 'S1',
        message: 'Test notification',
        incidentNumber: 'IN123',
        actorName: 'John Doe',
        actorServiceNum: 'S2',
      };

      const expectedNotification = {
        ...payload,
        read: false,
      };

      mockRepository.create.mockReturnValue(expectedNotification);
      mockRepository.save.mockResolvedValue({ id: 1, ...expectedNotification });

      const result = await service.createNotification(payload);

      expect(repository.create).toHaveBeenCalledWith({
        recipientServiceNumber: 'S1',
        message: 'Test notification',
        incidentNumber: 'IN123',
        read: false,
        actorName: 'John Doe',
        actorServiceNum: 'S2',
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, ...expectedNotification });
    });
  });
});
