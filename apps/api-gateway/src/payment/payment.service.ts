import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { catchRpcError } from '@app/common/exceptions';

@Injectable()
export class PaymentService {
  constructor(
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
    @Inject('PAYMENT_SERVICE_MQ') private readonly paymentMqClient: ClientProxy,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
  ) {}

  initPayment(payload: Record<string, any>): Observable<any> {
    return this.paymentClient
      .send({ cmd: 'payment.init' }, payload)
      .pipe(catchRpcError());
  }

  handleCallback(query: Record<string, any>): Observable<any> {
    return this.paymentClient
      .send('payment.callback', query)
      .pipe(catchRpcError());
  }

  getHistory(userId: string, page: number, limit: number): Observable<any> {
    return this.paymentClient
      .send({ cmd: 'payment.history' }, { userId, page, limit })
      .pipe(catchRpcError());
  }

  getPlans(): Observable<any> {
    return this.orderClient
      .send('subscription.getPlans', {})
      .pipe(catchRpcError());
  }

  emitPaymentEvent(event: string, payload: Record<string, any>): void {
    this.paymentMqClient.emit(event, payload);
  }
}
