import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({ example: 'Corporate Portal' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: ['WEBSITE', 'API', 'DOMAIN'] })
  @IsOptional()
  @IsIn(['WEBSITE', 'API', 'DOMAIN'])
  assetType?: 'WEBSITE' | 'API' | 'DOMAIN';

  @ApiProperty({ example: 'https://example.com' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  targetUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class VerifyAssetDto {
  @ApiProperty({ enum: ['DNS_TXT', 'WELL_KNOWN_HTTP', 'ADMIN_APPROVAL'] })
  @IsIn(['DNS_TXT', 'WELL_KNOWN_HTTP', 'ADMIN_APPROVAL'])
  method!: 'DNS_TXT' | 'WELL_KNOWN_HTTP' | 'ADMIN_APPROVAL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  approveForScan?: boolean;
}
