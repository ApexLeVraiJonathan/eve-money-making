import type { NestMiddleware } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

function generateRequestId(): string {
  try {
    const maybe = (crypto as unknown as { randomUUID?: () => string })
      .randomUUID;
    if (typeof maybe === 'function') return maybe();
  } catch {
    // ignore
  }
  return crypto.randomBytes(16).toString('hex');
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const headerId =
      typeof req.get === 'function' ? req.get('x-request-id') : undefined;
    const candidate =
      headerId && headerId.trim().length > 0 ? headerId : undefined;
    const id = candidate ?? generateRequestId();
    (req as Request & { reqId?: string }).reqId = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
