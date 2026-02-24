import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateInventoryDto } from 'src/dto/create-inventory.dto';
import { UpdateInventoryDto } from 'src/dto/update-inventory.dto';
import { RolesGuard } from 'src/guards/roles.guard';
import { ReportMissingDto } from 'src/dto/ReportMissingDto';

@Controller('inventory')
@UseGuards(AuthGuard('jwt')) 
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @UseGuards(new RolesGuard(['ADMIN', 'MANAGER']))
  @Post()
  create(@Body() createInventoryDto: CreateInventoryDto) {
    return this.inventoryService.create(createInventoryDto);
  }

  @UseGuards(new RolesGuard(['ADMIN', 'MANAGER', 'MECHANIC']))
  @Get()
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateInventoryDto: UpdateInventoryDto
  ) {
    return this.inventoryService.update(id, updateInventoryDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.remove(id);
  }

  @Post('report-missing')
  @UseGuards(AuthGuard('jwt'))
  async reportMissing( @Req() req, @Body() dto: ReportMissingDto) {
    return this.inventoryService.reportMissing(req.user.id, dto);
  }
}