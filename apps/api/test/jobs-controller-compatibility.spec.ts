import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { JobsController } from '../src/tradecraft/jobs/jobs.controller';

describe('JobsController compatibility routes', () => {
  it('keeps GET aliases for admin job endpoints', () => {
    const routes = [
      ['cleanupGet', 'esi-cache/cleanup'],
      ['stalenessGet', 'staleness'],
      ['runWalletsGet', 'wallets/run'],
      ['cleanupOAuthStatesGet', 'oauth-state/cleanup'],
      ['refreshSystemTokensGet', 'system-tokens/refresh'],
      ['cleanupWalletJournalsGet', 'wallet/cleanup'],
    ] as const;

    for (const [methodName, path] of routes) {
      const handler = JobsController.prototype[methodName];
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
        RequestMethod.GET,
      );
    }
  });
});
