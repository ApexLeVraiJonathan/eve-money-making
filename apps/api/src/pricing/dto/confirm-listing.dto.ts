import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmListingRequest {
  @ApiProperty({
    description: 'Cycle line ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID()
  lineId: string;

  @ApiProperty({
    description: 'Quantity listed',
    minimum: 1,
    example: 1000,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Unit price in ISK',
    minimum: 0,
    example: 5.50,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  unitPrice: number;
}

