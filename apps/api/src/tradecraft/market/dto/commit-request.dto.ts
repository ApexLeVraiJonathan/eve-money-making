import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, Allow } from 'class-validator';

export class PlanCommitRequest {
  @ApiProperty({
    description: 'Original plan request payload',
    type: Object,
  })
  @Allow()
  request: unknown;

  @ApiProperty({
    description: 'Plan result from the packager',
    type: Object,
  })
  @Allow()
  result: unknown;

  @ApiPropertyOptional({
    description: 'Optional memo about this commit',
    maxLength: 500,
    example: 'Q4 2024 arbitrage commit',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;
}
