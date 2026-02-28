import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { AuthGuard } from '@nestjs/passport'; 

@Controller('payroll')
@UseGuards(AuthGuard('jwt')) 
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('my-earnings')
  async getMyEarnings(
    @Req() req,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const mechanicId = req.user.id; 
    return this.payrollService.getMechanicEarnings(mechanicId, month, year);
    }
    
    @Get('summary')
  async getPayrollSummary(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.payrollService.getPayrollSummary(month, year);
  }
}