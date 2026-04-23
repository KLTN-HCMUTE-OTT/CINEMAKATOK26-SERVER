import { NestFactory } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  HttpResponseInterceptor,
  HttpLoggingInterceptor,
} from '@app/common/interceptors';
import { GatewayExceptionFilter } from './filters/gateway-exception.filter';
import { Reflector } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const defaultClientOrigins = [
    'http://localhost:3001',
    'http://localhost:3010',
    'http://localhost:3011',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3010',
    'http://127.0.0.1:3011',
    'http://localhost:3000',
    'http://localhost:3003',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3003',
  ];

  const configuredOrigins = (process.env.CLIENT_ORIGIN ?? '')
    .split(',')
    .map((origin) =>
      origin
        .trim()
        .replace(/^['\"]|['\"]$/g, '')
        .replace(/\/$/, ''),
    )
    .filter(Boolean);

  const allowedOrigins = Array.from(
    new Set([...defaultClientOrigins, ...configuredOrigins]),
  );

  // CORS — allow Next.js frontend
  app.enableCors({
    origin: (origin, callback) => {
      // Allow tools like Postman/curl that don't send Origin.
      const normalizedOrigin = origin?.replace(/\/$/, '');

      if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global interceptors
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    HttpLoggingInterceptor({ logLevel: 'log' }),
    new HttpResponseInterceptor(),
  );

  // Global filters — handles both HttpException and RpcException (TCP microservice errors)
  app.useGlobalFilters(new GatewayExceptionFilter());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('CinemaKatoK API Gateway')
    .setDescription(
      'OTT Platform API — single entry point for all client requests',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Auth', 'Authentication & token management')
    .addTag('Users', 'User profile management')
    .addTag('Content', 'Movies & episodes catalogue')
    .addTag('Orders', 'Subscription orders')
    .addTag('Payments', 'Payment processing')
    .addTag('Streaming', 'Video streaming URLs')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API Gateway running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
