import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateUserRolesDto {
  @ApiProperty({ example: ['SECURITY_ADMIN'] })
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'LOCKED'] })
  @IsEnum(['ACTIVE', 'SUSPENDED', 'LOCKED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ example: ['dashboard:read', 'alerts:read'] })
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}
