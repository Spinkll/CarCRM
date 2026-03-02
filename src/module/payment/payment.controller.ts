import { Controller, Post, Get, Body, Param, ParseIntPipe, UseGuards, Req, Res } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { AuthGuard } from '@nestjs/passport';
import { CreatePaymentDto } from 'src/dto/create-payment.dto';
import type { Response } from 'express';


@Controller('payments')
@UseGuards(AuthGuard('jwt'))
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) { }

  @Post('order/:orderId')
  async payForOrder(
    @Req() req,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: CreatePaymentDto
  ) {
    return this.paymentService.processPayment(req.user.id, orderId, dto);
  }

  @Get('order/:orderId')
  async getPaymentsByOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.paymentService.getOrderPayments(orderId);
  }

  @Get('order/:orderId/receipt')
  async downloadReceipt(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.paymentService.generateReceiptPdf(orderId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-order-${orderId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}