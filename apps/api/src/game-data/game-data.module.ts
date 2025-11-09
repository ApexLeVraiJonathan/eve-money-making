import { Module } from '@nestjs/common';
import { GameDataService } from './game-data.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [GameDataService],
  exports: [GameDataService],
})
export class GameDataModule {}
