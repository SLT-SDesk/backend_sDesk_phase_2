import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { verify } from 'jsonwebtoken';

export interface JwtUserPayload {
  name: string;
  email: string;
  role: string;
  serviceNum: string;
  contactNumber: string;
  iat: number;
  exp: number;
}

interface RequestWithCookies extends Request {
  cookies: {
    jwt?: string;
    [key: string]: any;
  };
  user?: JwtUserPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCookies>();
    const authHeader = request.headers['authorization'];
    let token: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (request.cookies?.jwt) {
      token = request.cookies.jwt;
    }
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    try {
      const payload = verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key',
      );
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
