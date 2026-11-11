import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'Galaxy S24 Enterprise' })
  @IsString()
  @MaxLength(120)
  deviceName!: string;

  @ApiProperty({ example: 'ANDROID' })
  @IsString()
  @MaxLength(40)
  platform!: string;

  @ApiPropertyOptional({ example: 'Samsung' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  manufacturer?: string;

  @ApiPropertyOptional({ example: 'SM-S921B' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @ApiPropertyOptional({ example: 'Android 15 (API 35)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  osVersion?: string;

  @ApiPropertyOptional({ example: '2026-10-05' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  securityPatchLevel?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @ApiProperty({ example: 'android-keystore-device-uuid-001' })
  @IsString()
  @MaxLength(160)
  deviceIdentifier!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRootedOrCompromised?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  screenLockEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  biometricSupported?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  encryptionEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  installedAppCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  highRiskPermissionCount?: number;

  @ApiPropertyOptional({ description: 'Permitted device security posture metadata and OS restriction notes' })
  @IsOptional()
  @IsObject()
  postureDetails?: Record<string, unknown>;
}
