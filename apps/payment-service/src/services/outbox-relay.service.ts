import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { OutboxEvent } from '../entities/outbox-event.entity';

/**
 * OutboxRelayService — Polling Publisher for the Transactional Outbox Pattern.
 *
 * Every 5 seconds, queries unpublished outbox events (oldest first, max 50)
 * and relays them to the audit message broker.
 *
 * Key design decisions:
 * - **Strict ordering**: breaks on first publish failure to avoid out-of-order delivery.
 * - **At-least-once delivery**: the event stays unpublished if emit fails; it will be
 *   retried on the next cron tick.
 * - **No transactions here**: the outbox event was already committed atomically with
 *   the business operation inside the saga. This service only handles the relay.
 */
@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    @InjectRepository(OutboxEvent, 'payment')
    private readonly outboxRepo: Repository<OutboxEvent>,
    @Inject('AUDIT_SERVICE_MQ')
    private readonly auditClient: ClientProxy,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async publishPendingEvents(): Promise<void> {
    const events = await this.outboxRepo.find({
      where: { published: false },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    if (events.length === 0) return;

    this.logger.debug(`Relaying ${events.length} pending outbox event(s)`);

    for (const event of events) {
      try {
        this.auditClient.emit(event.eventType, event.payload);

        event.published = true;
        event.publishedAt = new Date();
        await this.outboxRepo.save(event);

        this.logger.debug(`Published outbox event ${event.id}: ${event.eventType}`);
      } catch (error: any) {
        this.logger.error(
          `Failed to publish outbox event ${event.id} (${event.eventType}): ${error.message}`,
        );
        // Break immediately to preserve event ordering.
        // The failed event will be retried on the next cron tick.
        break;
      }
    }
  }
}
