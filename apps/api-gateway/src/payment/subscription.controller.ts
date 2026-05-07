import { firstValueFrom } from 'rxjs';

import { JwtAuthGuard } from '@app/common/guards';
import { ResponseBuilder } from '@app/common/utils/dto';
import { catchRpcError } from '@app/common/exceptions';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    @Inject('ORDER_SERVICE')
    private readonly orderClient: ClientProxy,
  ) {}

  /**
   * Get the current user's subscription status.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current subscription status' })
  @ApiResponse({ status: 200, description: 'Subscription info returned' })
  async getMySubscription(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;

    const result = await firstValueFrom(
      this.orderClient
        .send({ cmd: 'order.getSubscription' }, { userId })
        .pipe(catchRpcError()),
    );

    return ResponseBuilder.createResponse({
      data: result,
      message: result
        ? 'Subscription found'
        : 'No subscription found',
    });
  }

  /**
   * Create a subscription for the current user.
   * For the academic project, this is simplified (no payment integration).
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create or renew subscription' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        plan: {
          type: 'string',
          enum: ['basic', 'premium'],
          default: 'basic',
        },
        durationDays: {
          type: 'number',
          default: 30,
          description: 'Subscription duration in days',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Subscription created' })
  async createSubscription(
    @Req() req: any,
    @Body() body: { plan?: string; durationDays?: number },
  ) {
    const userId = req.user?.id || req.user?.sub;

    const result = await firstValueFrom(
      this.orderClient
        .send(
          { cmd: 'order.createSubscription' },
          {
            userId,
            plan: body.plan || 'basic',
            durationDays: body.durationDays || 30,
          },
        )
        .pipe(catchRpcError()),
    );

    return ResponseBuilder.createResponse({
      data: result,
      statusCode: 201,
      message: 'Subscription created successfully',
    });
  }

  /**
   * Check subscription status (for DRM validation).
   */
  @Get('check')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check if subscription is active' })
  @ApiResponse({ status: 200, description: 'Subscription check result' })
  async checkSubscription(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;

    const result = await firstValueFrom(
      this.orderClient
        .send({ cmd: 'order.checkSubscription' }, { userId })
        .pipe(catchRpcError()),
    );

    return ResponseBuilder.createResponse({
      data: result,
      message: (result as any)?.isActive
        ? 'Subscription is active'
        : 'No active subscription',
    });
  }
}
