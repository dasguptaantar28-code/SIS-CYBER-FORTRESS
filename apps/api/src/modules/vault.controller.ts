import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { VaultService } from './vault.service';

class CreateVaultRecordDto {
  @ApiProperty({ enum: ['PASSWORD', 'SECURE_NOTE', 'DOCUMENT'] })
  @IsIn(['PASSWORD', 'SECURE_NOTE', 'DOCUMENT'])
  recordType!: 'PASSWORD' | 'SECURE_NOTE' | 'DOCUMENT';

  @ApiProperty({ description: 'Client-side AES-256-GCM encrypted title JSON/base64 payload' })
  @IsString()
  @IsNotEmpty()
  encryptedTitle!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ciphertext!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  iv!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  authTag!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  salt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kdfAlgorithm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(100000)
  kdfIterations?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  keyVersion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientType?: string;
}

class SaveRecoveryKitDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  recoveryCode!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  encryptedMasterWrap!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  iv!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  authTag!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  salt!: string;
}

class RecoverVaultDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recoveryCode!: string;
}

@ApiTags('Vault Guardian (Module 05 - Zero Knowledge)')
@ApiBearerAuth()
@Controller('vault')
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Get('records')
  @RequirePermissions(PERMISSIONS.VAULT_OWN)
  @ApiOperation({ summary: 'List encrypted vault records owned exclusively by current user' })
  list(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.vaultService.listOwnRecords(user, req.ip);
  }

  @Post('records')
  @RequirePermissions(PERMISSIONS.VAULT_OWN)
  @ApiOperation({ summary: 'Store client-side AES-256-GCM encrypted vault record (never plaintext)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVaultRecordDto,
    @Req() req: Request,
  ) {
    return this.vaultService.createRecord(user, dto, req.ip);
  }

  @Delete('records/:id')
  @RequirePermissions(PERMISSIONS.VAULT_OWN)
  @ApiOperation({ summary: 'Delete own encrypted vault record' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.vaultService.deleteOwnRecord(user, id, req.ip);
  }

  @Get('activities')
  @RequirePermissions(PERMISSIONS.VAULT_OWN)
  @ApiOperation({ summary: 'Get personal vault unlock and sync history' })
  activities(@CurrentUser() user: AuthenticatedUser) {
    return this.vaultService.getActivities(user.id);
  }

  @Post('recovery-kit')
  @RequirePermissions(PERMISSIONS.VAULT_OWN)
  @ApiOperation({ summary: 'Store encrypted vault recovery wrap protected by Argon2id-hashed recovery code' })
  saveRecovery(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveRecoveryKitDto) {
    return this.vaultService.saveRecoveryKit(user, dto);
  }

  @Post('recovery-kit/unlock')
  @RequirePermissions(PERMISSIONS.VAULT_OWN)
  @ApiOperation({ summary: 'Verify recovery code and retrieve encrypted master key wrap' })
  recover(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecoverVaultDto) {
    return this.vaultService.recoverMasterWrap(user.id, dto.recoveryCode);
  }
}
