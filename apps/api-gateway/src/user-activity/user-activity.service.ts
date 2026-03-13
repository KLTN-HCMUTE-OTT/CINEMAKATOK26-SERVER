import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { catchRpcError } from '@app/common/exceptions';

@Injectable()
export class UserActivityService {
  constructor(
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
  ) {}

  createOrder(userId: string, data: Record<string, any>): Observable<any> {
    return this.orderClient
      .send({ cmd: 'order.create' }, { userId, ...data })
      .pipe(catchRpcError());
  }

  getOrders(userId: string, query: Record<string, any>): Observable<any> {
    return this.orderClient
      .send({ cmd: 'order.getAll' }, { userId, ...query })
      .pipe(catchRpcError());
  }

  getOrderById(userId: string, orderId: string): Observable<any> {
    return this.orderClient
      .send({ cmd: 'order.getById' }, { userId, orderId })
      .pipe(catchRpcError());
  }
}
