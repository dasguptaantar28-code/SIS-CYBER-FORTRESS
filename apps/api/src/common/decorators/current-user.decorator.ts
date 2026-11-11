import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
