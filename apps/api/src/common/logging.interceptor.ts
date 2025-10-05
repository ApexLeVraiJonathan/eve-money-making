import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { reqId?: string }>();
    const method = req.method ?? '-';
    const url = req.url ?? '-';
    const reqId = req.reqId ?? '-';
    const started = Date.now();
    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const ms = Date.now() - started;
        const status = res.statusCode ?? 0;
        const logger = new Logger('HTTP');
        logger.log(`[reqId=${reqId}] ${method} ${url} -> ${status} ${ms}ms`);
      }),
    );
  }
}
