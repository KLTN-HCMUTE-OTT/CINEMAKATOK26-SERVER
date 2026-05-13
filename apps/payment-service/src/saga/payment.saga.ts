import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom, timeout, retry } from 'rxjs';
import { PaymentEntity, PaymentStatus } from '../entities/payment.entity';
import { SagaEventLogEntity } from '../entities/saga-event-log.entity';
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto';

@Injectable()
export class PaymentSaga {
  private readonly logger = new Logger(PaymentSaga.name);

  constructor(
    @InjectRepository(PaymentEntity, 'payment')
    private readonly paymentRepo: Repository<PaymentEntity>,
    @InjectRepository(SagaEventLogEntity, 'payment')
    private readonly sagaEventLogRepo: Repository<SagaEventLogEntity>,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
  ) {}

  async execute(paymentId: string): Promise<void> {
    this.logger.log(`Executing payment saga for payment ${paymentId}`);
    
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) {
      this.logger.error(`Payment ${paymentId} not found`);
      return;
    }

    if (!payment.sagaId) {
      this.logger.error(`Payment ${paymentId} has no sagaId`);
      return;
    }

    try {
      // Step 1: Update payment status to completed
      await this.stepCompletePayment(payment);

      // Step 2: Activate subscription
      const subscription = await this.stepActivateSubscription(payment);

      // Step 3: Link subscription to payment
      await this.stepLinkSubscription(payment.id, subscription.id, payment.sagaId);

      // Step 4: Emit notification
      await this.stepNotify(payment, subscription);
      
      this.logger.log(`Saga completed successfully for payment ${paymentId}`);
    } catch (error: any) {
      this.logger.error(`Saga failed for payment ${paymentId}: ${error.message}`, error.stack);
      await this.compensate(payment, payment.sagaId, 'execute', error);
    }
  }

  private async stepCompletePayment(payment: PaymentEntity): Promise<void> {
    this.logger.log(`Step 1: Completing payment ${payment.id}`);
    
    payment.status = PaymentStatus.COMPLETED;
    payment.sagaStatus = 'processing';
    await this.paymentRepo.save(payment);
    
    await this.logStep(payment.sagaId, 'complete_payment', 'success', { paymentId: payment.id });
  }

  private async stepActivateSubscription(payment: PaymentEntity): Promise<any> {
    this.logger.log(`Step 2: Activating subscription for payment ${payment.id}`);
    
    const payload: ActivateSubscriptionDto = {
      userId: payment.userId,
      plan: payment.plan,
      durationDays: payment.durationDays,
      paymentId: payment.id,
      paymentType: payment.paymentType,
    };

    if (payment.paymentType === 'upgrade') {
      payload.previousPlan = 'basic'; // As per constraints
    }

    try {
      const response = await firstValueFrom(
        this.orderClient.send('subscription.activate', payload).pipe(
          timeout(10000),
          retry({ count: 3, delay: 1000 })
        )
      );
      
      await this.logStep(payment.sagaId, 'activate_subscription', 'success', { subscriptionId: response?.id });
      return response;
    } catch (error: any) {
      await this.logStep(payment.sagaId, 'activate_subscription', 'failed', null, error.message);
      throw error;
    }
  }

  private async stepLinkSubscription(paymentId: string, subscriptionId: string, sagaId: string): Promise<void> {
    this.logger.log(`Step 3: Linking subscription ${subscriptionId} to payment ${paymentId}`);
    
    await this.paymentRepo.update(paymentId, {
      subscriptionId,
      sagaStatus: 'completed'
    });
    
    await this.logStep(sagaId, 'link_subscription', 'success', { subscriptionId });
  }

  private async stepNotify(payment: PaymentEntity, subscription: any): Promise<void> {
    this.logger.log(`Step 4: Sending notification for payment ${payment.id}`);
    
    try {
      this.notificationClient.emit('payment.success', {
        paymentId: payment.id,
        userId: payment.userId,
        plan: payment.plan,
        amount: payment.amount,
        subscriptionId: subscription.id,
      });
      await this.logStep(payment.sagaId, 'notify', 'success');
    } catch (error: any) {
      await this.logStep(payment.sagaId, 'notify', 'failed', null, error.message);
      // We throw to trigger compensation per requirements: "If ANY step fails after step 1"
      throw error;
    }
  }

  private async compensate(payment: PaymentEntity, sagaId: string, failedStep: string, error: any): Promise<void> {
    this.logger.warn(`Compensating saga ${sagaId} for payment ${payment.id}`);
    
    await this.logStep(sagaId, `compensate_${failedStep}`, 'compensation_started', { originalError: error.message });
    
    await this.paymentRepo.update(payment.id, {
      sagaStatus: 'compensation_needed'
    });

    this.notificationClient.emit('payment.saga.failed', {
      paymentId: payment.id,
      sagaId,
      error: error.message,
      userId: payment.userId,
    });
    
    await this.logStep(sagaId, `compensate_${failedStep}`, 'compensation_completed');
  }

  private async logStep(sagaId: string, stepName: string, status: string, payload?: any, error?: string): Promise<void> {
    const log = this.sagaEventLogRepo.create({
      sagaId,
      stepName,
      status,
      payload,
      error,
    });
    await this.sagaEventLogRepo.save(log);
  }
}
