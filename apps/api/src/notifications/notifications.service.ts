import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SeverityLevel } from '@prisma/client';
import { createSign } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { SocEventsGateway } from './soc-events.gateway';

export interface CreateNotificationInput {
  organizationId: string;
  userId: string;
  title: string;
  message: string;
  severity?: SeverityLevel;
  moduleCode: string;
  deepLink?: string;
  resourceType?: string;
  resourceId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly gateway: SocEventsGateway,
  ) {}

  isFcmConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('FIREBASE_PROJECT_ID') &&
        this.configService.get<string>('FIREBASE_CLIENT_EMAIL') &&
        this.configService.get<string>('FIREBASE_PRIVATE_KEY'),
    );
  }

  async createAndDispatch(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        title: input.title,
        message: input.message,
        severity: input.severity ?? 'INFO',
        moduleCode: input.moduleCode,
        deepLink: input.deepLink,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
    });

    this.gateway.emitUserNotification(input.userId, notification);

    if (this.isFcmConfigured()) {
      const sessionsWithFcm = await this.prisma.userSession.findMany({
        where: {
          userId: input.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          fcmToken: { not: null },
        },
        select: { fcmToken: true },
      });

      const tokens = Array.from(
        new Set(sessionsWithFcm.map((s) => s.fcmToken).filter((t): t is string => Boolean(t))),
      );

      if (tokens.length > 0) {
        const sent = await this.dispatchFcmTokens(tokens, notification.title, notification.message, {
          moduleCode: notification.moduleCode,
          deepLink: notification.deepLink ?? '/notifications',
          notificationId: notification.id,
        });
        if (sent) {
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { pushDispatched: true },
          });
        }
      }
    }

    return notification;
  }

  async notifyOrgAdmins(
    organizationId: string,
    payload: Omit<CreateNotificationInput, 'organizationId' | 'userId'>,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: 'ACTIVE',
        roles: {
          some: {
            role: { code: { in: ['SUPER_ADMIN', 'SECURITY_ADMIN'] } },
          },
        },
      },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        this.createAndDispatch({
          ...payload,
          organizationId,
          userId: admin.id,
        }),
      ),
    );
  }

  async listForUser(userId: string, unreadOnly?: boolean) {
    const items = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return {
      items,
      unreadCount,
      pushProviderStatus: this.isFcmConfigured() ? 'CONFIGURED' : 'UNCONFIGURED',
    };
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!existing) throw new NotFoundException('Notification not found.');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  private async dispatchFcmTokens(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<boolean> {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID')!;
      const accessToken = await this.getGoogleOAuthAccessToken();
      if (!accessToken) return false;

      let anySuccess = false;
      for (const token of tokens) {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                data,
              },
            }),
          },
        );
        if (res.ok) anySuccess = true;
      }
      return anySuccess;
    } catch {
      return false;
    }
  }

  private async getGoogleOAuthAccessToken(): Promise<string | null> {
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const rawKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    if (!clientEmail || !rawKey) return null;

    const privateKey = rawKey.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      }),
    ).toString('base64url');

    const unsigned = `${header}.${claimSet}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    const signature = signer.sign(privateKey, 'base64url');
    const assertion = `${unsigned}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  }
}
