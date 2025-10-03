import { Controller, Get, Query } from '@nestjs/common';
import { WalletService } from './wallet.service';

@Controller('wallet-import')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('character')
  async importCharacter(@Query('characterId') characterId: string) {
    const id = Number(characterId);
    return await this.wallet.importForCharacter(id);
  }

  @Get('transactions')
  async listTransactions(@Query('characterId') characterId?: string) {
    const id = characterId ? Number(characterId) : undefined;
    // Simple recent window
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    return await this.wallet.listTransactions(id, since);
  }

  @Get('journal')
  async listJournal(@Query('characterId') characterId?: string) {
    const id = characterId ? Number(characterId) : undefined;
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    return await this.wallet.listJournal(id, since);
  }

  @Get('all')
  async importAll() {
    return await this.wallet.importAllLinked();
  }
}
