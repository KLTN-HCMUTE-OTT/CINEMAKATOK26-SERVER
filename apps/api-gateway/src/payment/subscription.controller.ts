import { firstValueFrom } from 'rxjs';

import { JwtAuthGuard } from '@app/common/guards';
import { ApiResponseDto, ResponseBuilder } from '@app/common/utils/dto';
import { catchRpcError } from '@app/common/exceptions';
import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserSession } from '@app/common/decorators';
import { CheckSubscribeDto, InformationSubscribeDto } from '@app/common/dtos/payment/subscribe.dto';
import { plainToInstance } from 'class-transformer';

@ApiTags('Subscriptions')
@ApiBearerAuth('access-token')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    @Inject('ORDER_SERVICE')
    private readonly orderClient: ClientProxy,
  ) {}

  /**
   * Get the current user's active subscription info.
   * To create/renew a subscription, use POST /payment/subscribe (VNPAY payment flow).
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current subscription status' })
  @ApiResponse({
    status: 200,
    description: 'Subscription info returned',
    type: ApiResponseDto(InformationSubscribeDto),
  })
  async getMySubscription(@UserSession('id') userId: string) {
    const result = await firstValueFrom(
      this.orderClient
        .send({ cmd: 'order.getSubscription' }, { userId })
        .pipe(catchRpcError()),
    );
    return ResponseBuilder.createResponse({
      data: plainToInstance(InformationSubscribeDto, result, {
        excludeExtraneousValues: true,
      }),
      message: result ? 'Subscription found' : 'No subscription found',
    });
  }

  /**
   * Check if the current user has an active subscription (used by DRM guard).
   * To subscribe, use POST /payment/subscribe.
   */
  @Get('check')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check if subscription is active' })
  @ApiResponse({ status: 200, description: 'Subscription check result', type: ApiResponseDto(CheckSubscribeDto) })
  async checkSubscription(@UserSession('id') userId: string) {
    const result = await firstValueFrom(
      this.orderClient
        .send({ cmd: 'order.checkSubscription' }, { userId })
        .pipe(catchRpcError()),
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(CheckSubscribeDto, result, {
        excludeExtraneousValues: true,
      }),
      message: (result as any)?.isActive
        ? 'Subscription is active'
        : 'No active subscription',
    });
  }
}
