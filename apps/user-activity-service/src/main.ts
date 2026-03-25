import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';

import {
  HttpToRpcExceptionFilter,
  RpcDomainExceptionFilter,
} from '@app/common/filters';

import { UserActivityModule } from './user-activity.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(UserActivityModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.USER_ACTIVITY_SERVICE_HOST || 'localhost',
      port: Number(process.env.USER_ACTIVITY_SERVICE_PORT) || 3007,
    },
  });

  app.useGlobalFilters(
    new HttpToRpcExceptionFilter(),
    new RpcDomainExceptionFilter(),
  );

  await app.listen();
  console.log(
    `User activity service running on port ${process.env.USER_ACTIVITY_SERVICE_PORT || 3007}`,
  );
}

bootstrap();
