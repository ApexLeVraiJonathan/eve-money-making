import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsArray, IsString, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class SellAppraiseRequest {
  @ApiProperty({
    description: 'Destination station ID',
    example: 60003760,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinationStationId: number;

  @ApiProperty({
    description: 'Array of item lines to appraise',
    example: ['Tritanium x1000', 'Pyerite x500'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  lines: string[];
}

