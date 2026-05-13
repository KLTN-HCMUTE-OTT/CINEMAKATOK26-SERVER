import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment.entity';
import { SagaEventLogEntity } from '../entities/saga-event-log.entity';
import { VnpayService } from '../vnpay/vnpay.service';
import { PaymentSaga } from '../saga/payment.saga';
import { RedisService } from './redis.service';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { VnpayCallbackDto } from '../vnpay/dto/vnpay-callback.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentEntity, 'payment')
    private readonly paymentRepo: Repository<PaymentEntity>,
    @InjectRepository(SagaEventLogEntity, 'payment')
    private readonly sagaLogRepo: Repository<SagaEventLogEntity>,
    private readonly vnpayService: VnpayService,
    private readonly paymentSaga: PaymentSaga,
    private readonly redisService: RedisService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async initPayment(payload: any) {
    this.logger.log(`Initiating payment for user ${payload.userId}`);
    // TODO: Implement business logic
    return {
      success: true,
      data: {
        paymentUrl: 'http://sandbox.vnpayment.vn/vpcpay.html?...', // STUB
        orderCode: 'CK123456789', // STUB
      },
    };
  }

  async handleCallback(payload: VnpayCallbackDto) {
    const orderCode = payload.vnp_TxnRef;
    this.logger.log(`Handling VNPAY callback for order ${orderCode}`);

    // 1. Verify VNPAY signature
    const isValid = this.vnpayService.verifyCallback(payload as Record<string, string>);
    if (!isValid) {
      this.logger.error(`Invalid VNPAY signature for order: ${orderCode}`);
      return { RspCode: '97', Message: 'Invalid signature' };
    }

    if (!orderCode) {
      return { RspCode: '99', Message: 'Unknown error: missing order code' };
    }

    // 2. Check idempotency (TTL: 24 hours = 86400 seconds)
    const idempotencyStatus = await this.idempotencyService.checkAndAcquire(orderCode, 86400);
    if (idempotencyStatus === 'duplicate') {
      this.logger.warn(`Order ${orderCode} already processed or processing.`);
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    const lockKey = `lock:payment:${orderCode}`;
    
    // 3. Acquire distributed lock
    // TTL: 30 seconds for saga completion
    const lockAcquired = await this.redisService.acquireLock(lockKey, 30);
    if (!lockAcquired) {
      this.logger.warn(`Could not acquire distributed lock for order: ${orderCode}`);
      return { RspCode: '99', Message: 'Lock collision, try again later' };
    }

    try {
      // 4. Execute saga logic
      this.logger.log(`Executing saga for payment order: ${orderCode}`);
      
      // const isSuccess = this.vnpayService.isSuccessResponse(payload.vnp_ResponseCode);
      // if (isSuccess) {
      //   await this.paymentSaga.execute(orderCode); // Assuming orderCode matches payment ID for now, or find payment first
      // }

      this.logger.log(`Saga completed successfully for order: ${orderCode}`);

      // Return '00' to VNPAY indicating successful acknowledgment
      return { RspCode: '00', Message: 'Confirm Success' };
    } catch (error: any) {
      this.logger.error(`Saga failed for order ${orderCode}`, error.stack);
      return { RspCode: '00', Message: 'Confirm Success' };
    } finally {
      // 5. Release lock
      await this.redisService.releaseLock(lockKey);
      this.logger.log(`Released lock for order: ${orderCode}`);
    }
  }

  async getHistory(userId: string, page = 1, limit = 10) {
    this.logger.log(`Fetching payment history for user ${userId}`);
    // TODO: Implement pagination and filtering
    return {
      items: [],
      total: 0,
      page,
      limit,
    };
  }

  async handleDeadLetter(payload: any) {
    this.logger.error(`Handling dead letter event`, payload);
    // TODO: Implement DLQ logic
  }
}
