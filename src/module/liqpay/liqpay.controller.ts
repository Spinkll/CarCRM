import { Controller, Post, Param, ParseIntPipe, UseGuards, Body } from '@nestjs/common';
import { LiqpayService } from './liqpay.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('liqpay')
export class LiqpayController {
    constructor(private readonly liqpayService: LiqpayService) { }

    @UseGuards(AuthGuard('jwt'))
    @Post('generate/:orderId')
    async generatePayment(@Param('orderId', ParseIntPipe) orderId: number) {
        return this.liqpayService.generatePaymentData(orderId);
    }

    @Post('webhook')
    async handleCallback(@Body() body: any) {
        // Сервер LiqPay надсилає сюди дані
        return this.liqpayService.handleWebhook(body);
    }
}
