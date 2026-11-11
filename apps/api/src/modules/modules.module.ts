import { Module } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { PostureController } from './posture.controller';
import { PostureService } from './posture.service';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';

@Module({
  controllers: [ModulesController, VaultController, ScansController, PostureController],
  providers: [ModulesService, VaultService, ScansService, PostureService],
  exports: [ModulesService, VaultService, ScansService, PostureService],
})
export class ModulesModule {}
