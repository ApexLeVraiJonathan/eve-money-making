import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCycleLineManualRequest {
  @ApiProperty({
    description: 'Type ID',
    example: 34,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  typeId!: number;

  @ApiProperty({
    description: 'Destination station ID',
    example: 60003760,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  destinationStationId!: number;

  @ApiProperty({
    description: 'Planned units',
    minimum: 1,
    example: 1000,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  plannedUnits!: number;
}

