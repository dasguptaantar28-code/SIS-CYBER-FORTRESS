import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { BackupService } from './backup.service';
import { CreateBackupJobDto } from './dto/backup.dto';

@ApiTags('Cloud Backup Guardian (Module 11)')
@ApiBearerAuth()
@Controller('backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'Create an AES-256-GCM encrypted backup with SHA-256 integrity verification' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBackupJobDto) {
    return this.backupService.createEncryptedBackup(user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.BACKUP_READ)
  @ApiOperation({ summary: 'List encrypted backup jobs and storage summary' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.backupService.listBackups(user);
  }

  @Post(':id/restore')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'Verify SHA-256 archive integrity and execute encrypted restore workflow' })
  restore(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.backupService.verifyAndRestoreBackup(user, id);
  }
}
