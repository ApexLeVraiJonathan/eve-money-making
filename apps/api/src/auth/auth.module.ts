import { Module, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { EsiModule } from '../esi/esi.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RolesGuard } from './roles.guard';
import { EveAuthGuard } from './eve-auth.guard';
import { EveJwtStrategy } from './jwt.strategy';
import { EsiTokenService } from './esi-token.service';

@Module({
  imports: [PassportModule, PrismaModule, EsiModule],
  providers: [
    AuthService,
    EveJwtStrategy,
    EsiTokenService,
    Logger,
    { provide: APP_GUARD, useClass: EveAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  controllers: [AuthController],
  exports: [EsiTokenService],
})
export class AuthModule {}
