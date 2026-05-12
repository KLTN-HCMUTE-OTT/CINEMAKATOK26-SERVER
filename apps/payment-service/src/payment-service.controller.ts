import { Controller } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload } from '@nestjs/microservices';
import { PaymentService } from './services/payment.service';

@Controller()
export class PaymentServiceController {
  constructor(private readonly paymentService: PaymentService) {}

  @MessagePattern({ cmd: 'payment.init' })
  initPayment(@Payload() payload: any) {
    return this.paymentService.initPayment(payload);
  }

  @MessagePattern({ cmd: 'payment.callback' })
  handleCallback(@Payload() payload: any) {
    return this.paymentService.handleCallback(payload);
  }

  @MessagePattern({ cmd: 'payment.history' })
  getHistory(@Payload() payload: { userId: string; page?: number; limit?: number }) {
    return this.paymentService.getHistory(payload.userId, payload.page, payload.limit);
  }

  @EventPattern('payment.dlq')
  handleDeadLetter(@Payload() payload: any) {
    return this.paymentService.handleDeadLetter(payload);
  }
}
