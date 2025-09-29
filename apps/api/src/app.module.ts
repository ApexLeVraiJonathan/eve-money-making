import { Module, Logger } from '@nestjs/common';
import { ImportModule } from './import/import.module';
import { PrismaModule } from './prisma/prisma.module';
import { DataImportModule } from '@shared/data-import';

@Module({
  imports: [ImportModule, PrismaModule, DataImportModule],
  controllers: [],
  providers: [Logger],
})
export class AppModule {}
