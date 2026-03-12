import { Module } from '@nestjs/common';
import { getConfig } from '@app/common/utils/get-config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: getConfig('core.database.host', ''),
      port: getConfig('core.database.port', 5432),
      username: getConfig('core.database.username', ''),
      password: getConfig('core.database.password', ''),
      database: getConfig('core.database.dbName', ''),
      synchronize: true,
      autoLoadEntities: true,
      // ssl: {
      //   rejectUnauthorized: false,
      //   ca: getConfig('core.database.caCertificate', ''),
      // },
      extra: {
        max: getConfig('core.database.extra.max', 100),
        min: getConfig('core.database.extra.min', 1),
        connectionLimit: getConfig('core.database.extra.connectionLimit', 100),
        idleTimeoutMillis: getConfig('core.database.extra.idleTimeoutMillis', 20000),
        connectTimeoutMillis: getConfig('core.database.extra.connectTimeoutMillis', 2000),
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
