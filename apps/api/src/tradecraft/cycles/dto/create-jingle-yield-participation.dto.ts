import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Admin-only request to create a JingleYield participation for a user.
 *
 * This seeds a 2B ISK admin-funded principal in a planned cycle and
 * links it to a JingleYieldProgram for lifecycle tracking.
 */
export class CreateJingleYieldParticipationRequest {
  @ApiProperty({
    description: 'User ID that will receive the JingleYield participation',
    example: 'user-uuid-here',
  })
  @IsString()
  @MinLength(1)
  userId!: string;

  @ApiProperty({
    description:
      'Planned cycle ID where the initial 2B participation will be created',
    example: 'cycle-uuid-here',
  })
  @IsString()
  @MinLength(1)
  cycleId!: string;

  @ApiProperty({
    description:
      'Admin EVE character ID that is funding the 2B principal (wallet sender)',
    example: 123456789,
  })
  @IsNumber()
  adminCharacterId!: number;

  @ApiProperty({
    description:
      'Display character name for the participation (usually the investor character)',
    example: 'New Investor',
  })
  @IsString()
  @MinLength(1)
  characterName!: string;

  @ApiProperty({
    description:
      'Seeded principal amount in ISK for this JingleYield program. Defaults to 2,000,000,000.00 ISK when omitted.',
    example: '2000000000.00',
    required: false,
  })
  @IsOptional()
  @IsString()
  principalIsk?: string;

  @ApiProperty({
    description:
      'Minimum number of cycles before the locked principal can be repaid. Defaults to 12 when omitted.',
    example: 12,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  minCycles?: number;
}
