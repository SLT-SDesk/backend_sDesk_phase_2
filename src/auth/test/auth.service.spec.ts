// auth.service.spec.ts
import { UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { sign, decode, verify } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '../auth.service';
import { SLTUsersService } from '../../sltusers/sltusers.service';
import { ConfigService } from '@nestjs/config';
import { SLTUser } from '../../sltusers/entities/sltuser.entity';

jest.mock('axios');
jest.mock('jsonwebtoken');
jest.mock('uuid');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedSign = sign as unknown as jest.Mock;
const mockedDecode = decode as unknown as jest.Mock;
const mockedVerify = verify as unknown as jest.Mock;
const mockedUuid = uuidv4 as unknown as jest.Mock;

describe('AuthService', () => {
  let service: AuthService;
  let mockConfig: Partial<ConfigService>;
  let mockSltUsersService: Partial<SLTUsersService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      get: jest.fn().mockImplementation((key: string, def?: any) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'AZURE_TENANT_ID') return 'tenant-id';
        if (key === 'AZURE_CLIENT_ID') return 'client-id';
        if (key === 'AZURE_CLIENT_SECRET') return 'client-secret';
        return def;
      }),
    };

    mockSltUsersService = {
      findByAzureId: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      findByEmail: jest.fn(),
    };

    service = new AuthService(
      mockConfig as ConfigService,
      mockSltUsersService as SLTUsersService,
    );
  });

  // --- generateTokens in auth---
  describe('generateTokens', () => {
    it('should generate access and refresh tokens and store refresh token', () => {
      mockedSign.mockReturnValue('signed-token');
      mockedUuid.mockReturnValue('uuid-refresh-token');

      const user: SLTUser = {
        id: '1',
        azureId: 'az1',
        display_name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        serviceNum: 'test',
        contactNumber: '123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { accessToken, refreshToken } = service.generateTokens(user);

      expect(accessToken).toBe('signed-token');
      expect(refreshToken).toBe('uuid-refresh-token');

      // cleanup
      service.revokeRefreshToken(refreshToken);
    });
  });

  // --- handleMicrosoftLogin ---
  describe('handleMicrosoftLogin', () => {
    it('should throw UnauthorizedException if state invalid', async () => {
      await expect(
        service.handleMicrosoftLogin('code', 'bad-state', 'uri'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if no id_token returned', async () => {
      mockedAxios.post.mockResolvedValue({ data: { access_token: 'acc' } });

      await expect(
        service.handleMicrosoftLogin('code', '12345', 'uri'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should fetch graph data, create new user and return tokens when user not found', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { id_token: 'idtoken', access_token: 'acc' },
      });

      mockedAxios.get.mockResolvedValue({
        data: { mobilePhone: '+111111', businessPhones: [] },
      });

      mockedDecode.mockReturnValue({
        oid: 'azure-1',
        preferred_username: 'alice@example.com',
        name: 'Alice',
      });

      (mockSltUsersService.findByAzureId as jest.Mock).mockResolvedValue(null);

      const createdUser: SLTUser = {
        id: 'u1',
        azureId: 'azure-1',
        display_name: 'Alice',
        email: 'alice@example.com',
        role: 'user',
        serviceNum: 'alice',
        contactNumber: '+111111',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mockSltUsersService.createUser as jest.Mock).mockResolvedValue(
        createdUser,
      );

      mockedSign.mockReturnValue('signed-token');
      mockedUuid.mockReturnValue('refresh-uuid');

      const result = await service.handleMicrosoftLogin(
        'code',
        '12345',
        'uri',
      );

      expect(result).toHaveProperty('accessToken', 'signed-token');
      expect(result).toHaveProperty('refreshToken', 'refresh-uuid');
      expect(result.user.email).toBe('alice@example.com');

      service.revokeRefreshToken(result.refreshToken);
    });

    it('should update existing user when user found and differences exist', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { id_token: 'idtoken', access_token: 'acc' },
      });
      mockedAxios.get.mockResolvedValue({
        data: { businessPhones: ['+222222'] },
      });
      mockedDecode.mockReturnValue({
        oid: 'azure-2',
        preferred_username: 'bob@example.com',
        name: 'Bob New',
      });

      const existingUser: SLTUser = {
        id: 'u2',
        azureId: 'azure-2',
        display_name: 'Bob Old',
        email: 'bob@example.com',
        role: 'user',
        serviceNum: 'bob',
        contactNumber: '+111111',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mockSltUsersService.findByAzureId as jest.Mock).mockResolvedValue(
        existingUser,
      );

      const updatedUser: SLTUser = {
        ...existingUser,
        display_name: 'Bob New',
        contactNumber: '+222222',
        updatedAt: new Date(),
      };
      (mockSltUsersService.updateUser as jest.Mock).mockResolvedValue(
        updatedUser,
      );

      mockedSign.mockReturnValue('signed-token');
      mockedUuid.mockReturnValue('refresh-uuid-2');

      const result = await service.handleMicrosoftLogin(
        'code',
        '12345',
        'uri',
      );

      expect(mockSltUsersService.updateUser).toHaveBeenCalledWith('azure-2', {
        display_name: 'Bob New',
        contactNumber: '+222222',
      });
      expect(result.user.name).toBe('Bob New');

      service.revokeRefreshToken(result.refreshToken);
    });

    it('should throw UnauthorizedException when graph GET fails', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { id_token: 'idtoken', access_token: 'acc' },
      });
      mockedAxios.get.mockRejectedValue(new Error('graph error'));
      mockedDecode.mockReturnValue({
        oid: 'azure-3',
        preferred_username: 'c@example.com',
        name: 'C',
      });

      await expect(
        service.handleMicrosoftLogin('code', '12345', 'uri'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should convert axios error response to UnauthorizedException', async () => {
      const err: any = new Error('bad request');
      err.response = { data: { error: 'detailed' } };
      mockedAxios.post.mockRejectedValue(err);

      await expect(
        service.handleMicrosoftLogin('code', '12345', 'uri'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // --- refreshJwtToken ---
  describe('refreshJwtToken', () => {
    it('should throw when no refresh token provided', async () => {
      await expect(service.refreshJwtToken('')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when refresh token invalid', async () => {
      await expect(service.refreshJwtToken('non-existing')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when user not found for email', async () => {
      mockedSign.mockReturnValue('signed-for-refresh');
      mockedUuid.mockReturnValue('rtoken-1');
      const user: SLTUser = {
        id: 'x',
        azureId: 'ax',
        display_name: 'X',
        email: 'x@example.com',
        role: 'user',
        serviceNum: 'x',
        contactNumber: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const { refreshToken } = service.generateTokens(user);

      (mockSltUsersService.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(service.refreshJwtToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );

      service.revokeRefreshToken(refreshToken);
    });

    it('should return new access token when refresh token valid', async () => {
      mockedSign.mockReturnValue('signed-new-access');
      mockedUuid.mockReturnValue('rtoken-2');
      const user: SLTUser = {
        id: 'y',
        azureId: 'ay',
        display_name: 'Y',
        email: 'y@example.com',
        role: 'user',
        serviceNum: 'y',
        contactNumber: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const { refreshToken } = service.generateTokens(user);

      (mockSltUsersService.findByEmail as jest.Mock).mockResolvedValue(user);

      const newToken = await service.refreshJwtToken(refreshToken);
      expect(newToken).toBe('signed-new-access');

      service.revokeRefreshToken(refreshToken);
    });
  });

  // --- revokeRefreshToken ---
  describe('revokeRefreshToken', () => {
    it('should remove stored refresh token', async () => {
      mockedSign.mockReturnValue('tok');
      mockedUuid.mockReturnValue('rt-revoke');
      const user: SLTUser = {
        id: 'z',
        azureId: 'az',
        display_name: 'Z',
        email: 'z@example.com',
        role: 'user',
        serviceNum: 'z',
        contactNumber: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const { refreshToken } = service.generateTokens(user);
      service.revokeRefreshToken(refreshToken);

      await expect(service.refreshJwtToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // --- getUserFromAccessToken ---
  describe('getUserFromAccessToken', () => {
    it('should throw when token not provided', () => {
      expect(() => service.getUserFromAccessToken('')).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw Token expired when verify throws TokenExpiredError', () => {
      mockedVerify.mockImplementation(() => {
        const err: any = new Error('expired');
        err.name = 'TokenExpiredError';
        throw err;
      });

      expect(() => service.getUserFromAccessToken('tok')).toThrow(
        UnauthorizedException,
      );
      try {
        service.getUserFromAccessToken('tok');
      } catch (e: any) {
        expect(e.message).toBe('Token expired');
      }
    });

    it('should throw Invalid token when verify throws JsonWebTokenError', () => {
      mockedVerify.mockImplementation(() => {
        const err: any = new Error('invalid');
        err.name = 'JsonWebTokenError';
        throw err;
      });

      expect(() => service.getUserFromAccessToken('tok')).toThrow(
        UnauthorizedException,
      );
      try {
        service.getUserFromAccessToken('tok');
      } catch (e: any) {
        expect(e.message).toBe('Invalid token');
      }
    });

    it('should return payload when verify succeeds', () => {
      const payload = {
        name: 'P',
        email: 'p@example.com',
        role: 'user',
        serviceNum: 'p',
        contactNumber: '',
      };
      mockedVerify.mockReturnValue(payload);
      const out = service.getUserFromAccessToken('valid-token');
      expect(out).toEqual(payload);
    });
  });
});
