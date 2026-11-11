import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateIndicatorDto {
  @ApiProperty({ enum: ['DOMAIN', 'URL', 'IP', 'HASH'] })
  @IsIn(['DOMAIN', 'URL', 'IP', 'HASH'])
  indicatorType!: 'DOMAIN' | 'URL' | 'IP' | 'HASH';

  @ApiProperty({ example: 'malicious-test.example.invalid' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  value!: string;

  @ApiProperty({ example: 'PHISHING' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  threatCategory!: string;

  @ApiProperty({ enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsIn(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  confidence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Optional threat source providerKey' })
  @IsOptional()
  @IsString()
  sourceProviderKey?: string;
}
