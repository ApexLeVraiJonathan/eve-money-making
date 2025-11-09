import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsObject } from 'class-validator';

export class PlanCommitRequest {
  @ApiPropertyOptional({
    description: 'Optional memo about this commit',
    maxLength: 500,
    example: 'Q4 2024 arbitrage commit',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;

  @ApiProperty({
    description: 'Original plan request data',
    example: {},
  })
  @IsObject()
  request: unknown;

  @ApiProperty({
    description: 'Plan result data',
    example: {},
  })
  @IsObject()
  result: unknown;
}
