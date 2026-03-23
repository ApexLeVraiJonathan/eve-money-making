import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ScriptRunReportRequest {
  @ApiProperty({
    description: 'Target user ID for DM alert.',
    example: 'clx123abc456def',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Overall run status.',
    enum: ['success', 'failure', 'late'],
    example: 'success',
  })
  @IsIn(['success', 'failure', 'late'])
  status: 'success' | 'failure' | 'late';

  @ApiPropertyOptional({
    description: 'Optional run label (location/account/mode).',
    example: 'scheduled-all-locations',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @ApiPropertyOptional({
    description: 'Lines rendered in the notification body.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lines?: string[];
}
