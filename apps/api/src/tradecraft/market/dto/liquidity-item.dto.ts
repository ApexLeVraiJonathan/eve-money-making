import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LiquidityLatestPriceDto {
  @ApiProperty({ example: '1200000' })
  high!: string;

  @ApiProperty({ example: '1000000' })
  low!: string;

  @ApiProperty({ example: '1100000' })
  avg!: string;
}

export class LiquidityItemDto {
  @ApiProperty({ example: 34 })
  typeId!: number;

  @ApiPropertyOptional({ example: 'Tritanium' })
  typeName?: string;

  @ApiPropertyOptional({
    description: 'Optional type volume in m3 when known',
    example: 0.01,
  })
  volumeM3?: number;

  @ApiProperty({ example: 1250 })
  avgDailyAmount!: number;

  @ApiPropertyOptional({
    type: LiquidityLatestPriceDto,
    nullable: true,
  })
  latest!: LiquidityLatestPriceDto | null;

  @ApiProperty({ example: 1375000000 })
  avgDailyIskValue!: number;

  @ApiProperty({ example: 30 })
  coverageDays!: number;

  @ApiProperty({ example: 12 })
  avgDailyTrades!: number;
}

export class LiquidityStationResultDto {
  @ApiProperty({ example: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant' })
  stationName!: string;

  @ApiProperty({ example: 12 })
  totalItems!: number;

  @ApiProperty({ type: [LiquidityItemDto] })
  items!: LiquidityItemDto[];
}
