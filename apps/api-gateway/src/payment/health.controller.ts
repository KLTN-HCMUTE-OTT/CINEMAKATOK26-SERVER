import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { Public } from '@app/common/decorators';
import { PaymentService } from '../payment/payment.service';

/**
 * HealthController (API Gateway)
 *
 * Aggregates health checks from all microservices:
 *  GET /api/v1/health         — all services
 *  GET /api/v1/health/payment — payment-service only
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly paymentService: PaymentService) {}

  @Public()
  @Get('payment')
  @ApiOperation({ summary: 'Payment service health check' })
  @ApiResponse({
    status: 200,
    description: 'Returns { status: healthy|degraded, checks: {...} }',
  })
  async getPaymentHealth() {
    try {
      return await firstValueFrom(this.paymentService.getHealth());
    } catch {
      return {
        status: 'degraded',
        checks: { database: false, redis: false, rabbitmq: false },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Aggregate health check for all microservices' })
  @ApiResponse({ status: 200, description: 'Aggregated health status' })
  async getAggregatedHealth() {
    const [payment] = await Promise.allSettled([
      this.getPaymentHealth(),
    ]);

    const paymentResult =
      payment.status === 'fulfilled' ? payment.value : { status: 'degraded' };

    const overallHealthy = (paymentResult as any).status === 'healthy';

    return {
      status: overallHealthy ? 'healthy' : 'degraded',
      services: {
        payment: paymentResult,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
