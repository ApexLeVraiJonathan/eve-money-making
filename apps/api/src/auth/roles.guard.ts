import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY, AppRole } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    // Simple role propagation: from header `x-test-role` for tests; extend later to real auth
    const role = (
      req.headers['x-test-role'] as string | undefined
    )?.toUpperCase() as AppRole | undefined;
    if (!role) throw new ForbiddenException('Missing role');
    if (!required.includes(role)) throw new ForbiddenException('Forbidden');
    return true;
  }
}
