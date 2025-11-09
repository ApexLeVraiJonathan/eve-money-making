import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Standardized API error response format
 */
export interface ApiErrorResponse {
  /** HTTP status code */
  statusCode: number;
  /** Error type (e.g., "BadRequest", "NotFound", "InternalError") */
  error: string;
  /** Human-readable error message */
  message: string;
  /** Request ID for tracking */
  requestId?: string;
  /** Timestamp when error occurred */
  timestamp: string;
  /** Request path that caused the error */
  path: string;
  /** Additional error details (validation errors, stack trace in dev, etc.) */
  details?: unknown;
}

/**
 * Global exception filter that returns standardized ApiError responses
 * and logs errors with appropriate detail levels.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isDev = process.env.NODE_ENV !== 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { reqId?: string; user?: { userId: string } }>();

    const requestId = request?.reqId ?? '-';
    const path = request?.url ?? '/';
    const userId = request?.user?.userId;

    let status: number;
    let error: string;
    let message: string;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        error = exception.name;
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        error = (resp.error as string) ?? exception.name;
        message = (resp.message as string) ?? exception.message;
        details = resp.details ?? resp.validation ?? resp.issues;
      } else {
        error = exception.name;
        message = exception.message;
      }

      // Log client errors (4xx) at warn level, server errors (5xx) at error level
      if (status >= 500) {
        this.logger.error(
          `[${requestId}] ${status} ${request.method} ${path} - ${message}`,
          exception.stack,
        );
      } else if (status >= 400 && status !== 401 && status !== 404) {
        // Don't log 401/404 to reduce noise
        this.logger.warn(
          `[${requestId}] ${status} ${request.method} ${path} - ${message}${userId ? ` (user: ${userId})` : ''}`,
        );
      }
    } else {
      // Unhandled exception
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'InternalError';
      message = this.isDev
        ? (exception as Error)?.message ?? 'Internal server error'
        : 'Internal server error';

      // Always log unhandled exceptions
      this.logger.error(
        `[${requestId}] ${status} ${request.method} ${path} - Unhandled exception${userId ? ` (user: ${userId})` : ''}`,
        exception instanceof Error ? exception.stack : String(exception),
      );

      // In development, include stack trace in response
      if (this.isDev && exception instanceof Error) {
        details = {
          stack: exception.stack?.split('\n').map((line) => line.trim()),
        };
      }
    }

    const errorResponse: ApiErrorResponse = {
      statusCode: status,
      error,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path,
      ...(details && { details }),
    };

    response.status(status).json(errorResponse);
  }
}
