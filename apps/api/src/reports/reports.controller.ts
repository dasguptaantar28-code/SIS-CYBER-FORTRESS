import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { Response } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ReportCategory, ReportsService } from './reports.service';

@ApiTags('Reports & Analytics')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':category')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @ApiOperation({ summary: 'Generate structured report data for a security category' })
  getReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('category') category: ReportCategory,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.generateReportData(user, category, from, to);
  }

  @Get(':category/export/csv')
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @ApiOperation({ summary: 'Export report as formula-safe CSV' })
  async exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('category') category: ReportCategory,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { filename, content } = await this.reportsService.exportCsv(user, category, from, to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get(':category/export/pdf')
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @ApiOperation({ summary: 'Export report as downloadable PDF document' })
  async exportPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('category') category: ReportCategory,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { filename, buffer } = await this.reportsService.exportPdf(user, category, from, to);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
