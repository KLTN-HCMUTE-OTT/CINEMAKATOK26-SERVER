import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth.module';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AuthServiceModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.AUTH_SERVICE_HOST,
      port: process.env.AUTH_SERVICE_PORT,
    },
  });

  await app.listen();
}
bootstrap();
