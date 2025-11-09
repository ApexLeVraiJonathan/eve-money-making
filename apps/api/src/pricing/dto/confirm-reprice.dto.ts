import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmRepriceRequest {
  @ApiProperty({
    description: 'Cycle line ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID()
  lineId: string;

  @ApiProperty({
    description: 'New quantity (0 to mark as sold out)',
    minimum: 0,
    example: 500,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiProperty({
    description: 'New unit price in ISK',
    minimum: 0,
    example: 5.75,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  newUnitPrice: number;
}

