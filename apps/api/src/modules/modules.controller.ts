import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { IsBoolean } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ModulesService } from './modules.service';

class ToggleModuleDto {
  @ApiProperty()
  @IsBoolean()
  isEnabled!: boolean;
}

@ApiTags('Security Modules (All 12 Modules)')
@ApiBearerAuth()
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MODULES_READ)
  @ApiOperation({ summary: 'List all 12 security modules with live database-computed health and alert counts' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.modulesService.listModules(user.organizationId);
  }

  @Get(':slug')
  @RequirePermissions(PERMISSIONS.MODULES_READ)
  @ApiOperation({ summary: 'Get module telemetry, alerts, and audit activity by slug' })
  detail(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    return this.modulesService.getModuleBySlug(user.organizationId, slug);
  }

  @Patch(':slug/toggle')
  @RequirePermissions(PERMISSIONS.MODULES_MANAGE)
  @ApiOperation({ summary: 'Enable or disable a security module' })
  toggle(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('slug') slug: string,
    @Body() dto: ToggleModuleDto,
  ) {
    return this.modulesService.toggleModule(actor, slug, dto.isEnabled);
  }
}
