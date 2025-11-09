import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Enhanced HTTP request/response logging interceptor
 * 
 * Features:
 * - Request timing (ms)
 * - User ID tracking (when authenticated)
 * - Request ID correlation
 * - Slow request warnings (>500ms)
 * - Sensitive field masking
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly slowRequestThreshold = 500; // ms

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { reqId?: string; user?: { userId: string } }>();
    
    const method = req.method ?? '-';
    const url = this.sanitizeUrl(req.url ?? '-');
    const reqId = req.reqId ?? '-';
    const userId = req.user?.userId ?? '-';
    const started = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const ms = Date.now() - started;
        const status = res.statusCode ?? 0;

        // Build log message
        const userInfo = userId !== '-' ? ` user=${userId}` : '';
        const message = `[${reqId}] ${method} ${url} -> ${status} ${ms}ms${userInfo}`;

        // Log at appropriate level
        if (status >= 500) {
          this.logger.error(message);
        } else if (status >= 400) {
          this.logger.warn(message);
        } else if (ms > this.slowRequestThreshold) {
          this.logger.warn(`[SLOW] ${message}`);
        } else {
          this.logger.log(message);
        }
      }),
    );
  }

  /**
   * Remove sensitive data from URLs (tokens, passwords, etc.)
   */
  private sanitizeUrl(url: string): string {
    // Mask JWT tokens in query params
    let sanitized = url.replace(/([?&]token=)[^&]*/gi, '$1[REDACTED]');
    
    // Mask passwords in query params
    sanitized = sanitized.replace(/([?&]password=)[^&]*/gi, '$1[REDACTED]');
    
    // Mask API keys in query params
    sanitized = sanitized.replace(/([?&]apiKey=)[^&]*/gi, '$1[REDACTED]');
    sanitized = sanitized.replace(/([?&]api_key=)[^&]*/gi, '$1[REDACTED]');
    
    return sanitized;
  }
}
