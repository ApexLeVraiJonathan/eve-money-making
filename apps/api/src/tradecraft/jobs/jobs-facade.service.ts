import { Injectable } from '@nestjs/common';
import { CleanupRunner } from './cleanup.runner';
import { TradeStalenessService } from './trade-staleness.service';
import { WalletImportsRunner } from './wallet-imports.runner';
import { SystemTokensRefresher } from './system-tokens.refresher';

@Injectable()
export class JobsFacadeService {
  constructor(
    private readonly cleanup: CleanupRunner,
    private readonly staleness: TradeStalenessService,
    private readonly wallets: WalletImportsRunner,
    private readonly systemTokens: SystemTokensRefresher,
  ) {}

  cleanupExpiredEsiCache() {
    return this.cleanup.cleanupExpiredEsiCache();
  }

  cleanupExpiredOAuthStates() {
    return this.cleanup.cleanupExpiredOAuthStates();
  }

  cleanupWalletJournals() {
    return this.cleanup.cleanupWalletJournals();
  }

  backfillMissingTrades(daysBack: number) {
    return this.staleness.backfillMissingTrades(daysBack);
  }

  executeWalletImportsAndAllocation() {
    return this.wallets.executeWalletImportsAndAllocation();
  }

  refreshSystemCharacterTokens() {
    return this.systemTokens.refreshSystemCharacterTokens();
  }
}
