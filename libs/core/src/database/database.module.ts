import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

export type DatabaseServiceName =
  | 'auth'
  | 'user'
  | 'order'
  | 'content'
  | 'activity'
  | 'audit';

export interface DatabaseModuleOptions {
  service: DatabaseServiceName;
  global?: boolean;
}

@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    const { service, global = true } = options;
    const prefix = service.toUpperCase(); // 'auth' → 'AUTH'

    return {
      module: DatabaseModule,
      global,
      imports: [
        TypeOrmModule.forRootAsync({
          name: service,
          useFactory: (config: ConfigService) => {
            const get = <T>(key: string, fallback: T): T =>
              config.get<T>(`${prefix}_${key}`) ?? fallback;

            const sslEnabled = get<boolean>('DB_SSL_ENABLED', false); 

            return {
              name: service,
              type: get('DB_TYPE', 'postgres') as 'postgres',
              host: get<string>('DB_HOST', 'localhost'),
              port: get<number>('DB_PORT', 5432),
              username: get<string>('DB_USERNAME', ''),
              password: get<string>('DB_PASSWORD', ''),
              database: get<string>('DB_NAME', ''),
              synchronize: get<boolean>('DB_SYNCHRONIZE', false),
              autoLoadEntities: true,
              ssl: sslEnabled
                ? {
                    rejectUnauthorized: get<boolean>(
                      'DB_SSL_REJECT_UNAUTHORIZED',
                      false,
                    ),
                    ca: get<string>('DB_CA_CERTIFICATE', ''),
                  }
                : false,
              extra: {
                max: get<number>('DB_POOL_MAX', 10),
                min: get<number>('DB_POOL_MIN', 2),
                idleTimeoutMillis: get<number>('DB_POOL_IDLE_TIMEOUT_MS', 30000),
                connectTimeoutMillis: get<number>(
                  'DB_POOL_CONNECT_TIMEOUT_MS',
                  5000,
                ),
              },
            };
          },
          inject: [ConfigService],
        }),
      ],
      exports: [TypeOrmModule],
    };
  }
}