import { NestFactory } from '@nestjs/core';
import { UserServiceModule } from './user.module';
import { Transport } from '@nestjs/microservices';
import {
  HttpToRpcExceptionFilter,
  RpcDomainExceptionFilter,
} from '@app/common/filters';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(UserServiceModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.USER_SERVICE_HOST,
      port: Number(process.env.USER_SERVICE_PORT),
    },
  });

  // Order matters: DomainError filter runs first (more specific), HttpException filter second
  app.useGlobalFilters(
    new HttpToRpcExceptionFilter(),
    new RpcDomainExceptionFilter(),
  );

  await app.listen();
  console.log(
    `User Service is running on port ${process.env.USER_SERVICE_PORT}`,
  );
}
bootstrap();
