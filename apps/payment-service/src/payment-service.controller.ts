import { Controller } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { PaymentService } from './services/payment.service';
import { PaymentCallbackService } from './services/payment-callback.service';

/**
 * PaymentServiceController — message & event entry points for the payment microservice.
 *
 * TCP MessagePatterns (RPC calls from api-gateway):
 *  - payment.init    → create payment record, generate VNPAY URL
 *  - payment.callback → handle VNPAY IPN / return-URL callback
 *  - payment.history  → paginated payment history for a user
 *
 * RabbitMQ EventPatterns:
 *  - payment.dlq     → dead-letter queue handler
 */
@Controller()
export class PaymentServiceController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentCallbackService: PaymentCallbackService,
  ) {}

  // ─── TCP — RPC ─────────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'payment.init' })
  initPayment(@Payload() payload: any) {
    return this.paymentService.initPayment(payload);
  }

  /**
   * Handle VNPAY callback (IPN or return-URL redirect).
   * Called by the API Gateway after forwarding the VNPAY query string.
   */
  @MessagePattern({ cmd: 'payment.callback' })
  handleCallback(@Payload() payload: any) {
    return this.paymentCallbackService.handleIpnCallback(
      payload as Record<string, string>,
    );
  }

  @MessagePattern({ cmd: 'payment.history' })
  getHistory(
    @Payload() payload: { userId: string; page?: number; limit?: number },
  ) {
    return this.paymentService.getHistory(
      payload.userId,
      payload.page,
      payload.limit,
    );
  }

  // ─── RabbitMQ — Events ─────────────────────────────────────────────────────

  @EventPattern('payment.dlq')
  handleDeadLetter(@Payload() payload: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const msg = context.getMessage();

    // Always ACK DLQ messages — we persist them for manual review
    const result = this.paymentService.handleDeadLetter(payload);
    channel.ack(msg);
    return result;
  }
}
