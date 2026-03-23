import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';

import {
  HttpToRpcExceptionFilter,
  RpcDomainExceptionFilter,
} from '@app/common/filters';

import { StreamingModule } from './streaming.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(StreamingModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.STREAMING_SERVICE_HOST || 'localhost',
      port: Number(process.env.STREAMING_SERVICE_PORT) || 3006,
    },
  });

  app.useGlobalFilters(
    new HttpToRpcExceptionFilter(),
    new RpcDomainExceptionFilter(),
  );

  await app.listen();
  console.log(
    `Streaming service running on port ${process.env.STREAMING_SERVICE_PORT || 3006}`,
  );
}

bootstrap();
