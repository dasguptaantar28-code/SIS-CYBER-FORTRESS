import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PostureService } from './posture.service';

class NetworkAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty({ example: 'WIFI' })
  @IsString()
  connectionType!: string;

  @ApiProperty({ example: 'Wi-Fi (Android NetworkCapabilities)' })
  @IsString()
  transportLabel!: string;

  @ApiProperty()
  @IsBoolean()
  isVpnActive!: boolean;

  @ApiProperty()
  @IsBoolean()
  isMetered!: boolean;

  @ApiProperty({ example: 'WPA2/WPA3' })
  @IsString()
  wifiSecurityType!: string;

  @ApiProperty({ example: 'SSID hidden by OS policy unless location permission is granted.' })
  @IsString()
  @MaxLength(300)
  ssidVisibilityNote!: string;

  @ApiProperty()
  @IsObject()
  checklistState!: Record<string, boolean>;
}

class RansomwareReadinessDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty()
  @IsObject()
  checklistState!: Record<string, boolean>;

  @ApiProperty({ example: 'MONITORING_HEALTHY' })
  @IsString()
  canaryStatus!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  markDrillCompleted?: boolean;
}

@ApiTags('Network Sentinel & Ransomware Guardian (Modules 04 & 06)')
@ApiBearerAuth()
@Controller('posture')
export class PostureController {
  constructor(private readonly postureService: PostureService) {}

  @Post('network')
  @RequirePermissions(PERMISSIONS.MODULES_READ)
  @ApiOperation({ summary: 'Record Network Sentinel security assessment & checklist (Module 04)' })
  submitNetwork(@CurrentUser() user: AuthenticatedUser, @Body() dto: NetworkAssessmentDto) {
    return this.postureService.submitNetworkAssessment(user, dto);
  }

  @Get('network')
  @RequirePermissions(PERMISSIONS.MODULES_READ)
  @ApiOperation({ summary: 'List Network Sentinel assessments and warnings' })
  listNetwork(@CurrentUser() user: AuthenticatedUser) {
    return this.postureService.listNetworkAssessments(user);
  }

  @Post('ransomware')
  @RequirePermissions(PERMISSIONS.MODULES_READ)
  @ApiOperation({ summary: 'Update Ransomware Guardian recovery readiness checklist & drill status (Module 06)' })
  updateRansomware(@CurrentUser() user: AuthenticatedUser, @Body() dto: RansomwareReadinessDto) {
    return this.postureService.updateRansomwareReadiness(user, dto);
  }

  @Get('ransomware')
  @RequirePermissions(PERMISSIONS.MODULES_READ)
  @ApiOperation({ summary: 'Get Ransomware Guardian recovery readiness tied to real verified backups' })
  getRansomware(@CurrentUser() user: AuthenticatedUser) {
    return this.postureService.getRansomwareSummary(user);
  }
}
