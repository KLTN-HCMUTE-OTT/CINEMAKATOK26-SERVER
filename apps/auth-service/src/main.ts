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
      host: process.env.AUTH_SERVICE_HOST || 'localhost',
      port: Number(process.env.AUTH_SERVICE_PORT) || 3001,
    },
  });

  app.useGlobalFilters(
    new HttpToRpcExceptionFilter(),
    new RpcDomainExceptionFilter(),
  );

  await app.listen();
  console.log(`🚀 Auth service running on port ${process.env.AUTH_SERVICE_PORT || 3001}`);
}
bootstrap();