import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsString, Matches, ValidateNested } from 'class-validator';

class FeeItem {
  @ApiProperty({
    description: 'Cycle line ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  lineId: string;

  @ApiProperty({
    description: 'Fee amount in ISK (format: XXXXX.XX)',
    example: '50000.00',
    pattern: '^\\d+\\.\\d{2}$',
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: 'amountIsk must be in format XXXXX.XX',
  })
  amountIsk: string;
}

export class AddBulkBrokerFeesRequest {
  @ApiProperty({
    description: 'Array of broker fees to add',
    type: [FeeItem],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeItem)
  fees: FeeItem[];
}

export class AddBulkRelistFeesRequest {
  @ApiProperty({
    description: 'Array of relist fees to add',
    type: [FeeItem],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeItem)
  fees: FeeItem[];
}
