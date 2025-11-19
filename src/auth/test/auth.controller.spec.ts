// auth.controller.spec.ts
jest.mock('../../main', () => ({
  emitTechnicianStatusChange: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { TeamAdminService } from '../../teamadmin/teamadmin.service';
import { TechnicianService } from '../../technician/technician.service';
import { emitTechnicianStatusChange } from '../../main';
import { verify } from 'jsonwebtoken';
import { Response, Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: Partial<AuthService>;
  let mockTeamAdminService: Partial<TeamAdminService>;
  let mockTechnicianService: Partial<TechnicianService>;

  const makeRes = () => {
    const res: Partial<Response> = {
      cookie: jest.fn(),
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
    // reset mocks
    (emitTechnicianStatusChange as jest.Mock).mockClear();
    (verify as jest.Mock).mockClear();

    mockAuthService = {
      handleMicrosoftLogin: jest.fn(),
      revokeRefreshToken: jest.fn(),
      refreshJwtToken: jest.fn(),
    };

    mockTeamAdminService = {
      findTeamAdminByServiceNumber: jest.fn(),
    };

    mockTechnicianService = {
      updateTechnicianActive: jest.fn(),
      findOneTechnician: jest.fn(),
    };

    controller = new AuthController(
      mockAuthService as AuthService,
      mockTeamAdminService as TeamAdminService,
      mockTechnicianService as TechnicianService,
    );
  });

  describe('microsoftLogin', () => {
    it('should login a technician, update status, emit event, set cookies and return tokens', async () => {
      const res = makeRes();
      const body = {
        code: 'code',
        state: 'state',
        redirect_uri: 'uri',
      };
      const fakeUser = { id: 'u1', role: 'technician', serviceNum: 'T100' };
      (mockAuthService.handleMicrosoftLogin as jest.Mock).mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: fakeUser,
      });

      const result = await controller.microsoftLogin(body as any, res);

      expect(mockAuthService.handleMicrosoftLogin).toHaveBeenCalledWith(
        body.code,
        body.state,
        body.redirect_uri,
      );

      // technician active set and event emitted
      expect(mockTechnicianService.updateTechnicianActive).toHaveBeenCalledWith(
        fakeUser.serviceNum,
        true,
      );
      expect(emitTechnicianStatusChange).toHaveBeenCalledWith(
        fakeUser.serviceNum,
        true,
      );

      // cookies set
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'jwt',
        'access-token',
        expect.any(Object),
      );

      expect(result).toEqual({
        success: true,
        user: fakeUser,
        accessToken: 'access-token',
      });
    });

    it('should login non-technician and set cookies and return tokens', async () => {
      const res = makeRes();
      const body = {
        code: 'code',
        state: 'state',
        redirect_uri: 'uri',
      };
      const fakeUser = { id: 'u1', role: 'user' };
      (mockAuthService.handleMicrosoftLogin as jest.Mock).mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: fakeUser,
      });

      const result = await controller.microsoftLogin(body as any, res);

      // no technician update or emit
      expect(mockTechnicianService.updateTechnicianActive).not.toHaveBeenCalled();
      expect(emitTechnicianStatusChange).not.toHaveBeenCalled();

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        success: true,
        user: fakeUser,
        accessToken: 'access-token',
      });
    });

    it('should return failed response when service throws', async () => {
      const res = makeRes();
      const body = { code: 'bad', state: 's', redirect_uri: 'u' };
      (mockAuthService.handleMicrosoftLogin as jest.Mock).mockRejectedValue(
        new Error('fail'),
      );

      const result = await controller.microsoftLogin(body as any, res);
      expect(result).toEqual({ success: false, message: 'Login failed' });
    });
  });

  describe('logout', () => {
    it('should logout successfully when jwt payload is technician and refresh token revoked', async () => {
      const res = makeRes();
      const req = makeReq({
        refreshToken: 'refresh-token',
        jwt: 'jwt-token',
      });

      // make verify return technician payload
      (verify as jest.Mock).mockReturnValue({
        role: 'technician',
        serviceNum: 'T200',
      });

      const result = await controller.logout(req, res);

      // technician set to inactive and emitted
      expect(mockTechnicianService.updateTechnicianActive).toHaveBeenCalledWith(
        'T200',
        false,
      );
      expect(emitTechnicianStatusChange).toHaveBeenCalledWith('T200', false);

      // revoke refresh token called
      expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith(
        'refresh-token',
      );

      // cookies cleared in response
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('jwt', expect.any(Object));

      expect(result).toEqual({ success: true, message: 'Logged out successfully' });
    });

    it('should return error message when verify throws (token invalid)', async () => {
      const res = makeRes();
      const req = makeReq({ jwt: 'bad' });

      (verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid token');
      });

      const result = await controller.logout(req, res);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Technician status update error/);
    });

    it('should return error if revokeRefreshToken throws', async () => {
      const res = makeRes();
      const req = makeReq({ refreshToken: 'rtok' });

      (mockAuthService.revokeRefreshToken as jest.Mock).mockImplementation(() => {
        throw new Error('revoke failed');
      });

      const result = await controller.logout(req, res);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Refresh token revoke error/);
    });

    it('should return error if clearCookie throws (refreshToken)', async () => {
      const res = makeRes();
      (res.clearCookie as jest.Mock).mockImplementationOnce(() => {
        throw new Error('clear cookie failed');
      });
      const req = makeReq({ refreshToken: 'rt' });

      const result = await controller.logout(req, res);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Clear refreshToken cookie error/);
    });

    it('should return error if clearCookie throws (jwt)', async () => {
      const res = makeRes();
      // first clearCookie (refreshToken) works, second throws
      (res.clearCookie as jest.Mock)
        .mockImplementationOnce(() => undefined)
        .mockImplementationOnce(() => {
          throw new Error('jwt clear failed');
        });

      const req = makeReq({ refreshToken: 'rt' });

      const result = await controller.logout(req, res);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Clear jwt cookie error/);
    });

    it('should return generic failure if outer try/catch catches', async () => {
      // Force an unexpected error in whole logout path by passing an invalid req
      const res = makeRes();

      // @ts-ignore - pass undefined to cause top-level access error and hit outer catch
      const result = await controller.logout(undefined as any, res);
      expect(result).toEqual({ success: false, message: 'Logout failed' });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully and set jwt cookie', async () => {
      const res = makeRes();
      const req = makeReq({ refreshToken: 'rtok' });

      (mockAuthService.refreshJwtToken as jest.Mock).mockResolvedValue(
        'new-access-token',
      );

      const result = await controller.refreshToken(req, res);
      expect(mockAuthService.refreshJwtToken).toHaveBeenCalledWith('rtok');
      expect(res.cookie).toHaveBeenCalledWith(
        'jwt',
        'new-access-token',
        expect.any(Object),
      );
      expect(result).toEqual({ success: true, accessToken: 'new-access-token' });
    });

    it('should return error when no refresh token provided', async () => {
      const res = makeRes();
      const req = makeReq({});

      const result = await controller.refreshToken(req, res);
      expect(res.clearCookie).toHaveBeenCalledWith('jwt', expect.any(Object));
      expect(result).toEqual({ success: false, message: 'No refresh token provided' });
    });

    it('should clear cookies and return failure when refresh fails', async () => {
      const res = makeRes();
      const req = makeReq({ refreshToken: 'rtok' });

      (mockAuthService.refreshJwtToken as jest.Mock).mockRejectedValue(
        new Error('refresh failed'),
      );

      const result = await controller.refreshToken(req, res);
      expect(res.clearCookie).toHaveBeenCalled(); // jwt and refreshToken cleared
      expect(result).toEqual({ success: false, message: 'Token refresh failed' });
    });
  });

  describe('getLoggedUser', () => {
    it('should return admin when payload is admin and admin found', async () => {
      // token provided via Authorization header
      const fakeAdmin = { name: 'Admin One', serviceNum: 'A100' };
      (verify as jest.Mock).mockReturnValue({
        role: 'admin',
        serviceNum: 'A100',
      });
      (mockTeamAdminService.findTeamAdminByServiceNumber as jest.Mock).mockResolvedValue(
        fakeAdmin,
      );

      const result = await controller.getLoggedUser(
        'Bearer sometoken',
        makeReq(),
      );

      expect(mockTeamAdminService.findTeamAdminByServiceNumber).toHaveBeenCalledWith(
        'A100',
      );
      expect(result).toEqual({ success: true, user: { ...fakeAdmin, role: 'admin' } });
    });

    it('should return not found admin message if admin missing', async () => {
      (verify as jest.Mock).mockReturnValue({
        role: 'admin',
        serviceNum: 'A100',
      });
      (mockTeamAdminService.findTeamAdminByServiceNumber as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await controller.getLoggedUser(
        'Bearer sometoken',
        makeReq(),
      );
      expect(result).toEqual({ success: false, message: 'Admin not found for this service number' });
    });

    it('should return technician when payload is technician and found', async () => {
      (verify as jest.Mock).mockReturnValue({
        role: 'technician',
        serviceNum: 'T500',
      });
      const fakeTech = { name: 'Techie', serviceNum: 'T500' };
      (mockTechnicianService.findOneTechnician as jest.Mock).mockResolvedValue(fakeTech);

      const result = await controller.getLoggedUser('', makeReq({ jwt: 't' }));
      expect(result).toEqual({ success: true, user: { ...fakeTech, role: 'technician' } });
    });

    it('should return not found for technician if missing', async () => {
      (verify as jest.Mock).mockReturnValue({
        role: 'technician',
        serviceNum: 'T500',
      });
      (mockTechnicianService.findOneTechnician as jest.Mock).mockResolvedValue(null);

      const result = await controller.getLoggedUser('', makeReq({ jwt: 't' }));
      expect(result).toEqual({ success: false, message: 'Technician not found for this service number' });
    });

    it('should return user from payload when role is user', async () => {
      const payload = { role: 'user', id: 'u1', email: 'a@b' };
      (verify as jest.Mock).mockReturnValue(payload);

      const result = await controller.getLoggedUser('', makeReq({ jwt: 't' }));
      expect(result).toEqual({ success: true, user: { ...payload, role: 'user' } });
    });

    it('should return no token provided when neither header nor cookie', async () => {
      const result = await controller.getLoggedUser('', makeReq({}));
      expect(result).toEqual({ success: false, message: 'No token provided' });
    });

    it('should return Token expired message when verify throws TokenExpiredError', async () => {
      const err: Partial<Error> = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      (verify as jest.Mock).mockImplementation(() => {
        throw err;
      });

      const result = await controller.getLoggedUser('', makeReq({ jwt: 't' }));
      expect(result).toEqual({ success: false, message: 'Token expired' });
    });

    it('should return Invalid token when verify throws JsonWebTokenError', async () => {
      const err: Partial<Error> = new Error('invalid jwt');
      err.name = 'JsonWebTokenError';
      (verify as jest.Mock).mockImplementation(() => {
        throw err;
      });

      const result = await controller.getLoggedUser('', makeReq({ jwt: 't' }));
      expect(result).toEqual({ success: false, message: 'Invalid token' });
    });

    it('should return generic failure when verify throws other error', async () => {
      (verify as jest.Mock).mockImplementation(() => {
        throw new Error('other');
      });

      const result = await controller.getLoggedUser('', makeReq({ jwt: 't' }));
      expect(result).toEqual({ success: false, message: 'Token verification failed' });
    });
  });
});
