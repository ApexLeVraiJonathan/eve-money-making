import { Module } from '@nestjs/common';
import { DataImportService } from './data-import.service';

@Module({
  providers: [DataImportService],
  exports: [DataImportService],
})
export class DataImportModule {}
