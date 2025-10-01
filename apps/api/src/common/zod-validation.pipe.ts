import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema, ZodError } from 'zod';

/**
 * Validates and coerces request bodies using a Zod schema.
 *
 * Why: Centralizing validation keeps controllers thin and ensures
 * consistent error shapes. Zod can coerce strings from JSON into
 * numbers/booleans safely and give useful messages.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  async transform(value: unknown): Promise<unknown> {
    try {
      // parseAsync supports refinements and async transforms
      return await this.schema.parseAsync(value);
    } catch (err: unknown) {
      const zerr = err as ZodError | undefined;
      // Expose a compact problem summary to the client
      const issues = zerr?.issues?.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      throw new BadRequestException({ error: 'ValidationError', issues });
    }
  }
}
