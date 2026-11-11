import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AlertsService } from './alerts.service';
import { CreateAlertDto, UpdateAlertStatusDto } from './dto/alerts.dto';

@ApiTags('Security Alerts (Cyber SOC)')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ALERTS_MANAGE)
  @ApiOperation({ summary: 'Create a correlated security alert from a module or analyst' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAlertDto) {
    return this.alertsService.createAlert(user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ALERTS_READ)
  @ApiOperation({ summary: 'List security alerts correlated across modules' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('moduleCode') moduleCode?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.alertsService.listAlerts(user, { moduleCode, severity, status, search });
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.ALERTS_MANAGE)
  @ApiOperation({ summary: 'Update security alert lifecycle status' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAlertStatusDto,
  ) {
    return this.alertsService.updateStatus(user, id, dto);
  }

  @Post(':id/escalate')
  @RequirePermissions(PERMISSIONS.INCIDENTS_MANAGE)
  @ApiOperation({ summary: 'Escalate a security alert into a formal Cyber SOC Incident' })
  escalate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.alertsService.escalateToIncident(user, id);
  }
}
