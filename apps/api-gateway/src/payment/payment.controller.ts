import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { Public } from '@app/common/decorators/public.decorator';
import { UserSession } from '@app/common/decorators';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('init')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Initiate a payment for an order' })
  initPayment(
    @UserSession('id') userId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.paymentService.initPayment(userId, body);
  }

  @Public()
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payment gateway webhook callback (no auth required)' })
  paymentCallback(@Body() body: Record<string, any>) {
    return this.paymentService.handleCallback(body);
  }
}
