import { 
  Body, Controller, Get, HttpCode, HttpStatus, Post, 
  Query, Res, UseGuards, UnauthorizedException,
  Ip, Headers, Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard } from '@app/common/guards';
import { Public, UserSession } from '@app/common/decorators';
import { SubscribeDto } from '../../../../libs/common/src/dtos/payment/subscribe.dto';
import { PaymentService } from './payment.service';
import { ResponseBuilder, PaginationQueryDto } from '@app/common/utils/dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Initiate a subscription payment' })
  @ApiResponse({ status: 201, description: 'Payment URL generated' })
  async subscribe(
    @UserSession('id') userId: string,
    @Body() dto: SubscribeDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const payload = {
      userId,
      plan: dto.plan,
      ipAddress: ipAddress || '127.0.0.1',
      userAgent: userAgent || '',
      returnUrl: process.env.VNPAY_RETURN_URL,
    };

    const result = await firstValueFrom(this.paymentService.initPayment(payload));
    return ResponseBuilder.createResponse({
      data: result,
      message: 'Payment initiated successfully',
    });
  }

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'VNPAY Return URL redirect callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend based on payment status' })
  async paymentCallback(@Query() query: any, @Res() res: Response) {
    try {
      const response = await firstValueFrom(this.paymentService.handleCallback(query));

      const qs = new URLSearchParams(query as Record<string, string>).toString();

      if (response && response.RspCode === '00') {
        const successUrl = process.env.FRONTEND_SUCCESS_URL || 'http://localhost:3000/payment/success';
        return res.redirect(`${successUrl}?${qs}`);
      } else {
        const failUrl = process.env.FRONTEND_FAIL_URL || 'http://localhost:3000/payment/fail';
        return res.redirect(`${failUrl}?${qs}`);
      }
    } catch (error) {
      const failUrl = process.env.FRONTEND_FAIL_URL || 'http://localhost:3000/payment/fail';
      return res.redirect(`${failUrl}?error=server_error`);
    }
  }

  @Public()
  @Post('ipn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'VNPAY IPN webhook' })
  @ApiResponse({ status: 200, description: 'Returns RspCode and Message' })
  async paymentIpn(@Query() query: any, @Req() req: Request) {
    const allowedIps = (process.env.VNPAY_IPN_IP || '').split(',').map(ip => ip.trim());
    const reqIp = req.ip || req.socket?.remoteAddress || '';
    
    // Basic IP whitelist check
    if (allowedIps.length > 0 && allowedIps[0] !== '' && reqIp) {
      const isAllowed = allowedIps.some(ip => reqIp.includes(ip));
      if (!isAllowed) {
        throw new UnauthorizedException('IP not allowed for IPN');
      }
    }

    try {
      const response = await firstValueFrom(this.paymentService.handleCallback(query));
      // VNPay explicitly expects a raw JSON object { RspCode, Message } for IPN
      return response;
    } catch (error) {
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user payment history' })
  @ApiResponse({ status: 200, description: 'Paginated list of payments' })
   @ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number for pagination',
    })
    @ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of items per page',
    })
  async getHistory(
    @UserSession('id') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const p = query.page || 1;
    const l = query.limit || 10;
    const result = await firstValueFrom(this.paymentService.getHistory(userId, p, l));
    
    return ResponseBuilder.createPaginatedResponse({
      data: result?.items || [],
      totalItems: result?.total || 0,
      currentPage: p,
      itemsPerPage: l,
      message: 'Payment history retrieved successfully',
    });
  }

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plans' })
  @ApiResponse({ status: 200, description: 'List of plans with pricing' })
  async getPlans() {
    const result = await firstValueFrom(this.paymentService.getPlans());
    return ResponseBuilder.createResponse({
      data: result,
      message: 'Subscription plans retrieved successfully',
    });
  }
}
