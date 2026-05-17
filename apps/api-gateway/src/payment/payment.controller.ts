import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';

import { JwtAuthGuard } from '@app/common/guards';
import { Public, UserSession } from '@app/common/decorators';
import { ResponseBuilder } from '@app/common/utils/dto';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from '@app/common/dtos/payment/initiate-payment.dto';

/** Auto-generate an idempotency key when the client omits the header. */
function buildAutoIdempotencyKey(userId: string, plan: string): string {
  const minute = Math.floor(Date.now() / 60_000);
  return createHash('sha256').update(`${userId}${plan}${minute}`).digest('hex');
}

/**
 * PaymentController (API Gateway layer)
 *
 * Endpoints:
 *  POST /api/v1/payments/subscribe      — initiate VNPAY subscription payment
 *  POST /api/v1/payments/vnpay-ipn      — VNPAY IPN webhook (raw response, no wrapping)
 *  GET  /api/v1/payments/vnpay-return   — redirect to frontend after VNPAY
 *  GET  /api/v1/payments/history        — paginated payment history
 *  GET  /api/v1/payments/:id            — single payment by ID
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ─── POST /subscribe ────────────────────────────────────────────────────────

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Initiate subscription payment via VNPAY' })
  @ApiResponse({ status: 201, description: 'Payment URL created' })
  async initiateSubscription(
    @UserSession('id') userId: string,
    @Body() body: InitiatePaymentDto,
    @Req() req: Request,
  ) {
    // Resolve idempotency key from header or auto-generate
    const idempotencyKey =
      (req.headers['x-idempotency-key'] as string) ??
      buildAutoIdempotencyKey(userId, body.plan);

    const result = await firstValueFrom(
      this.paymentService.initPayment(userId, {
        plan: body.plan,
        returnUrl: body.returnUrl,
        ipAddress:
          (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '127.0.0.1',
        userAgent: req.headers['user-agent'],
        idempotencyKey,
      }),
    );

    return ResponseBuilder.createResponse({
      data: result,
      message: 'Payment URL created',
    });
  }

  // ─── POST /vnpay-ipn ───────────────────────────────────────────────────────

  @Public()
  @Post('vnpay-ipn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'VNPAY IPN webhook — returns { RspCode, Message }',
  })
  @ApiResponse({
    status: 200,
    description:
      'Raw VNPAY acknowledgement — MUST NOT be wrapped in ResponseBuilder',
  })
  async vnpayIpn(@Body() body: Record<string, string>) {
    // CRITICAL: return raw { RspCode, Message } — do NOT wrap in ResponseBuilder
    return firstValueFrom(this.paymentService.handleIpnCallback(body));
  }

  // ─── GET /vnpay-return ─────────────────────────────────────────────────────

  @Public()
  @Get('vnpay-return')
  @ApiOperation({ summary: 'VNPAY return redirect to frontend (302)' })
  @ApiResponse({ status: 302, description: 'Redirects to CLIENT_ORIGIN/payment/result' })
  async vnpayReturn(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const frontendUrl =
      process.env.CLIENT_ORIGIN ?? 'http://localhost:3001';
    const status = query['vnp_ResponseCode'] === '00' ? 'success' : 'failed';
    const orderCode = query['vnp_TxnRef'] ?? '';
    return res.redirect(
      `${frontendUrl}/payment/result?status=${status}&orderCode=${orderCode}`,
    );
  }

  // ─── GET /history ──────────────────────────────────────────────────────────

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get paginated payment history' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Paginated payment list' })
  async getHistory(
    @UserSession('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const effectiveLimit = Math.min(Number(limit) || 10, 100); // max 100
    const result = await firstValueFrom(
      this.paymentService.getPaymentHistory(userId, Number(page) || 1, effectiveLimit),
    );
    return ResponseBuilder.createResponse({ data: result });
  }

  // ─── GET /:id ──────────────────────────────────────────────────────────────

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get payment detail by ID' })
  @ApiResponse({ status: 200, description: 'Payment detail' })
  async getById(
    @UserSession('id') userId: string,
    @Param('id') paymentId: string,
  ) {
    const result = await firstValueFrom(
      this.paymentService.getPaymentById(userId, paymentId),
    );
    return ResponseBuilder.createResponse({ data: result });
  }
}
