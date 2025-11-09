import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class LinkCharacterRequest {
  @ApiProperty({
    description: 'Character ID to link',
    example: 2112000000,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  characterId!: number;
}

