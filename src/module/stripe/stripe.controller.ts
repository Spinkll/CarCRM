import { Controller, Post, Param, ParseIntPipe, Body } from '@nestjs/common';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) { }

  @Post('generate/:orderId')
  async generatePayment(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.stripeService.createCheckoutSession(orderId);
  }

  @Post('verify/:sessionId')
  async verifyPayment(@Param('sessionId') sessionId: string) {
    return this.stripeService.verifySession(sessionId);
  }

  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    return this.stripeService.handleWebhook(body);
  }
}