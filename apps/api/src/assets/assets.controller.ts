import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AssetsService } from './assets.service';
import { CreateAssetDto, VerifyAssetDto } from './dto/assets.dto';

@ApiTags('Authorized Asset Registry (WebShield)')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_MANAGE)
  @ApiOperation({ summary: 'Register an authorized website/domain asset and issue verification token' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAssetDto) {
    return this.assetsService.createAsset(user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @ApiOperation({ summary: 'List registered assets and verification status' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.listAssets(user.organizationId);
  }

  @Post(':id/verify')
  @RequirePermissions(PERMISSIONS.ASSETS_MANAGE)
  @ApiOperation({ summary: 'Verify domain ownership via DNS TXT, well-known HTTP, or Admin scope approval' })
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VerifyAssetDto,
  ) {
    return this.assetsService.verifyAsset(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_MANAGE)
  @ApiOperation({ summary: 'Decommission/soft-delete an asset' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assetsService.deleteAsset(user, id);
  }
}
