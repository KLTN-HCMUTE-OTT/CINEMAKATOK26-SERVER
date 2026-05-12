import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { HttpToRpcExceptionFilter, RpcDomainExceptionFilter } from '@app/common/filters';
import { PaymentServiceModule } from './payment-service.module';

async function bootstrap() {
  // Create hybrid application for both TCP (Gateway requests) and RMQ (Async events)
  const app = await NestFactory.create(PaymentServiceModule);

  const tcpPort = Number(process.env.PAYMENT_SERVICE_PORT) || 3008;
  const tcpHost = process.env.PAYMENT_SERVICE_HOST || 'localhost';
  const rmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  // TCP Microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: tcpHost,
      port: tcpPort,
    },
  });

  // RMQ Microservice
  // app.connectMicroservice<MicroserviceOptions>({
  //   transport: Transport.RMQ,
  //   options: {
  //     urls: [rmqUrl],
  //     queue: 'payment_queue',
  //     queueOptions: {
  //       durable: true,
  //     },
  //   },
  // });

  // Order matters: DomainError filter runs first (more specific), HttpException filter second
  app.useGlobalFilters(
    new HttpToRpcExceptionFilter(),
    new RpcDomainExceptionFilter(),
  );

  await app.startAllMicroservices();
  
  console.log(`Payment service TCP running on ${tcpHost}:${tcpPort}`);
  console.log(`Payment service RMQ running on queue payment_queue`);
}
bootstrap();
