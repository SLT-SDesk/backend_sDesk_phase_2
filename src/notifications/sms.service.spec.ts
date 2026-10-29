import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SmsService', () => {
  let service: SmsService;
  let configService: ConfigService;

  const mockConfig = {
    SMSC_URL: 'https://smsc.slt.lk:8093/api/sms',
    SMSC_USERNAME: 'test_user',
    SMSC_PASSWORD: 'test_password',
    SMSC_SOURCE_ADDRESS: 'SLT_ALERT',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    configService = module.get<ConfigService>(ConfigService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('normalizeMobileNumber', () => {
    it('should normalize number with leading + (e.g. +94770000000 -> 94770000000)', () => {
      expect(service.normalizeMobileNumber('+94700000000')).toBe('94700000000');
      expect(service.normalizeMobileNumber('+94770000000')).toBe('94770000000');
    });

    it('should normalize local number starting with 0 (e.g. 0770000000 -> 94770000000)', () => {
      expect(service.normalizeMobileNumber('0700000000')).toBe('94700000000');
      expect(service.normalizeMobileNumber('0770000000')).toBe('94770000000');
    });

    it('should normalize international prefix 0094', () => {
      expect(service.normalizeMobileNumber('0094700000000')).toBe('94700000000');
    });

    it('should leave already normalized number unchanged', () => {
      expect(service.normalizeMobileNumber('94700000000')).toBe('94700000000');
    });

    it('should clean spaces and hyphens', () => {
      expect(service.normalizeMobileNumber('+94 70-000 0000')).toBe('94700000000');
    });

    it('should return null for invalid mobile numbers', () => {
      expect(service.normalizeMobileNumber('abc123')).toBeNull();
      expect(service.normalizeMobileNumber('123')).toBeNull();
      expect(service.normalizeMobileNumber('')).toBeNull();
    });
  });

  describe('sendSms', () => {
    it('should successfully submit SMS to SMSC', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: '172450000012345',
      });

      const result = await service.sendSms(
        '+94700000000',
        'Ref/No - IN2026.08.24.0001 incident is created',
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('172450000012345');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://smsc.slt.lk:8093/api/sms',
        expect.stringContaining('dst=94700000000'),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
    });

    it('should fail gracefully when SMSC returns an error message string', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: 'Unauthorized User',
      });

      const result = await service.sendSms(
        '0700000000',
        'Ref/No - IN2026.08.24.0001 incident is created',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized User');
    });

    it('should handle network failure or timeout', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network Timeout'));

      const result = await service.sendSms(
        '94700000000',
        'Ref/No - IN2026.08.24.0001 incident is closed',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network Timeout');
    });

    it('should return failure if SMSC credentials are not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      const result = await service.sendSms(
        '94700000000',
        'Ref/No - IN2026.08.24.0001 incident is created',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('SMSC credentials/source address not fully configured');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should return failure for invalid mobile number format', async () => {
      const result = await service.sendSms(
        'invalid-phone',
        'Ref/No - IN2026.08.24.0001 incident is created',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid destination mobile number');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });
});
