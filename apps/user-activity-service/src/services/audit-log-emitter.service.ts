import { LOG_ACTION, RESOURCE_TYPE } from '@app/common/enums/log.enum';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

export interface AuditLogPayload {
  userId: string;
  action: LOG_ACTION;
  resourceType?: RESOURCE_TYPE;
  resourceId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditLogEmitterService {
  private readonly logger = new Logger(AuditLogEmitterService.name);

  constructor(
    @Inject('AUDIT_LOG_SERVICE')
    private readonly auditClient: ClientProxy,
  ) {}

  /**
   * Emit an audit log event to the audit-log-service via RabbitMQ.
   * Fire-and-forget: does NOT block the calling service on success or failure.
   */
  emitLog(payload: AuditLogPayload): void {
    firstValueFrom(
      this.auditClient.send({ cmd: 'create_audit_log' }, payload),
    ).catch((err) => {
      this.logger.warn(
        `Failed to emit audit log [${payload.action}] for user ${payload.userId}: ${err.message}`,
      );
    });
  }
}
