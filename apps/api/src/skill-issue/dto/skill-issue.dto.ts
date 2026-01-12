import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class SkillIssueAnalyzeDto {
  @ApiProperty({
    description: 'One of the user’s linked EVE character IDs',
    example: 123456789,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  characterId!: number;

  @ApiProperty({
    description: 'EFT-format fit text',
    example:
      '[Gila, Abyss]\n\nRapid Light Missile Launcher II, Caldari Navy Scourge Light Missile\nMedium Shield Extender II',
  })
  @IsString()
  eft!: string;
}
