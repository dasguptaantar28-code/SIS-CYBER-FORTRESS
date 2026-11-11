import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AssignIncidentDto, CreateIncidentDto, UpdateIncidentStatusDto } from './dto/incidents.dto';
import { IncidentsService } from './incidents.service';

@ApiTags('Incident Management (Cyber SOC)')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.INCIDENTS_MANAGE)
  @ApiOperation({ summary: 'Create a security incident' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateIncidentDto) {
    return this.incidentsService.create(user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.INCIDENTS_READ)
  @ApiOperation({ summary: 'List security incidents with assignments and alert counts' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.incidentsService.list(user.organizationId, { status, severity });
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.INCIDENTS_MANAGE)
  @ApiOperation({ summary: 'Transition incident workflow status' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
  ) {
    return this.incidentsService.updateStatus(user, id, dto);
  }

  @Post(':id/assign')
  @RequirePermissions(PERMISSIONS.INCIDENTS_MANAGE)
  @ApiOperation({ summary: 'Assign an incident responder' })
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignIncidentDto,
  ) {
    return this.incidentsService.assign(user, id, dto);
  }
}
