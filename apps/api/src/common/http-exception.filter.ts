import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { reqId?: string }>();
    const reqId = request?.reqId ?? '-';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as unknown;
      // If the body already looks structured, pass through and append reqId
      if (
        body &&
        typeof body === 'object' &&
        !Array.isArray(body) &&
        ('error' in (body as Record<string, unknown>) ||
          'issues' in (body as Record<string, unknown>))
      ) {
        response.status(status).json({ ...body, reqId });
        return;
      }
      const message = exception.message || 'Error';
      response.status(status).json({ error: 'HttpError', message, reqId });
      return;
    }

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = (exception as Error)?.message || 'Internal server error';
    response.status(status).json({ error: 'InternalError', message, reqId });
  }
}
