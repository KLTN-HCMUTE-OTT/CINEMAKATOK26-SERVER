import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { WatchProgressController } from './controllers/watch-progress.controller';
import { WatchProgressService } from './services/watch-progress.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_ACTIVITY_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.USER_ACTIVITY_SERVICE_HOST ?? 'localhost',
          port: Number(process.env.USER_ACTIVITY_SERVICE_PORT ?? 3007),
        },
      },
    ]),
  ],
  controllers: [WatchProgressController],
  providers: [WatchProgressService],
  exports: [WatchProgressService],
})
export class UserActivityModule {}
