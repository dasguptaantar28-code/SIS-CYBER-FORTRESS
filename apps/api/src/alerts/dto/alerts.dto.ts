import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAlertDto {
  @ApiProperty({ example: 'CYBER_SOC' })
  @IsString()
  moduleCode!: string;

  @ApiProperty({ example: 'Repeated Brute Force Attempt Detected' })
  @IsString()
  @MaxLength(180)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(1500)
  description!: string;

  @ApiProperty({ enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsIn(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty({ example: 'AUTHENTICATION' })
  @IsString()
  @MaxLength(80)
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  geoCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  geoCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class UpdateAlertStatusDto {
  @ApiProperty({ enum: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'] })
  @IsIn(['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'])
  status!: 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';
}
