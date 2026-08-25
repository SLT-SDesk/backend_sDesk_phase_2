import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { join } from 'path';
import * as express from 'express';
import * as fs from 'fs';

// Define the expected user data structure
interface UserData {
  serviceNum: string;
  role: string;
}

// Global socket instance (we'll improve this architecture later)
let io: Server;
const technicianSockets = new Map<string, string>(); // serviceNum → socketId

// ===== Helper: Notify technician inactive by admin =====
export function notifyInactiveByAdmin(serviceNum: string) {
  const socketId = technicianSockets.get(String(serviceNum));

  if (socketId) {
    io.to(socketId).emit('inactive_by_admin', {
      message: 'You are inactive by admin.',
    });
  } else {
    // no-op if socket not connected
  }
}

// ===== Helper: Broadcast status change =====
export function emitTechnicianStatusChange(
  serviceNum: string,
  active: boolean,
) {
  // If io is not initialized yet (e.g., when imported in tests), guard safely
  if (io) {
    io.emit('technician_status_changed', { serviceNum, active });
  }
}

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Ensure uploads directory exists (handle both local and cloud storage)
  const uploadsDir = join(process.cwd(), 'uploads', 'incident_attachments');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (error: any) {
    console.warn(
      'Could not create uploads directory (possibly read-only filesystem):',
      error?.message ?? error,
    );
  }

  // Serve static files from uploads directory
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  const allowedOrigins = [
    'https://sdesk-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://localhost:3000',
    'https://localhost:5173',
  ];

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      // no-op for now
    }

    next();
  });

  app.enableCors({
    origin: true,
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

  const httpServer = createServer(app.getHttpAdapter().getInstance());
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  await app.init();
  const port = Number(process.env.PORT) || 8000; // Convert to number
  httpServer.listen(port, '0.0.0.0', () => {
    // Application started successfully
    // console.log(`Server listening on port ${port}`);
  });

  // ===== SOCKET EVENTS =====
  io.on('connection', (socket) => {
    // Store user info when they connect
    socket.on('user_connected', (userData: UserData) => {
      const serviceNumStr = String(userData.serviceNum);
      (socket as any).userId = serviceNumStr;
      (socket as any).userRole = userData.role;

      // Save socket mapping
      technicianSockets.set(serviceNumStr, socket.id);

      // Join personal room
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      socket.join(`user_${serviceNumStr}`);
    });

    // ...other handlers...

    socket.on('disconnect', () => {
      // Remove from map
      for (const [serviceNum, sockId] of technicianSockets.entries()) {
        if (sockId === socket.id) {
          technicianSockets.delete(serviceNum);
          break;
        }
      }
    });
  });

  // Add global socket event listener to monitor all emissions
  io.engine.on('connection_error', () => {
    // Handle connection errors silently
  });
}

// Export for other files
export { io, technicianSockets };

// --- IMPORTANT: only start server when main.ts is executed directly ---
// Prevent bootstrap from running when this file is imported by Jest tests
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
