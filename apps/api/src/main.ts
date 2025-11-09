import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/logging.interceptor';
import { BigIntSerializationInterceptor } from './common/bigint-serialization.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { AppConfig } from './common/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Enable CORS for Next.js origin with Authorization header support
  const corsConfig = AppConfig.cors();
  app.enableCors({
    origin: corsConfig.origins,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'Cookie', 'x-request-id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.use(cookieParser());
  app.useGlobalInterceptors(
    new BigIntSerializationInterceptor(), // Must be first to serialize before logging
    new LoggingInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Automatically convert types (e.g., string to number)
      },
    }),
  );

  // Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('EVE Money Making API')
    .setDescription(
      'API for EVE Online arbitrage tracking and profit optimization',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('arbitrage', 'Arbitrage cycle and commitment endpoints')
    .addTag('ledger', 'Financial ledger and participation tracking')
    .addTag('liquidity', 'Liquidity management')
    .addTag('packages', 'Package tracking and management')
    .addTag('pricing', 'Market pricing and appraisal')
    .addTag('auth', 'Authentication and user management')
    .addTag('wallet', 'Wallet import and transaction tracking')
    .addTag('admin', 'Administrative endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = AppConfig.port();
  await app.listen(port);
  logger.log(`API listening on port ${port}`, 'Bootstrap');
  logger.log(
    `Swagger documentation available at http://localhost:${port}/docs`,
    'Bootstrap',
  );
}
void bootstrap();
