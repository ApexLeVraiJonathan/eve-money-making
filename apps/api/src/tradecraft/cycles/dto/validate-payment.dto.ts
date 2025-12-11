import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, ValidateNested, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

class WalletJournalValidation {
  @ApiPropertyOptional({
    description: 'Character ID',
    example: 2112000000,
    type: 'integer',
  })
  @Type(() => Number)
  @IsInt()
  characterId!: number;

  @ApiPropertyOptional({
    description: 'Journal ID',
    example: '12345678901234567890',
  })
  @Type(() => BigInt)
  @IsDefined()
  journalId!: bigint;
}

export class ValidatePaymentRequest {
  @ApiPropertyOptional({
    description: 'Wallet journal reference for validation',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WalletJournalValidation)
  walletJournal?: WalletJournalValidation;
}
