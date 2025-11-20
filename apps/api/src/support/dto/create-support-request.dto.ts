import { IsString, IsOptional, MaxLength, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupportRequestDto {
  @ApiProperty({
    description: 'Support request category',
    example: 'technical',
  })
  @IsString()
  @MaxLength(50)
  category: string;

  @ApiProperty({
    description: 'Brief description of the issue',
    example: 'Cannot access my account',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  subject: string;

  @ApiProperty({
    description: 'Detailed description of the issue',
    example: 'I have been trying to log in for the past hour...',
    maxLength: 2000,
  })
  @IsString()
  @MaxLength(2000)
  description: string;

  @ApiProperty({
    description: 'Optional technical context (page URL, user agent)',
    required: false,
  })
  @IsOptional()
  @IsObject()
  context?: {
    url?: string;
    userAgent?: string;
  };
}
