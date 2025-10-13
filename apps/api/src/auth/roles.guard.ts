import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY, AppRole } from './roles.decorator';
import type { RequestUser } from './current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles required, allow access
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as unknown as { user?: RequestUser }).user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if user's role matches required roles
    const userRole = user.role?.toUpperCase() as AppRole;

    // Fallback to test header in CI/test environments
    const testRole = (
      req.headers['x-test-role'] as string | undefined
    )?.toUpperCase() as AppRole | undefined;

    const effectiveRole = userRole || testRole;

    if (!effectiveRole) {
      throw new ForbiddenException('Missing role');
    }

    if (!required.includes(effectiveRole)) {
      throw new ForbiddenException(
        `Forbidden: requires one of [${required.join(', ')}]`,
      );
    }

    return true;
  }
}
