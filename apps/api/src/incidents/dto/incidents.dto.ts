import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateIncidentDto {
  @ApiProperty({ example: 'Suspicious OAuth Credential Stuffing Campaign' })
  @IsString()
  @MaxLength(180)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsIn(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceModuleCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alertIds?: string[];
}

export class UpdateIncidentStatusDto {
  @ApiProperty({ enum: ['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'] })
  @IsIn(['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'])
  status!: 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'CLOSED';
}

export class AssignIncidentDto {
  @ApiProperty()
  @IsString()
  assigneeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
