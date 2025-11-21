import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CharactersModule } from '../characters/characters.module';
import { ParameterProfilesService } from './parameter-profiles.service';
import { ParameterProfilesController } from './parameter-profiles.controller';

@Module({
  imports: [PrismaModule, CharactersModule],
  providers: [ParameterProfilesService],
  controllers: [ParameterProfilesController],
  exports: [ParameterProfilesService],
})
export class ParameterProfilesModule {}

