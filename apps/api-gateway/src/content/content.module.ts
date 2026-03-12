import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CONTENT_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.CONTENT_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.CONTENT_SERVICE_PORT ?? 3003),
        },
      },
    ]),
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
