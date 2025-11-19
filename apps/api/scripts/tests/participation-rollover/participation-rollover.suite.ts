/**
 * Participation Rollover Test Suite
 *
 * Runs all rollover scenarios in order, building on shared state.
 *
 * Usage:
 *   pnpm exec ts-node scripts/tests/participation-rollover/participation-rollover.suite.ts \
 *     --apiUrl http://localhost:3000 \
 *     --apiKey <your-dev-api-key> \
 *     --characterId <logistics-character-id> \
 *     [--interactive]
 *
 * Options:
 *   --apiUrl <url>           API endpoint (default: http://localhost:3000)
 *   --apiKey <key>           Dev API key for authentication
 *   --token <token>          Bearer token (alternative to API key)
 *   --characterId <id>       Logistics character ID for creating test data
 *   --interactive            Enable interactive pauses for UI verification
 *   --skip-cleanup           Skip initial cleanup (for debugging)
 *
 * Environment:
 *   This suite is designed for LOCAL/DEV environments only!
 *   It will DELETE ALL existing cycles and participations.
 */

import { PrismaClient } from '@eve/prisma';
import {
  TestConfig,
  SharedRolloverContext,
  createSharedContext,
  cleanAllTestData,
} from './helpers';

import { scenario01FirstTimeInvestor } from './scenarios/01-first-time-investor-baseline.test';
import { scenario02FullPayoutRollover } from './scenarios/02-full-payout-rollover-happy-path.test';
import { scenario03InitialOnlyRollover } from './scenarios/03-initial-only-rollover-flow.test';
import { scenario04CustomAmountRollover } from './scenarios/04-custom-amount-rollover-flow.test';
import { scenario05ExcessPayoutAbove20B } from './scenarios/05-excess-payout-above-20b.test';
import { scenario06OptOutPlanned } from './scenarios/06-opt-out-planned.test';
import { scenario07NegativePathsGuardrails } from './scenarios/07-negative-paths-guardrails.test';

const prisma = new PrismaClient();

interface SuiteScenario {
  name: string;
  emoji: string;
  fn: (config: TestConfig, ctx: SharedRolloverContext) => Promise<void>;
  optional?: boolean;
}

const scenarios: SuiteScenario[] = [
  {
    name: 'First-Time Investor Baseline',
    emoji: '[1]',
    fn: scenario01FirstTimeInvestor,
  },
  {
    name: 'Full Payout Rollover - Happy Path',
    emoji: '[2]',
    fn: scenario02FullPayoutRollover,
  },
  {
    name: 'Initial Only Rollover Flow',
    emoji: '[3]',
    fn: scenario03InitialOnlyRollover,
  },
  {
    name: 'Custom Amount Rollover Flow',
    emoji: '[4]',
    fn: scenario04CustomAmountRollover,
  },
  {
    name: 'Excess Payout Above 20B',
    emoji: '[5]',
    fn: scenario05ExcessPayoutAbove20B,
  },
  {
    name: 'Opt-out of PLANNED Cycle',
    emoji: '[6]',
    fn: scenario06OptOutPlanned,
  },
  {
    name: 'Negative Paths and Guardrails',
    emoji: '[7]',
    fn: scenario07NegativePathsGuardrails,
    optional: true,
  },
];

async function runSuite() {
  console.log('\n' + '='.repeat(64));
  console.log('     PARTICIPATION ROLLOVER TEST SUITE');
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
  };

  const skipCleanup = args.includes('--skip-cleanup');

  // Validate configuration
  if ((!config.token && !config.apiKey) || !config.characterId) {
    console.error('ERROR: Missing required arguments\n');
    console.log('Usage:');
    console.log(
      '  pnpm exec ts-node scripts/tests/participation-rollover/participation-rollover.suite.ts \\',
    );
    console.log('    --apiUrl http://localhost:3000 \\');
    console.log('    --apiKey <your-dev-api-key> \\');
    console.log('    --characterId <logistics-character-id> \\');
    console.log('    [--interactive]\n');
    console.log('Options:');
    console.log(
      '  --apiUrl <url>           API endpoint (default: http://localhost:3000)',
    );
    console.log('  --apiKey <key>           Dev API key for authentication');
    console.log(
      '  --token <token>          Bearer token (alternative to API key)',
    );
    console.log('  --characterId <id>       Logistics character ID');
    console.log(
      '  --interactive            Enable interactive pauses for UI verification',
    );
    console.log(
      '  --skip-cleanup           Skip initial cleanup (for debugging)\n',
    );
    process.exit(1);
  }

  console.log('Configuration:');
  console.log('   API URL: ' + config.apiUrl);
  console.log('   Auth: ' + (config.apiKey ? 'API Key' : 'Bearer Token'));
  console.log('   Character ID: ' + config.characterId);
  console.log('   Interactive: ' + (config.interactive ? 'YES' : 'NO'));
  console.log('   Skip Cleanup: ' + (skipCleanup ? 'YES' : 'NO') + '\n');

  if (!config.interactive) {
    console.log(
      'INFO: Running in non-interactive mode (no UI verification pauses)',
    );
    console.log('      Use --interactive flag to enable manual UI checks\n');
  }

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

  // Initialize shared context (user ID not needed - will be detected from UI opt-ins)
  const ctx = createSharedContext('manual-ui-test-' + Date.now());

  if (config.interactive) {
    console.log('NOTE: Interactive mode enabled');
    console.log('      You will be prompted to manually opt-in via the UI');
    console.log(
      '      The tests will verify the backend state after each action\n',
    );
  }

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
    console.log(
      scenario.emoji + '  SCENARIO ' + scenarioNum + ': ' + scenario.name,
    );
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
      'RESULT: All scenarios PASSED - Feature ready for deployment!\n',
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
    return prisma.$disconnect();
  });
