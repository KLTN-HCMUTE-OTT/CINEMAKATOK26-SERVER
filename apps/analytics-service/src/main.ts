import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';

import {
  HttpToRpcExceptionFilter,
  RpcDomainExceptionFilter,
} from '@app/common/filters';

import { AnalyticsModule } from './analytics.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AnalyticsModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.ANALYTICS_SERVICE_HOST || 'localhost',
      port: Number(process.env.ANALYTICS_SERVICE_PORT) || 3008,
    },
  });

  app.useGlobalFilters(
    new HttpToRpcExceptionFilter(),
    new RpcDomainExceptionFilter(),
  );

  await app.listen();
  console.log(
    `Analytics service running on port ${process.env.ANALYTICS_SERVICE_PORT || 3008}`,
  );
}

bootstrap();
