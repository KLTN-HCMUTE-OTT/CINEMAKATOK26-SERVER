import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';

@Injectable()
export class PaymentService {
  constructor(
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
    @Inject('PAYMENT_SERVICE_MQ') private readonly paymentMqClient: ClientProxy,
  ) {}

  initPayment(userId: string, data: Record<string, any>): Observable<any> {
    return this.paymentClient.send(
      { cmd: 'payment.init' },
      { userId, ...data },
    );
  }

  handleCallback(data: Record<string, any>): Observable<any> {
    // Sync: return result to payment gateway immediately (required for VNPay)
    return this.paymentClient.send({ cmd: 'payment.callback' }, data);
  }

  emitPaymentEvent(event: string, payload: Record<string, any>): void {
    this.paymentMqClient.emit(event, payload);
  }
}
