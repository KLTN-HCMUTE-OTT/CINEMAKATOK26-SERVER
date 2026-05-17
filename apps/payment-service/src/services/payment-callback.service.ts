import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VnpayService } from '../vnpay/vnpay.service';
import { PaymentEntity, PaymentStatus } from '../entities/payment.entity';
import { PaymentSaga } from '../saga/payment.saga';
import { RedisService } from './redis.service';

/**
 * Handles VNPAY IPN (Instant Payment Notification) and return-URL callbacks.
 *
 * Processing order (per design spec):
 *  1. Verify HMAC signature
 *  2. Find payment by orderCode (vnp_TxnRef)
 *  3. Idempotency check (Redis SETNX)
 *  4. Amount validation
 *  5. Status check (must be PENDING)
 *  6. Populate VNPAY response fields on entity
 *  7a. Success path: mark COMPLETED → trigger saga continuation
 *  7b. Failure path: mark FAILED → log saga failure
 *
 * IMPORTANT: Always ACK VNPAY with RspCode '00' for business failures
 * (payment rejected, etc.) — only return error codes for system-level issues.
 */
@Injectable()
export class PaymentCallbackService {
  private readonly logger = new Logger(PaymentCallbackService.name);

  constructor(
    private readonly vnpayService: VnpayService,
    @InjectRepository(PaymentEntity, 'payment')
    private readonly paymentRepo: Repository<PaymentEntity>,
    private readonly paymentSaga: PaymentSaga,
    private readonly redis: RedisService,
  ) {}

  /**
   * Handle VNPAY IPN callback.
   * Returns VNPAY-expected response format: { RspCode, Message }
   */
  async handleIpnCallback(
    vnpParams: Record<string, string>,
  ): Promise<{ RspCode: string; Message: string }> {
    // Step 1: Verify signature
    if (!this.vnpayService.verifyCallback(vnpParams)) {
      this.logger.warn('Invalid VNPAY signature');
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    const orderCode = vnpParams['vnp_TxnRef'];
    const vnpayTxnNo = vnpParams['vnp_TransactionNo'];
    const responseCode = vnpParams['vnp_ResponseCode'];

    if (!orderCode) {
      this.logger.warn('Missing vnp_TxnRef in VNPAY callback');
      return { RspCode: '99', Message: 'Invalid Request' };
    }

    // Step 2: Find payment record
    const payment = await this.paymentRepo.findOne({
      where: { orderCode },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for order: ${orderCode}`);
      return { RspCode: '01', Message: 'Order Not Found' };
    }

    // Step 3: Idempotency — SETNX key: vnpay:callback:{orderCode}:{vnp_TransactionNo}
    const idempotencyKey = `vnpay:callback:${orderCode}:${vnpayTxnNo}`;
    const alreadyProcessed = await this.redis.setNX(
      idempotencyKey,
      'processing',
      3600, // 1 hour TTL
    );

    if (!alreadyProcessed) {
      this.logger.log(`Duplicate callback for order: ${orderCode}`);
      return { RspCode: '02', Message: 'Order Already Confirmed' };
    }

    // Step 4: Amount check: parseInt(vnp_Amount) / 100 === payment.amount
    const vnpAmount = parseInt(vnpParams['vnp_Amount'] ?? '0', 10) / 100;
    if (vnpAmount !== Number(payment.amount)) {
      this.logger.error(
        `Amount mismatch for order ${orderCode}: expected ${payment.amount}, got ${vnpAmount}`,
      );
      // Clean up Redis key so it can be retried with correct data
      await this.redis.del(idempotencyKey);
      return { RspCode: '04', Message: 'Invalid Amount' };
    }

    // Step 5: Status check — must still be PENDING
    if (payment.status !== PaymentStatus.PENDING) {
      this.logger.log(
        `Payment ${orderCode} already processed with status: ${payment.status}`,
      );
      return { RspCode: '02', Message: 'Order Already Confirmed' };
    }

    // Step 6: Populate VNPAY response fields
    payment.vnpayTxnNo = vnpayTxnNo;
    payment.vnpayResponseCode = responseCode;
    payment.vnpayMessage = vnpParams['vnp_OrderInfo'] ?? null;
    payment.bankCode = vnpParams['vnp_BankCode'] ?? null;
    payment.cardType = vnpParams['vnp_CardType'] ?? null;
    payment.payDate = this.parseVnpayDate(vnpParams['vnp_PayDate']) as Date;

    // Step 7: Process based on payment outcome
    if (this.vnpayService.isPaymentSuccess(vnpParams)) {
      // 7a: Success path
      payment.status = PaymentStatus.COMPLETED;
      await this.paymentRepo.save(payment);

      // Trigger saga steps 3→6 (non-blocking — errors are handled inside saga)
      this.paymentSaga.continueAfterPayment(payment).catch((err) => {
        this.logger.error(
          `Post-payment saga failed for ${orderCode}: ${err.message}`,
        );
      });

      this.logger.log(`Payment SUCCESS: ${orderCode}`);
      return { RspCode: '00', Message: 'Confirm Success' };
    } else {
      // 7b: Payment rejected by bank/gateway
      payment.status = PaymentStatus.FAILED;
      await this.paymentRepo.save(payment);

      await this.paymentSaga.handlePaymentFailure(payment, responseCode);

      this.logger.warn(
        `Payment FAILED: ${orderCode}, responseCode=${responseCode}`,
      );
      // Still ACK to VNPAY — failure is a business result, not a system error
      return { RspCode: '00', Message: 'Confirm Success' };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse a VNPAY date string (yyyyMMddHHmmss) to a Date in UTC+7.
   * Returns null when the string is absent or malformed.
   */
  private parseVnpayDate(dateStr: string | undefined): Date | null {
    if (!dateStr || dateStr.length !== 14) return null;
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    const h = dateStr.substring(8, 10);
    const mi = dateStr.substring(10, 12);
    const s = dateStr.substring(12, 14);
    return new Date(`${y}-${m}-${d}T${h}:${mi}:${s}+07:00`);
  }
}
