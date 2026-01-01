import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BackfillJingleYieldRolloversRequestDto {
  @ApiPropertyOptional({
    description:
      'Optional: explicitly specify the COMPLETED source cycle to roll over from. If omitted, the API will infer the most recent completed cycle prior to the target cycle.',
  })
  @IsOptional()
  @IsString()
  sourceClosedCycleId?: string;
}


