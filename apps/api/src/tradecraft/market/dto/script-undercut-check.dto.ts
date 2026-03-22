import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { UndercutCheckRequest } from './undercut-check.dto';

export class ScriptUndercutCheckRequest extends UndercutCheckRequest {
  @ApiPropertyOptional({
    description: 'Max characters accepted by the in-app filter input.',
    example: 37,
    default: 37,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(128)
  filterMaxChars?: number;

  @ApiPropertyOptional({
    description:
      'Normalize item names before match (trim + collapse whitespace).',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  normalizeFilterText?: boolean;

  @ApiPropertyOptional({
    description: 'Force lowercase filter matching for deterministic targeting.',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  filterForceLowercase?: boolean;

  @ApiPropertyOptional({
    description: 'Strip quotes during filter normalization.',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  filterStripQuotes?: boolean;
}
