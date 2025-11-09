import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@eve/prisma';
import { AppConfig } from '../common/config';

/**
 * Prisma database service with slow query logging
 * 
 * Features:
 * - Connection lifecycle management
 * - Slow query logging (>500ms in dev)
 * - Query event monitoring
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly isDev = process.env.NODE_ENV !== 'production';
  private readonly slowQueryThreshold = 500; // ms

  constructor() {
    const url = AppConfig.databaseUrl();
    super({ 
      datasources: url ? { db: { url } } : undefined,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Enable slow query logging in development
    if (this.isDev) {
      this.$on('query' as never, (e: any) => {
        const duration = e.duration as number;
        const query = e.query as string;
        const params = e.params as string;

        if (duration > this.slowQueryThreshold) {
          this.logger.warn(
            `[SLOW QUERY] ${duration}ms - ${this.sanitizeQuery(query)} - Params: ${params}`,
          );
        }
      });

      this.$on('error' as never, (e: any) => {
        this.logger.error(`Prisma error: ${e.message}`);
      });

      this.logger.log('Slow query logging enabled (threshold: 500ms)');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Sanitize query for logging (truncate long queries)
   */
  private sanitizeQuery(query: string): string {
    const maxLength = 200;
    if (query.length <= maxLength) return query;
    return query.substring(0, maxLength) + '...';
  }
}
