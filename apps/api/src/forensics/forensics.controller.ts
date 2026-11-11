import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  AddEvidenceDto,
  CreateForensicCaseDto,
  CustodyEventDto,
  UpdateCaseStatusDto,
} from './dto/forensics.dto';
import { ForensicsService } from './forensics.service';

@ApiTags('Digital Forensics (Module 08)')
@ApiBearerAuth()
@Controller('forensics')
export class ForensicsController {
  constructor(private readonly forensicsService: ForensicsService) {}

  @Post('cases')
  @RequirePermissions(PERMISSIONS.FORENSICS_MANAGE)
  @ApiOperation({ summary: 'Create a forensic investigation case' })
  createCase(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateForensicCaseDto) {
    return this.forensicsService.createCase(user, dto);
  }

  @Get('cases')
  @RequirePermissions(PERMISSIONS.FORENSICS_READ)
  @ApiOperation({ summary: 'List forensic investigation cases' })
  listCases(@CurrentUser() user: AuthenticatedUser) {
    return this.forensicsService.listCases(user.organizationId);
  }

  @Get('cases/:id')
  @RequirePermissions(PERMISSIONS.FORENSICS_READ)
  @ApiOperation({ summary: 'Get case details, evidence metadata, and chain-of-custody timeline' })
  getCase(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.forensicsService.getCaseDetail(user.organizationId, id);
  }

  @Patch('cases/:id/status')
  @RequirePermissions(PERMISSIONS.FORENSICS_MANAGE)
  @ApiOperation({ summary: 'Update forensic case workflow status' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCaseStatusDto,
  ) {
    return this.forensicsService.updateCaseStatus(user, id, dto);
  }

  @Post('cases/:id/evidence')
  @RequirePermissions(PERMISSIONS.FORENSICS_MANAGE)
  @ApiOperation({ summary: 'Register evidence metadata with immutable SHA-256 hash and intake custody log' })
  addEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddEvidenceDto,
    @Req() req: Request,
  ) {
    return this.forensicsService.addEvidence(user, id, dto, req.ip);
  }

  @Post('evidence/:id/custody')
  @RequirePermissions(PERMISSIONS.FORENSICS_MANAGE)
  @ApiOperation({ summary: 'Append an immutable chain-of-custody event to evidence' })
  appendCustody(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CustodyEventDto,
    @Req() req: Request,
  ) {
    return this.forensicsService.appendCustodyLog(user, id, dto, req.ip);
  }

  @Get('cases/:id/export')
  @RequirePermissions(PERMISSIONS.FORENSICS_EXPORT)
  @ApiOperation({ summary: 'Controlled export of forensic case dossier (recorded in audit & custody logs)' })
  exportCase(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Req() req: Request) {
    return this.forensicsService.exportCaseDossier(user, id, req.ip);
  }
}
