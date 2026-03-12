import { NestFactory } from '@nestjs/core';
import { UserServiceModule } from './user.module';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(UserServiceModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.USER_SERVICE_HOST,
      port: Number(process.env.USER_SERVICE_PORT),
    },
  });

  await app.listen();
}
bootstrap();
