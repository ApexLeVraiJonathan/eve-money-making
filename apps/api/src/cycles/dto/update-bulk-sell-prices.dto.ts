import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsString, Matches, ValidateNested } from 'class-validator';

class SellPriceUpdate {
  @ApiProperty({
    description: 'Cycle line ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  lineId: string;

  @ApiProperty({
    description: 'Current sell price in ISK (format: XXXXX.XX)',
    example: '50000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'currentSellPriceIsk must be in format XXXXX.XX',
  })
  currentSellPriceIsk: string;
}

export class UpdateBulkSellPricesRequest {
  @ApiProperty({
    description: 'Array of price updates',
    type: [SellPriceUpdate],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SellPriceUpdate)
  updates: SellPriceUpdate[];
}

