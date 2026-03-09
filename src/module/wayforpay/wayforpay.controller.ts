import { Controller, Post, Param, ParseIntPipe, UseGuards, Body } from '@nestjs/common';
import { WayforpayService } from './wayforpay.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('wayforpay')
export class WayforpayController {
  constructor(private readonly wayforpayService: WayforpayService) { }

  @UseGuards(AuthGuard('jwt'))
  @Post('generate/:orderId')
  async generatePayment(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.wayforpayService.generatePaymentData(orderId);
  }

  @Post('webhook')
  async handleCallback(@Body() body: any) {
    // Сервер WayForPay надсилає сюди JSON з результатами оплати
    return this.wayforpayService.handleWebhook(body);
  }
}