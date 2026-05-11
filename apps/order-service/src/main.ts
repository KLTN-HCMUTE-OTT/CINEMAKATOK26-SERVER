import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';

import {
  HttpToRpcExceptionFilter,
  RpcDomainExceptionFilter,
} from '@app/common/filters';

import { OrderServiceModule } from './order-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(OrderServiceModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.ORDER_SERVICE_HOST || 'localhost',
      port: Number(process.env.ORDER_SERVICE_PORT) || 3004,
    },
  });

  app.useGlobalFilters(
    new HttpToRpcExceptionFilter(),
    new RpcDomainExceptionFilter(),
  );

  await app.listen();
  console.log(
    `Order service running on port ${process.env.ORDER_SERVICE_PORT || 3004}`,
  );
}

bootstrap();
