import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AccessTokenPayload } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma/prisma.service';

@WebSocketGateway({
  namespace: '/soc',
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((s) => s.trim()),
    credentials: true,
  },
})
export class SocEventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SocEventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractSocketToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      const session = await this.prisma.userSession.findUnique({
        where: { id: payload.sid },
        include: {
          user: { include: { roles: { include: { role: true } } } },
        },
      });

      if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user) {
        client.disconnect(true);
        return;
      }

      const roles = session.user.roles.map((r) => r.role.code);
      await client.join(`user:${session.user.id}`);

      // Only SOC/Admin/Auditor roles receive org-wide SOC alert streams
      if (roles.some((r) => ['SUPER_ADMIN', 'SECURITY_ADMIN', 'MODULE_ADMIN', 'AUDITOR'].includes(r))) {
        await client.join(`org:${session.user.organizationId}:soc`);
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`SOC WebSocket client disconnected: ${client.id}`);
  }

  emitUserNotification(userId: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit('notification:new', payload);
  }

  emitOrgSocEvent(organizationId: string, event: string, payload: unknown): void {
    this.server?.to(`org:${organizationId}:soc`).emit(event, payload);
  }

  private extractSocketToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) return authToken;

    const headerAuth = client.handshake.headers?.authorization;
    if (typeof headerAuth === 'string' && headerAuth.startsWith('Bearer ')) {
      return headerAuth.slice(7).trim();
    }

    const cookieHeader = client.handshake.headers?.cookie;
    if (typeof cookieHeader === 'string') {
      const match = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('sis_access_token='));
      if (match) return decodeURIComponent(match.split('=')[1] ?? '');
    }

    return null;
  }
}
