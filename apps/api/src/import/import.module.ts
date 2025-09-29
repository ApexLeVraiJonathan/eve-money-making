import { Module, Logger } from '@nestjs/common';
import { ImportService } from './import.service';
import { DataImportModule } from '@shared/data-import';
import { ImportController } from './import.controller';

@Module({
  providers: [ImportService, Logger],
  imports: [DataImportModule],
  controllers: [ImportController],
})
export class ImportModule {}
