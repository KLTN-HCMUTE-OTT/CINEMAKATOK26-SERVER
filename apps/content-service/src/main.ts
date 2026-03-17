import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';

import {
  HttpToRpcExceptionFilter,
  RpcDomainExceptionFilter,
} from '@app/common/filters';

import { ContentModule } from './content.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(ContentModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.CONTENT_SERVICE_HOST || 'localhost',
      port: Number(process.env.CONTENT_SERVICE_PORT) || 3003,
    },
  });

  app.useGlobalFilters(
    new HttpToRpcExceptionFilter(),
    new RpcDomainExceptionFilter(),
  );

  await app.listen();
  console.log(
    `Content service running on port ${process.env.CONTENT_SERVICE_PORT || 3003}`,
  );
}

bootstrap();
