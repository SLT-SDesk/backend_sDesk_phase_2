import { HttpException } from '@nestjs/common';
import { TechnicianController } from '../technician.controller';
import { TechnicianService } from '../technician.service';
import { AuthService } from '../../auth/auth.service';
import { Response, Request } from 'express';
import { Technician } from '../entities/technician.entity';
import { Session } from '../../sessions/entities/session.entity';

describe('TechnicianController', () => {
  let controller: TechnicianController;
  let mockTechnicianService: Partial<TechnicianService>;
  let mockAuthService: Partial<AuthService>;

  const mockTechnician: Technician = {
    id: '1',
    serviceNum: 'SN001',
    name: 'John Doe',
    team: 'Team A',
    position: 'technician',
    cat1: 'C1',
    cat2: 'C2',
    cat3: 'C3',
    cat4: 'C4',
    active: true,
    tier: '1',
    teamId: 'T1',
    email: 'john@example.com',
    contactNumber: '1234567890',
    sessions: [],
    user: Technician.prototype.user,
  };

  const mockSession: Session = {
    id: 1,
    technician_service_number: 'SN001',
    login_time: new Date('2024-01-01T10:00:00'),
    logout_time: new Date('2024-01-01T18:00:00'),
    technician: Session.prototype.technician,
  };

  const makeRes = () => {
    const res: Partial<Response> = {
      json: jest.fn(),
      clearCookie: jest.fn(),
    };
    return res as Response;
  };

  const makeReq = (cookies: Record<string, any> = {}) => {
    const req: Partial<Request> = {
      cookies,
    };
    return req as Request;
  };

  beforeEach(() => {
    mockTechnicianService = {
      createTechnician: jest.fn(),
      findAllTechncians: jest.fn(),
      checkTechnicianStatus: jest.fn(),
      findOneTechnician: jest.fn(),
      updateTechnician: jest.fn(),
      deleteTechnician: jest.fn(),
      updateTechnicianActive: jest.fn(),
      getTechnicianWithSessions: jest.fn(),
      getAllTechnicianNameWithSessionsByMainCategory: jest.fn(),
    };

    mockAuthService = {
      getUserFromAccessToken: jest.fn(),
    };

    controller = new TechnicianController(
      mockTechnicianService as TechnicianService,
      mockAuthService as AuthService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTechnicianWithSessions', () => {
    it('should return technician with sessions', async () => {
      const techWithSessions = { ...mockTechnician, sessions: [mockSession] };
      (mockTechnicianService.getTechnicianWithSessions as jest.Mock).mockResolvedValue(
        techWithSessions,
      );

      const result = await controller.getTechnicianWithSessions('SN001');

      expect(result).toEqual(techWithSessions);
      expect(mockTechnicianService.getTechnicianWithSessions).toHaveBeenCalledWith('SN001');
    });

    it('should throw HttpException when service fails', async () => {
      const error = new Error('Database error');
      (mockTechnicianService.getTechnicianWithSessions as jest.Mock).mockRejectedValue(error);

      await expect(controller.getTechnicianWithSessions('SN001')).rejects.toThrow(
        HttpException,
      );
    });

    it('should handle not found error with proper status', async () => {
      const error = { message: 'Not found', status: 404 };
      (mockTechnicianService.getTechnicianWithSessions as jest.Mock).mockRejectedValue(error);

      try {
        await controller.getTechnicianWithSessions('SN999');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(404);
      }
    });
  });

  describe('getAllTechnicianNameWithSessionsByMainCategory', () => {
    it('should return technicians with sessions by team', async () => {
      const result = [
        {
          serviceNum: 'SN001',
          name: 'John Doe',
          sessions: [mockSession],
        },
      ];
      (mockTechnicianService.getAllTechnicianNameWithSessionsByMainCategory as jest.Mock).mockResolvedValue(
        result,
      );

      const output = await controller.getAllTechnicianNameWithSessionsByMainCategory('T1');

      expect(output).toEqual(result);
      expect(
        mockTechnicianService.getAllTechnicianNameWithSessionsByMainCategory,
      ).toHaveBeenCalledWith('T1');
    });

    it('should return empty array when no technicians in team', async () => {
      (mockTechnicianService.getAllTechnicianNameWithSessionsByMainCategory as jest.Mock).mockResolvedValue(
        [],
      );

      const result = await controller.getAllTechnicianNameWithSessionsByMainCategory('T999');

      expect(result).toEqual([]);
    });

    it('should throw HttpException when service fails', async () => {
      const error = new Error('Query failed');
      (mockTechnicianService.getAllTechnicianNameWithSessionsByMainCategory as jest.Mock).mockRejectedValue(
        error,
      );

      await expect(
        controller.getAllTechnicianNameWithSessionsByMainCategory('T1'),
      ).rejects.toThrow(HttpException);
    });

    it('should handle error with custom status code', async () => {
      const error = { message: 'Forbidden', status: 403 };
      (mockTechnicianService.getAllTechnicianNameWithSessionsByMainCategory as jest.Mock).mockRejectedValue(
        error,
      );

      try {
        await controller.getAllTechnicianNameWithSessionsByMainCategory('T1');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(403);
      }
    });
  });

  describe('add', () => {
    it('should create technician with active=true when accessToken belongs to a technician', async () => {
      const dto: any = { serviceNum: 'T1', name: 'Tech' };
      const res = makeRes();
      const req = makeReq({ jwt: 'token' });

      (mockAuthService.getUserFromAccessToken as jest.Mock).mockReturnValue({
        role: 'technician',
      });

      const created = { id: '1', ...dto, active: true };
      (mockTechnicianService.createTechnician as jest.Mock).mockResolvedValue(created);

      await controller.add(dto, res, req);

      expect(mockAuthService.getUserFromAccessToken).toHaveBeenCalledWith('token');
      expect(mockTechnicianService.createTechnician).toHaveBeenCalledWith(
        expect.objectContaining({ ...dto, active: true }),
      );
      expect((res.json as jest.Mock).mock.calls.length).toBe(1);
      expect(res.json).toHaveBeenCalledWith(created);
      expect(res.clearCookie).not.toHaveBeenCalled();
    });

    it('should clear cookies when no accessToken present', async () => {
      const dto: any = { serviceNum: 'T2', name: 'Tech2' };
      const res = makeRes();
      const req = makeReq({});

      const created = { id: '2', ...dto, active: false };
      (mockTechnicianService.createTechnician as jest.Mock).mockResolvedValue(created);

      await controller.add(dto, res, req);

      expect(mockTechnicianService.createTechnician).toHaveBeenCalledWith(
        expect.objectContaining({ ...dto, active: false }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith('accessToken');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it('should clear cookies when accessToken verify throws', async () => {
      const dto: any = { serviceNum: 'T3' };
      const res = makeRes();
      const req = makeReq({ jwt: 'bad' });

      (mockAuthService.getUserFromAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('bad token');
      });

      const created = { id: '3', ...dto, active: false };
      (mockTechnicianService.createTechnician as jest.Mock).mockResolvedValue(created);

      await controller.add(dto, res, req);

      expect(res.clearCookie).toHaveBeenCalledWith('accessToken');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it('should set active=false when user role is not technician', async () => {
      const dto: any = { serviceNum: 'T4', name: 'Tech4' };
      const res = makeRes();
      const req = makeReq({ jwt: 'token' });

      (mockAuthService.getUserFromAccessToken as jest.Mock).mockReturnValue({
        role: 'admin',
      });

      const created = { id: '4', ...dto, active: false };
      (mockTechnicianService.createTechnician as jest.Mock).mockResolvedValue(created);

      await controller.add(dto, res, req);

      expect(mockTechnicianService.createTechnician).toHaveBeenCalledWith(
        expect.objectContaining({ ...dto, active: false }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith('accessToken');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('findAllTechnicians', () => {
    it('should return technicians on success', async () => {
      const list = [mockTechnician];
      (mockTechnicianService.findAllTechncians as jest.Mock).mockResolvedValue(list);

      const out = await controller.findAllTechnicians();
      expect(out).toBe(list);
    });

    it('should throw HttpException when service fails', async () => {
      (mockTechnicianService.findAllTechncians as jest.Mock).mockRejectedValue(
        new Error('oops'),
      );

      await expect(controller.findAllTechnicians()).rejects.toThrow(HttpException);
    });
  });

  describe('checkStatus', () => {
    it('should return status when service succeeds', async () => {
      const status = [{ serviceNum: 'T1', active: 'true' }];
      (mockTechnicianService.checkTechnicianStatus as jest.Mock).mockResolvedValue(status);
      const out = await controller.checkStatus();
      expect(out).toBe(status);
    });

    it('should throw HttpException when service fails', async () => {
      (mockTechnicianService.checkTechnicianStatus as jest.Mock).mockRejectedValue(
        new Error('fail'),
      );
      await expect(controller.checkStatus()).rejects.toThrow(HttpException);
    });
  });

  describe('findOneTechnician', () => {
    it('should return a technician when found', async () => {
      (mockTechnicianService.findOneTechnician as jest.Mock).mockResolvedValue(
        mockTechnician,
      );

      const out = await controller.findOneTechnician('S1');
      expect(out).toBe(mockTechnician);
    });

    it('should throw HttpException when service fails', async () => {
      (mockTechnicianService.findOneTechnician as jest.Mock).mockRejectedValue(
        new Error('nope'),
      );
      await expect(controller.findOneTechnician('S2')).rejects.toThrow(HttpException);
    });
  });

  describe('updateTechnician', () => {
    it('should update and return technician on success', async () => {
      const dto: any = { name: 'Updated' };
      const updated = { ...mockTechnician, name: 'Updated' };
      (mockTechnicianService.updateTechnician as jest.Mock).mockResolvedValue(updated);

      const out = await controller.updateTechnician('S1', dto);
      expect(out).toBe(updated);
    });

    it('should throw HttpException when update fails', async () => {
      (mockTechnicianService.updateTechnician as jest.Mock).mockRejectedValue(
        new Error('err'),
      );
      await expect(
        controller.updateTechnician('S1', { name: 'x' } as any),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteTechnician', () => {
    it('should return success message on delete', async () => {
      (mockTechnicianService.deleteTechnician as jest.Mock).mockResolvedValue(undefined);
      const out = await controller.deleteTechnician('S1');
      expect(out).toEqual({ message: 'Technician deleted successfully.' });
      expect(mockTechnicianService.deleteTechnician).toHaveBeenCalledWith('S1');
    });

    it('should throw HttpException when delete fails', async () => {
      (mockTechnicianService.deleteTechnician as jest.Mock).mockRejectedValue(
        new Error('boom'),
      );
      await expect(controller.deleteTechnician('S1')).rejects.toThrow(HttpException);
    });
  });

  describe('deactivateTechnician', () => {
    it('should deactivate and return message on success', async () => {
      (mockTechnicianService.updateTechnicianActive as jest.Mock).mockResolvedValue(
        undefined,
      );
      const out = await controller.deactivateTechnician('S1');
      expect(out).toEqual({ message: 'Technician deactivated' });
      expect(mockTechnicianService.updateTechnicianActive).toHaveBeenCalledWith(
        'S1',
        false,
      );
    });

    it('should throw HttpException when deactivation fails', async () => {
      (mockTechnicianService.updateTechnicianActive as jest.Mock).mockRejectedValue(
        new Error('err'),
      );
      await expect(controller.deactivateTechnician('S1')).rejects.toThrow(HttpException);
    });
  });

  describe('forceLogoutTechnician', () => {
    it('should force logout and return message on success', async () => {
      (mockTechnicianService.updateTechnicianActive as jest.Mock).mockResolvedValue(
        undefined,
      );

      const req = makeReq();
      const out = await controller.forceLogoutTechnician('S1', req);
      expect(out).toEqual({
        message: 'Technician force logout initiated',
        serviceNum: 'S1',
      });
      expect(mockTechnicianService.updateTechnicianActive).toHaveBeenCalledWith(
        'S1',
        false,
      );
    });

    it('should throw HttpException when force logout fails', async () => {
      (mockTechnicianService.updateTechnicianActive as jest.Mock).mockRejectedValue(
        new Error('err'),
      );
      await expect(
        controller.forceLogoutTechnician('S1', makeReq()),
      ).rejects.toThrow(HttpException);
    });
  });
});