import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CreateIndicatorDto } from './dto/threats.dto';
import { ThreatsService } from './threats.service';

@ApiTags('Threat Intelligence (Module 10)')
@ApiBearerAuth()
@Controller('threats')
export class ThreatsController {
  constructor(private readonly threatsService: ThreatsService) {}

  @Get('sources')
  @RequirePermissions(PERMISSIONS.THREATS_READ)
  @ApiOperation({ summary: 'List threat intelligence feeds, freshness, and external integration status' })
  sources(@CurrentUser() user: AuthenticatedUser) {
    return this.threatsService.listSources(user.organizationId);
  }

  @Get('indicators')
  @RequirePermissions(PERMISSIONS.THREATS_READ)
  @ApiOperation({ summary: 'Search IOC indicators (domain, URL, IP, hash)' })
  indicators(
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
  ) {
    return this.threatsService.listIndicators(user.organizationId, { type, severity, search, tag });
  }

  @Post('indicators')
  @RequirePermissions(PERMISSIONS.THREATS_MANAGE)
  @ApiOperation({ summary: 'Add or update a threat IOC indicator with source attribution' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateIndicatorDto) {
    return this.threatsService.createIndicator(user, dto);
  }

  @Delete('indicators/:id')
  @RequirePermissions(PERMISSIONS.THREATS_MANAGE)
  @ApiOperation({ summary: 'Archive an IOC indicator' })
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.threatsService.deactivateIndicator(user, id);
  }
}
