import * as config from 'config';

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: config.get('core.database.host'),
      port: config.get('core.database.port'),
      username: config.get('core.database.username'),
      password: config.get('core.database.password'),
      database: config.get('core.database.dbName'),
      synchronize: true,
      autoLoadEntities: true,
      ssl: {
        rejectUnauthorized: false,
        ca: config.get('core.database.caCertificate'),
      },
      extra: config.has('core.database.extra')
        ? config.get('core.database.extra')
        : {
            connectionLimit: config.has('core.database.extra.connectionLimit')
              ? config.get<number>('core.database.extra.connectionLimit')
              : 100,
            idleTimeoutMillis: config.has('core.database.extra.idleTimeoutMillis')
              ? config.get<number>('core.database.extra.idleTimeoutMillis')
              : 20000,
            connectTimeoutMillis: config.has('core.database.extra.connectTimeoutMillis')
              ? config.get<number>('core.database.extra.connectTimeoutMillis')
              : 2000,
          },
    }),
  ],
  exports: [],
})
export class DatabaseModule {
  static forRoot() {
    return {
      module: DatabaseModule,
      global: true,
    };
  }
}
