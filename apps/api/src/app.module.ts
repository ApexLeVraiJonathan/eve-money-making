import { Module, Logger } from '@nestjs/common';
import { ImportModule } from './import/import.module';
import { PrismaModule } from './prisma/prisma.module';
import { DataImportModule } from '@shared/data-import';
import { TrackedStationsModule } from './tracked-stations/tracked-stations.module';

@Module({
  imports: [
    ImportModule,
    PrismaModule,
    DataImportModule,
    TrackedStationsModule,
  ],
  controllers: [],
  providers: [Logger],
})
export class AppModule {}
