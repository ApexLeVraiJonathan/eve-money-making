import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type RequestUser = {
  characterId: number;
  ownerHash: string;
  name: string;
  userId: string | null;
  role: string;
  primaryCharacterId: number | null;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | null => {
    const req = ctx.switchToHttp().getRequest();
    return req?.user ?? null;
  },
);
