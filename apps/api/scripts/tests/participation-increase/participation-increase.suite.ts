/**
 * Participation Increase Test Suite
 *
 * Validates the new "Increase Participation" feature across:
 * - Normal participations (interactive UI-driven increase)
 * - JingleYield root participations (admin-funded seed + user extra)
 * - Rollover edge cases (backend-only caps for 10B principal / 20B total)
 *
 * Usage:
 *   pnpm exec ts-node scripts/tests/participation-increase/participation-increase.suite.ts \
 *     --apiUrl http://localhost:3000 \
 *     --apiKey <your-dev-api-key> \
 *     --characterId <admin-character-id> \
 *     --testUserId <real-user-id> \
 *     --interactive
 *
 * NOTE: This suite is designed to be run in interactive mode so that the
 * human operator can exercise the frontend Increase Participation UI.
 */

import {
  type TestConfig,
  type SharedRolloverContext,
  createSharedContext,
  cleanAllTestData,
} from './helpers';

import { scenario01NormalParticipationIncrease } from './scenarios/01-normal-participation-increase.test';
import { scenario02JingleYieldParticipationIncrease } from './scenarios/02-jy-participation-increase.test';
import { scenario03RolloverIncreaseEdgeCases } from './scenarios/03-rollover-increase-edge-cases.test';

interface SuiteScenario {
  name: string;
  emoji: string;
  fn: (config: TestConfig, ctx: SharedRolloverContext) => Promise<void>;
  optional?: boolean;
}

const scenarios: SuiteScenario[] = [
  {
    name: 'Normal Participation Increase (Interactive)',
    emoji: '[1]',
    fn: scenario01NormalParticipationIncrease,
  },
  {
    name: 'JingleYield Root Participation Increase (Interactive)',
    emoji: '[2]',
    fn: scenario02JingleYieldParticipationIncrease,
  },
  {
    name: 'Rollover Increase Edge Cases (Backend)',
    emoji: '[3]',
    fn: scenario03RolloverIncreaseEdgeCases,
  },
];

async function runSuite() {
  console.log('\n' + '='.repeat(64));
  console.log('      PARTICIPATION INCREASE TEST SUITE');
  console.log('='.repeat(64) + '\n');

  // Parse CLI arguments
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };

  const config: TestConfig = {
    apiUrl: getArg('--apiUrl') || 'http://localhost:3000',
    token: getArg('--token'),
    apiKey: getArg('--apiKey'),
    characterId: parseInt(getArg('--characterId') || '0'),
    interactive: args.includes('--interactive'),
    testUserId: getArg('--testUserId'),
  };

  const skipCleanup = args.includes('--skip-cleanup');

  // Validate configuration
  if (
    (!config.token && !config.apiKey) ||
    !config.characterId ||
    !config.testUserId
  ) {
    console.error('ERROR: Missing required arguments\n');
    console.log('Usage:');
    console.log(
      '  pnpm exec ts-node scripts/tests/participation-increase/participation-increase.suite.ts \\',
    );
    console.log('    --apiUrl http://localhost:3000 \\');
    console.log('    --apiKey <your-dev-api-key> \\');
    console.log('    --characterId <admin-character-id> \\');
    console.log('    --testUserId <real-user-id> \\');
    console.log('    --interactive\n');
    process.exit(1);
  }

  if (!config.interactive) {
    console.error(
      'ERROR: This suite must be run with --interactive so that the Increase Participation UI can be exercised.\n',
    );
    process.exit(1);
  }

  console.log('Configuration:');
  console.log('   API URL: ' + config.apiUrl);
  console.log('   Auth: ' + (config.apiKey ? 'API Key' : 'Bearer Token'));
  console.log('   Admin Character ID: ' + config.characterId);
  console.log('   Test User ID: ' + config.testUserId);
  console.log('   Interactive: YES');
  console.log('   Skip Cleanup: ' + (skipCleanup ? 'YES' : 'NO') + '\n');

  // Confirm environment safety
  if (config.apiUrl.includes('production') || config.apiUrl.includes('prod')) {
    console.error('ERROR: This suite must NOT be run against production!\n');
    process.exit(1);
  }

  // Warn about data deletion
  if (!skipCleanup) {
    console.log(
      'WARNING: This will DELETE ALL cycles, participations, and wallet data!',
    );
    console.log(
      '         Press Ctrl+C now to cancel, or wait 3 seconds to continue...\n',
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  // Initialize shared context
  const ctx: SharedRolloverContext = createSharedContext(
    config.testUserId as string,
  );

  // Clean test data
  if (!skipCleanup) {
    await cleanAllTestData();
  } else {
    console.log('INFO: Skipping cleanup (--skip-cleanup flag set)\n');
  }

  // Run scenarios
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const scenarioNum = String(i + 1).padStart(2, '0');

    console.log('\n' + '='.repeat(64));
    console.log(scenario.emoji + '  SCENARIO ' + scenarioNum + ': ' + scenario.name);
    console.log('='.repeat(64) + '\n');

    try {
      await scenario.fn(config, ctx);
      passed++;
      console.log('\n[PASS] Scenario ' + scenarioNum + ' PASSED\n');
    } catch (error) {
      if (scenario.optional) {
        console.error(
          '\n[SKIP] Scenario ' + scenarioNum + ' FAILED (optional):',
        );
        console.error(error);
        skipped++;
      } else {
        console.error('\n[FAIL] Scenario ' + scenarioNum + ' FAILED:');
        console.error(error);
        failed++;
        console.log(
          '\nERROR: Stopping suite due to critical scenario failure\n',
        );
        break;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(64));
  console.log('     TEST SUITE SUMMARY');
  console.log('='.repeat(64) + '\n');
  console.log('   Total Scenarios: ' + scenarios.length);
  console.log('   Passed: ' + passed);
  console.log('   Failed: ' + failed);
  console.log('   Skipped/Optional: ' + skipped + '\n');

  if (failed > 0) {
    console.log('RESULT: Suite FAILED - Fix failures before deploying\n');
    process.exit(1);
  } else if (passed === scenarios.length) {
    console.log(
      'RESULT: All scenarios PASSED - Participation increase wiring looks good!\n',
    );
    process.exit(0);
  } else {
    console.log(
      'RESULT: Core scenarios PASSED - Review optional scenario failures\n',
    );
    process.exit(0);
  }
}

// Run the suite
runSuite()
  .catch((error) => {
    console.error('\nERROR: Suite runner crashed:', error);
    process.exit(1);
  })
  .finally(() => {
    return process.exit(0);
  });


