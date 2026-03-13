import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth.module';
import { Transport } from '@nestjs/microservices';
import {
  HttpToRpcExceptionFilter,
  RpcDomainExceptionFilter,
} from '@app/common/filters';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AuthServiceModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.AUTH_SERVICE_HOST,
      port: process.env.AUTH_SERVICE_PORT,
    },
  });

  // Order matters: DomainError filter runs first (more specific), HttpException filter second
  app.useGlobalFilters(
    new HttpToRpcExceptionFilter(),
    new RpcDomainExceptionFilter(),
  );

  await app.listen();
}
bootstrap();
