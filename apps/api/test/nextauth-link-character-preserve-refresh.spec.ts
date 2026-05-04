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

  it('preserves an existing refreshTokenEnc when linking an additional character without a refreshToken', async () => {
    const logger = { warn: jest.fn() } as unknown as Logger;

    const tx = {
      eveCharacter: {
        upsert: jest.fn(async () => ({
          id: 123,
          managedBy: 'USER',
          userId: null,
        })),
      },
      characterToken: {
        findUnique: jest.fn(async () => ({
          scopes: 'esi-wallet.read_character_wallet.v1',
          refreshTokenEnc: 'ENC_EXISTING',
        })),
        upsert: jest.fn(),
      },
    };

    const prisma = {
      $transaction: async (fn: (tx: any) => Promise<void>) => fn(tx),
    } as any;

    const auth = new AuthService(prisma, logger);

    await auth.linkAdditionalCharacterToUser('u1', {
      characterId: 123,
      characterName: 'Test',
      ownerHash: 'owner',
      accessToken: 'new-access',
      expiresIn: 1200,
      scopes: 'esi-wallet.read_character_wallet.v1',
    });

    const call = tx.characterToken.upsert.mock.calls[0]?.[0];
    expect(call?.update?.refreshTokenEnc).toBe('ENC_EXISTING');
    expect(call?.create?.refreshTokenEnc).toBe('ENC_EXISTING');
    expect(tx.eveCharacter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ userId: 'u1' }),
        create: expect.objectContaining({ userId: 'u1' }),
      }),
    );
  });

  it('stores a system character token and parses callback state metadata', async () => {
    const logger = { warn: jest.fn() } as unknown as Logger;
    jest.spyOn(CryptoUtil, 'encrypt').mockResolvedValue('ENC_SYSTEM');

    const tx = {
      eveCharacter: {
        upsert: jest.fn(),
      },
      characterToken: {
        upsert: jest.fn(),
      },
    };

    const prisma = {
      $transaction: async (fn: (tx: any) => Promise<void>) => fn(tx),
    } as any;

    const auth = new AuthService(prisma, logger);

    const result = await auth.upsertSystemCharacterWithToken({
      tokens: {
        access_token: 'system-access',
        token_type: 'Bearer',
        expires_in: 1200,
        refresh_token: 'system-refresh',
      },
      decoded: {
        sub: 'EVE:CHARACTER:456',
        name: 'System Pilot',
        owner: 'owner-hash',
        scp: ['esi-markets.structure_markets.v1'],
      },
      stateReturnUrl: JSON.stringify({
        notes: 'Hauler',
        returnUrl: 'https://example.test/admin',
      }),
    });

    expect(result).toEqual({
      characterName: 'System Pilot',
      storedReturnUrl: 'https://example.test/admin',
    });
    expect(tx.eveCharacter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 456 },
        update: expect.objectContaining({
          managedBy: 'SYSTEM',
          role: 'LOGISTICS',
          notes: 'Hauler',
        }),
        create: expect.objectContaining({
          userId: null,
          managedBy: 'SYSTEM',
        }),
      }),
    );
    expect(tx.characterToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { characterId: 456 },
        update: expect.objectContaining({
          accessToken: 'system-access',
          refreshTokenEnc: 'ENC_SYSTEM',
          scopes: 'esi-markets.structure_markets.v1',
        }),
      }),
    );

    jest.restoreAllMocks();
  });
});
