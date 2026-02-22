import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CatalogService } from './catalog.service';

@Controller('catalog') 
@UseGuards(AuthGuard('jwt'))
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Get('services')
  async getServices() {
    return this.catalog.getAllServices();
  }

  @Get('parts')
  async getParts() {
    return this.catalog.getAllParts();
  }
}