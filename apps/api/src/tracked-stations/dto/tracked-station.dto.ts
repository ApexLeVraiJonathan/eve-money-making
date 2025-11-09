import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TrackedStationCreate {
  @ApiProperty({
    description: 'EVE Online station ID',
    example: 60003760,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stationId: number;
}

