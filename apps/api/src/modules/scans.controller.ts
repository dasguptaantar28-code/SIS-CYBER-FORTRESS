import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PERMISSIONS } from '@sis/shared-contracts';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ScansService } from './scans.service';

class PhishingScanDto {
  @ApiProperty({ example: 'http://verify-account-reset.example.invalid/auth' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url!: string;
}

class FalsePositiveDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

class WebShieldScanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  assetId!: string;
}

@ApiTags('Security Scanners (Phishing Shield & WebShield)')
@ApiBearerAuth()
@Controller('scans')
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post('phishing')
  @RequirePermissions(PERMISSIONS.SCANS_RUN)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Analyze URL against IOC indicators, heuristics, and reputation feeds (Module 02)' })
  scanPhishing(@CurrentUser() user: AuthenticatedUser, @Body() dto: PhishingScanDto) {
    return this.scansService.runPhishingScan(user, dto.url);
  }

  @Post('webshield')
  @RequirePermissions(PERMISSIONS.SCANS_RUN)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Run SSRF-protected passive security scan on verified/approved asset (Module 07)' })
  scanWebShield(@CurrentUser() user: AuthenticatedUser, @Body() dto: WebShieldScanDto) {
    return this.scansService.runWebShieldScan(user, dto.assetId);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.MODULES_READ)
  @ApiOperation({ summary: 'List scan history across Phishing Shield and WebShield' })
  list(@CurrentUser() user: AuthenticatedUser, @Query('moduleCode') moduleCode?: string) {
    return this.scansService.listScans(user, moduleCode);
  }

  @Post(':scanResultId/false-positive')
  @RequirePermissions(PERMISSIONS.SCANS_RUN)
  @ApiOperation({ summary: 'Submit false-positive review on a scan result' })
  falsePositive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scanResultId') scanResultId: string,
    @Body() dto: FalsePositiveDto,
  ) {
    return this.scansService.reportFalsePositive(user, scanResultId, dto.reason);
  }
}
