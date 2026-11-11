import { SetMetadata } from '@nestjs/common';
import { RoleCode } from '@sis/shared-contracts';

export const ROLES_KEY = 'requiredRoles';
export const RequireRoles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);
