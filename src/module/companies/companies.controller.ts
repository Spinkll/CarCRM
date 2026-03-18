import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/guards/roles.guard';
import { CompaniesService } from './companies.service';
import { UpdateCompanySettingsDto } from 'src/dto/update-company-settings.dto';

@Controller('companies/me/settings')
@UseGuards(AuthGuard('jwt'), new RolesGuard(['ADMIN', 'MANAGER']))
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  async getSettings(@Req() req) {
    // Якщо у JWT є companyId, беремо його. Якщо це система для 1 СТО, дефолтимо до 1.
    const companyId = req.user.companyId || 1; 
    return this.companiesService.getMySettings(companyId);
  }

  @Patch()
  async updateSettings(
    @Req() req,
    @Body() dto: UpdateCompanySettingsDto,
  ) {
    const companyId = req.user.companyId || 1;
    return this.companiesService.updateMySettings(companyId, dto);
  }
}