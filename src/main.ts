import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { join } from 'path';
import * as express from 'express';
import * as fs from 'fs';

interface UserData {
  serviceNum: string;
  role: string;
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

let io: Server;
const technicianSockets = new Map<string, string>();

export function notifyInactiveByAdmin(serviceNum: string) {
  const socketId = technicianSockets.get(String(serviceNum));

  if (socketId) {
    io.to(socketId).emit('inactive_by_admin', {
      message: 'You are inactive by admin.',
    });
  }
}

export function emitTechnicianStatusChange(
  serviceNum: string,
  active: boolean,
) {
  if (io) {
    io.emit('technician_status_changed', { serviceNum, active });
  }
}

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.use(cookieParser());

  const uploadsDir = join(process.cwd(), 'uploads', 'incident_attachments');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      'Could not create uploads directory (possibly read-only filesystem):',
      message,
    );
  }

  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  const allowedOrigins = [
    'https://sdesk-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://localhost:3000',
    'https://localhost:5173',
    'https://dpdlab1.slt.lk:8448',
  ];

  app.use((req: Request, res: Response, next: NextFunction) => {
    next();
  });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cookie',
      'Cache-Control',
      'Pragma',
    ],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const expressInstance =
    app.getHttpAdapter().getInstance() as unknown as express.Express;
  const httpServer = createServer(expressInstance);
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  await app.init();
  const port = Number(process.env.PORT) || 8000;
  httpServer.listen(port, '0.0.0.0', () => { });

  io.on('connection', (socket) => {
    socket.on('user_connected', (userData: UserData) => {
      const serviceNumStr = String(userData.serviceNum);
      const authSocket = socket as AuthenticatedSocket;
      authSocket.userId = serviceNumStr;
      authSocket.userRole = userData.role;

      technicianSockets.set(serviceNumStr, socket.id);

      void socket.join(`user_${serviceNumStr}`);
    });

    socket.on('disconnect', () => {
      for (const [serviceNum, sockId] of technicianSockets.entries()) {
        if (sockId === socket.id) {
          technicianSockets.delete(serviceNum);
          break;
        }
      }
    });
  });

  io.engine.on('connection_error', () => { });
}

export { io, technicianSockets };

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
