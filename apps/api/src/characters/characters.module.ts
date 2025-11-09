import { Module, Logger } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { EsiModule } from '../esi/esi.module';
import { AppConfig } from '../common/config';

// Services
import { CharacterService } from './services/character.service';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { TokenService } from './services/token.service';
import { EsiTokenService } from './services/esi-token.service';

// Controllers
import { AuthController } from './auth.controller';
import { UsersController } from './users.controller';

// Guards & Strategy
import { EveJwtStrategy } from './guards/jwt.strategy';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PrismaModule,
    EsiModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: AppConfig.jwt().secret,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    // Services
    CharacterService,
    AuthService,
    UserService,
    TokenService,
    EsiTokenService,
    // Guards & Strategy
    EveJwtStrategy,
    AuthGuard,
    RolesGuard,
    Logger,
  ],
  controllers: [AuthController, UsersController],
  exports: [
    CharacterService,
    AuthService,
    UserService,
    TokenService,
    EsiTokenService,
    EveJwtStrategy,
    AuthGuard,
    RolesGuard,
  ],
})
export class CharactersModule {}
