import { Module } from '@nestjs/common';
import { TrackedStationsService } from './tracked-stations.service';
import { TrackedStationsController } from './tracked-stations.controller';

@Module({
  controllers: [TrackedStationsController],
  providers: [TrackedStationsService],
})
export class TrackedStationsModule {}
