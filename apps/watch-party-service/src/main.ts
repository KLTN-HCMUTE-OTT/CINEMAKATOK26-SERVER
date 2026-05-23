import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';

import {
  HttpToRpcExceptionFilter,
  RpcDomainExceptionFilter,
} from '@app/common/filters';

import { WatchPartyServiceModule } from './watch-party-service.module';

async function bootstrap() {
  const port = Number(process.env.WATCH_PARTY_SERVICE_PORT) || 3010;
  const host = process.env.WATCH_PARTY_SERVICE_HOST || 'localhost';

  const app = await NestFactory.createMicroservice(WatchPartyServiceModule, {
    transport: Transport.TCP,
    options: { host, port },
  });

  app.useGlobalFilters(
    new HttpToRpcExceptionFilter(),
    new RpcDomainExceptionFilter(),
  );

  await app.listen();
  // eslint-disable-next-line no-console
  console.log(`🎬 Watch-party service running on tcp://${host}:${port}`);
}

bootstrap();
