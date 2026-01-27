import { Injectable, Logger } from '@nestjs/common';
import { CharacterService } from '@api/characters/services/character.service';
import { EsiTokenService } from '@api/characters/services/esi-token.service';

@Injectable()
export class SystemTokensRefresher {
  private readonly logger = new Logger(SystemTokensRefresher.name);

  constructor(
    private readonly characterService: CharacterService,
    private readonly esiToken: EsiTokenService,
  ) {}

  /**
   * Refresh SYSTEM character tokens monthly to keep them alive.
   */
  async refreshSystemCharacterTokens(): Promise<void> {
    const systemChars =
      await this.characterService.getSystemManagedCharacters();

    let successCount = 0;
    let failCount = 0;

    for (const char of systemChars) {
      try {
        await this.esiToken.getAccessToken(char.id);
        successCount++;
        this.logger.log(
          `Refreshed token for SYSTEM character ${char.name} (${char.id})`,
        );
      } catch (e) {
        failCount++;
        this.logger.error(
          `Failed to refresh token for SYSTEM character ${char.name} (${char.id}): ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    this.logger.log(
      `System character token refresh completed: ${successCount} success, ${failCount} failures`,
    );
  }
}
