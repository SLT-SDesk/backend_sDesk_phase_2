// technician.controller.spec.ts
import { HttpException } from '@nestjs/common';
import { TechnicianController } from '../technician.controller';
import { TechnicianService } from '../technician.service';
import { AuthService } from '../../auth/auth.service';
import { Response, Request } from 'express';

describe('TechnicianController', () => {
  let controller: TechnicianController;
  let mockTechnicianService: Partial<TechnicianService>;
  let mockAuthService: Partial<AuthService>;

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
    };

    mockAuthService = {
      getUserFromAccessToken: jest.fn(),
    };

    controller = new TechnicianController(
      mockTechnicianService as TechnicianService,
      mockAuthService as AuthService,
    );
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
      (mockTechnicianService.createTechnician as jest.Mock).mockResolvedValue(
        created,
      );

      await controller.add(dto, res, req);

      expect(mockAuthService.getUserFromAccessToken).toHaveBeenCalledWith(
        'token',
      );
      // dto should be mutated with active: true before service call
      expect(mockTechnicianService.createTechnician).toHaveBeenCalledWith(
        expect.objectContaining({ ...dto, active: true }),
      );
      expect((res.json as jest.Mock).mock.calls.length).toBe(1);
      expect(res.json).toHaveBeenCalledWith(created);
      // should not clear cookies
      expect(res.clearCookie).not.toHaveBeenCalled();
    });

    it('should clear cookies when no accessToken present', async () => {
      const dto: any = { serviceNum: 'T2', name: 'Tech2' };
      const res = makeRes();
      const req = makeReq({}); // no jwt cookie

      const created = { id: '2', ...dto, active: false };
      (mockTechnicianService.createTechnician as jest.Mock).mockResolvedValue(
        created,
      );

      await controller.add(dto, res, req);

      expect(mockTechnicianService.createTechnician).toHaveBeenCalledWith(
        expect.objectContaining({ ...dto, active: false }),
      );
      // cookies cleared when shouldClearCookies true
      expect(res.clearCookie).toHaveBeenCalledWith('accessToken');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it('should clear cookies when accessToken verify throws', async () => {
      const dto: any = { serviceNum: 'T3' };
      const res = makeRes();
      const req = makeReq({ jwt: 'bad' });

      (mockAuthService.getUserFromAccessToken as jest.Mock).mockImplementation(
        () => {
          throw new Error('bad token');
        },
      );

      const created = { id: '3', ...dto, active: false };
      (mockTechnicianService.createTechnician as jest.Mock).mockResolvedValue(
        created,
      );

      await controller.add(dto, res, req);

      expect(res.clearCookie).toHaveBeenCalledWith('accessToken');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(res.json).toHaveBeenCalledWith(created);
    });
  });

  describe('findAllTechnicians', () => {
    it('should return technicians on success', async () => {
      const list = [{ id: 'a' }, { id: 'b' }];
      (mockTechnicianService.findAllTechncians as jest.Mock).mockResolvedValue(
        list,
      );

      const out = await controller.findAllTechnicians();
      expect(out).toBe(list);
    });

    it('should throw HttpException when service fails', async () => {
      (mockTechnicianService.findAllTechncians as jest.Mock).mockRejectedValue(
        new Error('oops'),
      );

      await expect(controller.findAllTechnicians()).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('checkStatus', () => {
    it('should return status when service succeeds', async () => {
      const status = { T1: true };
      (mockTechnicianService.checkTechnicianStatus as jest.Mock).mockResolvedValue(
        status,
      );
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
      const tech = { id: 'tx', serviceNum: 'S1' };
      (mockTechnicianService.findOneTechnician as jest.Mock).mockResolvedValue(
        tech,
      );

      const out = await controller.findOneTechnician('S1');
      expect(out).toBe(tech);
    });

    it('should throw HttpException when service fails', async () => {
      (mockTechnicianService.findOneTechnician as jest.Mock).mockRejectedValue(
        new Error('nope'),
      );
      await expect(controller.findOneTechnician('S2')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('updateTechnician', () => {
    it('should update and return technician on success', async () => {
      const dto: any = { name: 'Updated' };
      const updated = { id: 'u1', ...dto };
      (mockTechnicianService.updateTechnician as jest.Mock).mockResolvedValue(
        updated,
      );

      const out = await controller.updateTechnician('S1', dto);
      expect(out).toBe(updated);
    });

    it('should throw HttpException when update fails', async () => {
      (mockTechnicianService.updateTechnician as jest.Mock).mockRejectedValue(
        new Error('err'),
      );
      // Cast the partial object to any so TypeScript won't complain about missing CreateTechnicianDto fields
      await expect(
        controller.updateTechnician('S1', { name: 'x' } as any),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteTechnician', () => {
    it('should return success message on delete', async () => {
      (mockTechnicianService.deleteTechnician as jest.Mock).mockResolvedValue(
        undefined,
      );
      const out = await controller.deleteTechnician('S1');
      expect(out).toEqual({ message: 'Technician deleted successfully.' });
      expect(mockTechnicianService.deleteTechnician).toHaveBeenCalledWith('S1');
    });

    it('should throw HttpException when delete fails', async () => {
      (mockTechnicianService.deleteTechnician as jest.Mock).mockRejectedValue(
        new Error('boom'),
      );
      await expect(controller.deleteTechnician('S1')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('deactivateTechnician', () => {
    it('should deactivate and return message on success', async () => {
      (mockTechnicianService.updateTechnicianActive as jest.Mock).mockResolvedValue(
        undefined,
      );
      const out = await controller.deactivateTechnician('S1');
      expect(out).toEqual({ message: 'Technician deactivated' });
      expect(
        mockTechnicianService.updateTechnicianActive,
      ).toHaveBeenCalledWith('S1', false);
    });

    it('should throw HttpException when deactivation fails', async () => {
      (mockTechnicianService.updateTechnicianActive as jest.Mock).mockRejectedValue(
        new Error('err'),
      );
      await expect(controller.deactivateTechnician('S1')).rejects.toThrow(
        HttpException,
      );
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
      expect(
        mockTechnicianService.updateTechnicianActive,
      ).toHaveBeenCalledWith('S1', false);
    });

    it('should throw HttpException when force logout fails', async () => {
      (mockTechnicianService.updateTechnicianActive as jest.Mock).mockRejectedValue(
        new Error('err'),
      );
      await expect(controller.forceLogoutTechnician('S1', makeReq())).rejects.toThrow(
        HttpException,
      );
    });
  });
});
