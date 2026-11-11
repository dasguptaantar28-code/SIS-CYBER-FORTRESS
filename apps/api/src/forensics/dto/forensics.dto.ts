import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateForensicCaseDto {
  @ApiProperty({ example: 'Suspicious Android APK Sideload Investigation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsIn(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  incidentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadInvestigatorId?: string;
}

export class AddEvidenceDto {
  @ApiProperty({ example: 'Auth Server Access Log Snapshot' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  label!: string;

  @ApiProperty({ example: 'LOG_ARCHIVE' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  evidenceType!: string;

  @ApiProperty({ example: 'auth-audit-2026-11-11.json' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

  @ApiPropertyOptional({ description: 'Optional raw text/base64 content to hash server-side; original hash is preserved.' })
  @IsOptional()
  @IsString()
  contentForHashing?: string;

  @ApiPropertyOptional({ description: 'Pre-computed SHA-256 hex digest if file remains offline in lab storage' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sha256Hash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  byteSize?: number;

  @ApiProperty({ example: 'Vault Locker A / Evidence Drive #02' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  storageLocation!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CustodyEventDto {
  @ApiProperty({ enum: ['TRANSFERRED', 'ANALYZED', 'VERIFIED', 'SEALED'] })
  @IsIn(['TRANSFERRED', 'ANALYZED', 'VERIFIED', 'SEALED'])
  action!: 'TRANSFERRED' | 'ANALYZED' | 'VERIFIED' | 'SEALED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fromCustodian?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  toCustodian?: string;

  @ApiProperty({ example: 'Hash integrity verification prior to forensic timeline correlation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  purpose!: string;

  @ApiPropertyOptional({ description: 'Observed SHA-256 hash during verification' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  observedSha256?: string;
}

export class UpdateCaseStatusDto {
  @ApiProperty({ enum: ['OPEN', 'ACTIVE', 'UNDER_REVIEW', 'CLOSED', 'ARCHIVED'] })
  @IsIn(['OPEN', 'ACTIVE', 'UNDER_REVIEW', 'CLOSED', 'ARCHIVED'])
  status!: 'OPEN' | 'ACTIVE' | 'UNDER_REVIEW' | 'CLOSED' | 'ARCHIVED';
}
