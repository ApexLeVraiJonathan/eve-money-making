import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCycleLineRequest {
  @ApiProperty({
    description: 'Type ID',
    example: 34,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  typeId: number;

  @ApiProperty({
    description: 'Planned units',
    minimum: 1,
    example: 1000,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  plannedUnits: number;

  @ApiProperty({
    description: 'Unit cost in ISK',
    minimum: 0,
    example: 5.5,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost: number;

  @ApiProperty({
    description: 'Expected sell price in ISK',
    minimum: 0,
    example: 6.75,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedSellPrice: number;

  @ApiPropertyOptional({
    description: 'Destination station ID',
    example: 60003760,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinationStationId?: number;
}
