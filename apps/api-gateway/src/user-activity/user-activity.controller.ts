import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserActivityService } from './user-activity.service';
import { UserSession } from '@app/common/decorators';

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrderController {
  constructor(private readonly userActivityService: UserActivityService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new subscription order' })
  createOrder(
    @UserSession('id') userId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.userActivityService.createOrder(userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders for current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getOrders(
    @UserSession('id') userId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.userActivityService.getOrders(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  getOrderById(
    @UserSession('id') userId: string,
    @Param('id') orderId: string,
  ) {
    return this.userActivityService.getOrderById(userId, orderId);
  }
}
