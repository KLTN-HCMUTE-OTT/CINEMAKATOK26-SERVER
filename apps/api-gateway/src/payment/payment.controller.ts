import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  All,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
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
import { ApiResponseDto, PaginatedApiResponseDto, PaginationQueryDto, ResponseBuilder } from '@app/common/utils/dto';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from '@app/common/dtos/payment/initiate-payment.dto';
import {
  InitiatePaymentResponseDto,
  PaymentDetailDto,
  VnpayIpnResponseDto,
} from '@app/common/dtos/payment/payment.dto';
import { plainToInstance } from 'class-transformer';

/** Helper to clean up IP addresses for VNPAY */
function normalizeIp(ip: any): string {
  if (typeof ip !== 'string') return '127.0.0.1';
  const cleanIp = ip.split(',')[0].trim();
  if (cleanIp === '::1' || cleanIp === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  return cleanIp;
}

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
  @ApiOperation({
    summary: 'Initiate subscription payment via VNPAY',
    description:
      'Creates a pending payment record and returns the VNPAY checkout URL. ' +
      'Redirect the user to `paymentUrl` to complete the payment. ' +
      'After payment, VNPAY calls the IPN webhook which triggers the subscription saga.',
  })
  @ApiResponse({
    status: 201,
    description: 'VNPAY checkout URL created successfully',
    type: ApiResponseDto(InitiatePaymentResponseDto),
  })
  @ApiResponse({ status: 400, description: 'Invalid plan or request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  async initiateSubscription(
    @UserSession('id') userId: string,
    @Body() body: InitiatePaymentDto,
    @Req() req: Request,
  ) {
    const idempotencyKey =
      (req.headers['x-idempotency-key'] as string) ??
      buildAutoIdempotencyKey(userId, body.plan);

    const planData = await firstValueFrom(
      this.paymentService.getPlanByName(body.plan)
    );

    if (!planData) {
      throw new BadRequestException(`Plan ${body.plan} does not exist`);
    }

    let ipAddr = (req.headers['x-forwarded-for'] as string) ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    ipAddr = normalizeIp(ipAddr);

    const result = await firstValueFrom(
      this.paymentService.initPayment(userId, {
        plan: body.plan,
        amount: Number(planData.price),
        ipAddress: ipAddr,
        userAgent: req.headers['user-agent'],
        idempotencyKey,
      }),
    );

    return ResponseBuilder.createResponse({
      data: result,
      message: 'Payment URL created successfully',
    });
  }

  // ─── GET /vnpay-ipn ───────────────────────────────────────────────────────

  @Public()
  @All('vnpay-ipn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'VNPAY IPN webhook callback',
    description:
      'Called by VNPAY servers after a payment is processed. ' +
      'Validates the HMAC signature, updates payment status, and triggers the subscription saga. ' +
      '**Do not call this endpoint manually.** Returns raw `{ RspCode, Message }` as required by VNPAY.',
  })
  @ApiResponse({
    status: 200,
    description: 'Raw VNPAY acknowledgement — MUST NOT be wrapped in ResponseBuilder',
    type: VnpayIpnResponseDto,
  })
  async vnpayIpn(
    @Query() query: Record<string, string>,
    @Req() req: Request,
  ) {
    const params = req.method === 'POST' ? req.body : query;
    return firstValueFrom(this.paymentService.handleIpnCallback(params));
  }

  // ─── GET /vnpay-return ─────────────────────────────────────────────────────

  @Public()
  @Get('vnpay-return')
  @ApiOperation({
    summary: 'VNPAY return redirect',
    description:
      'VNPAY redirects the user here after completing payment. ' +
      'This endpoint immediately redirects to the frontend payment result page.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to `{CLIENT_ORIGIN}/payment/result?status=success|failed&orderCode=...`',
  })
  async vnpayReturn(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.CLIENT_ORIGIN ?? 'http://localhost:3001';
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
  @ApiOperation({
    summary: 'Get paginated payment history',
    description: 'Returns a paginated list of all payments made by the authenticated user.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (1-indexed)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Items per page (max 100)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of payment records',
    type: PaginatedApiResponseDto(PaymentDetailDto),
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getHistory(
    @UserSession('id') userId: string,
    @Query() query: PaginationQueryDto
  ) {
    const effectiveLimit = Math.min(Number(query.limit) || 10, 100); // max 100
    const result = await firstValueFrom(
      this.paymentService.getPaymentHistory(userId, Number(query.page) || 1, effectiveLimit),
    );
    return ResponseBuilder.createPaginatedResponse({
      data: result.data.map(item => plainToInstance(PaymentDetailDto, item, {
        excludeExtraneousValues: true,
      })),
      message: 'Get Payment History Successfully',
      currentPage: result.page,
      itemsPerPage: result.limit,
      totalItems: result.total,
    });
  }

  // ─── GET /:id ──────────────────────────────────────────────────────────────

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get payment detail by ID',
    description: 'Returns the full detail of a single payment record owned by the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment detail',
    type: ApiResponseDto(PaymentDetailDto),
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found or does not belong to this user' })
  async getById(
    @UserSession('id') userId: string,
    @Param('id') paymentId: string,
  ) {
    const result = await firstValueFrom(
      this.paymentService.getPaymentById(userId, paymentId),
    );
    return ResponseBuilder.createResponse({
      data: plainToInstance(PaymentDetailDto, result, {
        excludeExtraneousValues: true,
      }),
      message: 'Payment detail retrieved successfully',
    });
  }
}
