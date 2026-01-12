import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, type LogLevel } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as bodyParser from 'body-parser';
import { config as dotenvConfig } from 'dotenv';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/logging.interceptor';
import { BigIntSerializationInterceptor } from './common/bigint-serialization.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { AppConfig } from './common/config';
import { validateEnvironment } from './common/env-validation';

// Load .env file before anything else
dotenvConfig();

async function bootstrap() {
  // Validate environment variables before starting the application
  validateEnvironment();
  const env = AppConfig.env();
  const logLevels: LogLevel[] =
    env === 'prod'
      ? ['log', 'warn', 'error']
      : ['log', 'warn', 'error', 'debug', 'verbose'];

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: logLevels,
  });
  app.useLogger(logLevels);
  const logger = new Logger('Bootstrap');

  // Security: helmet for security headers
  app.use(
    helmet({
      // Allow Swagger UI to work
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // Enable CORS for Next.js origin with Authorization header support
  const corsConfig = AppConfig.cors();
  const envName = AppConfig.env();
  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, ok: boolean) => void,
    ) => {
      // Allow non-browser clients (no Origin header)
      if (!origin) return cb(null, true);

      // Allow configured origins
      if (corsConfig.origins.includes(origin)) return cb(null, true);

      // Dev/test convenience: allow LAN devserver origins (Playwright often hits the web app via LAN IP)
      if (envName !== 'prod') {
        const ok =
          /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):3001$/u.test(
            origin,
          );
        if (ok) return cb(null, true);
      }

      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Cookie',
      'x-request-id',
      'x-api-key',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Increase body size limit for large plan commits
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
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
  logger.log(`API listening on port ${port}`);
  logger.log(
    `Swagger documentation available at http://localhost:${port}/docs`,
  );
}
void bootstrap();
