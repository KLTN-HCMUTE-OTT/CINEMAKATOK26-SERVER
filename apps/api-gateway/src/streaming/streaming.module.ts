import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { StreamingController } from './streaming.controller';
import { StreamingGatewayService } from './streaming.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'STREAMING_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.STREAMING_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.STREAMING_SERVICE_PORT ?? 3006),
        },
      },
    ]),
  ],
  controllers: [StreamingController],
  providers: [StreamingGatewayService],
  exports: [StreamingGatewayService],
})
export class StreamingModule {}
