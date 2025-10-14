import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Global interceptor to automatically serialize BigInt and Prisma Decimal types to strings
 * for JSON responses. This prevents "Do not know how to serialize a BigInt" errors.
 *
 * Applied globally in main.ts via app.useGlobalInterceptors()
 */
@Injectable()
export class BigIntSerializationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.serialize(data)));
  }

  private serialize(data: any): any {
    // Handle null/undefined
    if (data === null || data === undefined) {
      return data;
    }

    // Handle BigInt
    if (typeof data === 'bigint') {
      return data.toString();
    }

    // Handle Prisma Decimal
    if (data instanceof Decimal) {
      return data.toString();
    }

    // Handle Date (keep as-is, will be serialized by JSON.stringify)
    if (data instanceof Date) {
      return data;
    }

    // Handle Arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.serialize(item));
    }

    // Handle Objects (plain objects and class instances)
    if (typeof data === 'object') {
      const serialized: any = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          serialized[key] = this.serialize(data[key]);
        }
      }
      return serialized;
    }

    // Primitive types (string, number, boolean)
    return data;
  }
}
