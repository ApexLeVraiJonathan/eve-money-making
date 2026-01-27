import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';

@Injectable()
export class CleanupRunner {
  private readonly logger = new Logger(CleanupRunner.name);

  constructor(private readonly prisma: PrismaService) {}

  async cleanupExpiredEsiCache(): Promise<{ deleted: number }> {
    const now = new Date();
    const res = await this.prisma.esiCacheEntry.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    this.logger.log(`ESI cache cleanup: deleted=${res.count}`);
    return { deleted: res.count };
  }

  async cleanupExpiredOAuthStates(): Promise<{ deleted: number }> {
    const now = new Date();
    const res = await this.prisma.oAuthState.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    this.logger.log(`OAuth state cleanup: deleted=${res.count}`);
    return { deleted: res.count };
  }

  async cleanupWalletJournals(): Promise<{ deleted: number }> {
    const res = await this.prisma.walletJournalEntry.deleteMany({});
    this.logger.log(`Wallet journal cleanup: deleted=${res.count}`);
    return { deleted: res.count };
  }
}
