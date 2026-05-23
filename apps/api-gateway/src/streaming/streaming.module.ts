import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { StreamingController } from './streaming.controller';
import { DrmController } from './drm.controller';
import { StreamingGatewayService } from './streaming.service';
import { EntitlementGuard } from './guards/entitlement.guard';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'STREAMING_SERVICE',
        imports: [ConfigModule],
        useFactory: (cs: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: cs.get('STREAMING_SERVICE_HOST') ?? 'localhost',
            port: Number(cs.get('STREAMING_SERVICE_PORT') ?? 3006),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'ORDER_SERVICE',
        imports: [ConfigModule],
        useFactory: (cs: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: cs.get('ORDER_SERVICE_HOST') ?? 'localhost',
            port: Number(cs.get('ORDER_SERVICE_PORT') ?? 3004),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'CONTENT_SERVICE',
        imports: [ConfigModule],
        useFactory: (cs: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: cs.get('CONTENT_SERVICE_HOST') ?? 'localhost',
            port: Number(cs.get('CONTENT_SERVICE_PORT') ?? 3003),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [StreamingController, DrmController],
  providers: [StreamingGatewayService, EntitlementGuard],
  exports: [StreamingGatewayService, EntitlementGuard],
})
export class StreamingModule {}
