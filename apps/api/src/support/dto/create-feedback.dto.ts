import {
  IsString,
  IsOptional,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiProperty({
    description: 'Type of feedback',
    example: 'bug',
  })
  @IsString()
  @MaxLength(50)
  feedbackType: string;

  @ApiProperty({
    description: 'Brief summary of the feedback',
    example: 'Navigation menu is confusing',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  subject: string;

  @ApiProperty({
    description: 'Detailed feedback message',
    example: 'I think the navigation menu could be improved by...',
    maxLength: 2000,
  })
  @IsString()
  @MaxLength(2000)
  message: string;

  @ApiProperty({
    description: 'Optional rating (1-5 stars)',
    required: false,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;
}
