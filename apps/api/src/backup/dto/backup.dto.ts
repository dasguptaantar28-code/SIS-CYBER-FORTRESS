import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BackupEntryInputDto {
  @ApiProperty({ example: 'configs/security-policy.json' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(260)
  relativePath!: string;

  @ApiProperty({ description: 'UTF-8 text or base64 payload to encrypt and seal in backup storage' })
  @IsString()
  @MaxLength(500000)
  content!: string;
}

export class CreateBackupJobDto {
  @ApiProperty({ example: 'Daily Endpoint & Config Snapshot' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  backupName!: string;

  @ApiPropertyOptional({ enum: ['MANUAL', 'DAILY', 'WEEKLY'] })
  @IsOptional()
  @IsIn(['MANUAL', 'DAILY', 'WEEKLY'])
  scheduleType?: 'MANUAL' | 'DAILY' | 'WEEKLY';

  @ApiPropertyOptional({ minimum: 7, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(365)
  retentionDays?: number;

  @ApiProperty({ type: [BackupEntryInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BackupEntryInputDto)
  entries!: BackupEntryInputDto[];
}
