import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { DashboardService } from './dashboard.service';

class UpsertSettingDto {
  @ApiProperty({ example: 'soc.alertRetentionDays' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: { days: 90 } })
  @IsObject()
  value!: Record<string, unknown>;
}

@ApiTags('Central SOC Dashboard, Health & Search')
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Backend & PostgreSQL health endpoint' })
  health() {
    return this.dashboardService.getHealth();
  }

  @Get('dashboard/overview')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.DASHBOARD_READ)
  @ApiOperation({ summary: 'Fetch real database-calculated dashboard metrics, analytics, and activities' })
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getOverview(user);
  }

  @Get('dashboard/search')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.DASHBOARD_READ)
  @ApiOperation({ summary: 'Global search across modules, alerts, devices, assets, and IOCs' })
  search(@CurrentUser() user: AuthenticatedUser, @Query('q') q: string) {
    return this.dashboardService.globalSearch(user, q);
  }

  @Get('settings')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'Get system settings and external integration statuses' })
  settings(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getSettings(user.organizationId);
  }

  @Put('settings')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Update a system configuration key (Super Admin)' })
  upsertSetting(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertSettingDto) {
    return this.dashboardService.upsertSetting(user, dto.key, dto.value);
  }
}
