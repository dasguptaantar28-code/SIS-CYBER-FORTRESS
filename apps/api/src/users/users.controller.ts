import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UpdateRolePermissionsDto, UpdateUserRolesDto, UpdateUserStatusDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('Users, Roles & Access Guardian')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'List organization users' })
  listUsers(@CurrentUser() user: AuthenticatedUser, @Query('search') search?: string) {
    return this.usersService.listUsers(user.organizationId, search);
  }

  @Patch('users/:id/roles')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Assign roles to a user (Super Admin)' })
  updateUserRoles(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
  ) {
    return this.usersService.updateUserRoles(actor, id, dto);
  }

  @Patch('users/:id/status')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Activate, suspend, or lock a user account' })
  updateUserStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateUserStatus(actor, id, dto);
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  @ApiOperation({ summary: 'List RBAC roles with assigned permissions' })
  listRoles() {
    return this.usersService.listRoles();
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  @ApiOperation({ summary: 'List all granular RBAC permissions' })
  listPermissions() {
    return this.usersService.listPermissions();
  }

  @Patch('roles/:id/permissions')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Update permission assignments on a role' })
  updateRolePermissions(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.usersService.updateRolePermissions(actor, id, dto);
  }

  @Get('access-guardian/sessions')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'List organization active and historical user sessions' })
  listOrgSessions(@CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.listOrgSessions(actor.organizationId);
  }

  @Delete('access-guardian/sessions/:id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Admin revoke an active user session' })
  revokeOrgSession(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.revokeOrgSession(actor, id);
  }
}
