import { Logger } from '@nestjs/common';
import { CryptoUtil } from '../src/common/crypto.util';
import { AuthService } from '../src/characters/services/auth.service';

describe('NextAuth token persistence safeguards', () => {
  it('does not overwrite an existing refreshTokenEnc when refreshToken is omitted', async () => {
    const logger = { warn: jest.fn() } as unknown as Logger;

    const tx = {
      eveCharacter: {
        upsert: jest.fn(async () => ({
          id: 123,
          managedBy: 'USER',
          userId: 'u1',
        })),
        update: jest.fn(),
      },
      characterToken: {
        findUnique: jest.fn(async () => ({
          scopes: '',
          refreshTokenEnc: 'ENC_EXISTING',
        })),
        upsert: jest.fn(),
      },
      user: {
        create: jest.fn(),
      },
    };

    const prisma = {
      $transaction: async (fn: (tx: any) => Promise<void>) => fn(tx),
    } as any;

    const auth = new AuthService(prisma, logger);

    await auth.linkCharacterFromNextAuth({
      characterId: 123,
      characterName: 'Test',
      ownerHash: 'owner',
      accessToken: 'new-access',
      // refreshToken omitted
      expiresIn: 1200,
      scopes: 'publicData',
    });

    expect(tx.characterToken.upsert).toHaveBeenCalled();
    const call = tx.characterToken.upsert.mock.calls[0]?.[0];
    expect(call?.update?.refreshTokenEnc).toBe('ENC_EXISTING');
    expect(call?.create?.refreshTokenEnc).toBe('ENC_EXISTING');
  });

  it('overwrites refreshTokenEnc when a new refreshToken is provided', async () => {
    const logger = { warn: jest.fn() } as unknown as Logger;
    jest.spyOn(CryptoUtil, 'encrypt').mockResolvedValue('ENC_NEW');

    const tx = {
      eveCharacter: {
        upsert: jest.fn(async () => ({
          id: 123,
          managedBy: 'USER',
          userId: 'u1',
        })),
        update: jest.fn(),
      },
      characterToken: {
        findUnique: jest.fn(async () => ({
          scopes: '',
          refreshTokenEnc: 'ENC_EXISTING',
        })),
        upsert: jest.fn(),
      },
      user: {
        create: jest.fn(),
      },
    };

    const prisma = {
      $transaction: async (fn: (tx: any) => Promise<void>) => fn(tx),
    } as any;

    const auth = new AuthService(prisma, logger);

    await auth.linkCharacterFromNextAuth({
      characterId: 123,
      characterName: 'Test',
      ownerHash: 'owner',
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 1200,
      scopes: 'publicData',
    });

    const call = tx.characterToken.upsert.mock.calls[0]?.[0];
    expect(call?.update?.refreshTokenEnc).toBe('ENC_NEW');
    expect(call?.create?.refreshTokenEnc).toBe('ENC_NEW');

    jest.restoreAllMocks();
  });
});
