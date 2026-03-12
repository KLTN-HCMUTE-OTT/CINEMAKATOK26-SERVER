import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
  ) {}

  /**
   * Fire-and-forget: publish an event to the notification queue.
   * Does NOT await a response — failures are logged but do not affect the caller.
   */
  emit(event: string, payload: Record<string, any>): void {
    this.notificationClient.emit(event, payload);
    this.logger.debug(`Emitted notification event: ${event}`);
  }

  sendWelcomeEmail(userId: string, email: string): void {
    this.emit('notification.welcome', { userId, email });
  }

  sendOrderConfirmation(userId: string, orderId: string): void {
    this.emit('notification.order.confirmed', { userId, orderId });
  }

  sendPaymentSuccess(userId: string, paymentId: string): void {
    this.emit('notification.payment.success', { userId, paymentId });
  }
}
