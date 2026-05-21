import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { catchRpcError } from '@app/common/exceptions';

/**
 * PaymentService (API Gateway)
 *
 * Thin wrapper that forwards requests to the payment-service microservice
 * via TCP (RPC) and to the order-service for subscription queries.
 *
 * All methods return Observable<any> so controllers can use firstValueFrom().
 */
@Injectable()
export class PaymentService {
  constructor(
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
    @Inject('PAYMENT_SERVICE_MQ')
    private readonly paymentMqClient: ClientProxy,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
  ) {}

  // ─── Payment RPC ──────────────────────────────────────────────────────────

  initPayment(
    userId: string,
    payload: {
      plan: string;
      amount: number;
      returnUrl?: string;
      ipAddress: string;
      userAgent?: string;
      idempotencyKey: string;
    },
  ): Observable<any> {
    return this.paymentClient
      .send({ cmd: 'payment.init' }, { userId, ...payload })
      .pipe(catchRpcError());
  }

  handleIpnCallback(query: Record<string, any>): Observable<any> {
    return this.paymentClient
      .send({ cmd: 'payment.callback' }, query)
      .pipe(catchRpcError());
  }

  getPaymentHistory(
    userId: string,
    page: number,
    limit: number,
  ): Observable<any> {
    return this.paymentClient
      .send({ cmd: 'payment.history' }, { userId, page, limit })
      .pipe(catchRpcError());
  }

  getPaymentById(userId: string, paymentId: string): Observable<any> {
    return this.paymentClient
      .send({ cmd: 'payment.getById' }, { userId, paymentId })
      .pipe(catchRpcError());
  }

  /** Legacy alias used by existing callback handler */
  handleCallback(query: Record<string, any>): Observable<any> {
    return this.handleIpnCallback(query);
  }

  /** Legacy alias used by existing getHistory controller */
  getHistory(userId: string, page: number, limit: number): Observable<any> {
    return this.getPaymentHistory(userId, page, limit);
  }

  // ─── Subscription RPC ─────────────────────────────────────────────────────

  getPlans(): Observable<any> {
    return this.orderClient
      .send('subscription.getPlans', {})
      .pipe(catchRpcError());
  }

  getPlanByName(name: string): Observable<any> {
    return this.orderClient
      .send({ cmd: 'order.getPlanByName' }, { name })
      .pipe(catchRpcError());
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  getHealth(): Observable<any> {
    return this.paymentClient
      .send({ cmd: 'payment.health' }, {})
      .pipe(catchRpcError());
  }

  // ─── Event emit ───────────────────────────────────────────────────────────

  emitPaymentEvent(event: string, payload: Record<string, any>): void {
    this.paymentMqClient.emit(event, payload);
  }
}
