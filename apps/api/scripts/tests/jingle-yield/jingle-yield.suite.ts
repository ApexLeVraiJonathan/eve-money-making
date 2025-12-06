/**
 * JingleYield Test Suite
 *
 * Validates the JingleYield seeded 2B principal promotion end-to-end:
 * - Admin can create a JingleYield participation for a real user
 * - A 2B participation is created and linked to a JingleYieldProgram
 * - JingleYield admin APIs expose correct summary information
 *
 * Usage:
 *   pnpm exec ts-node scripts/tests/jingle-yield/jingle-yield.suite.ts \
 *     --apiUrl http://localhost:3000 \
 *     --apiKey <your-dev-api-key> \
 *     --characterId <admin-character-id> \
 *     --testUserId <real-user-id> \
 *     [--interactive]
 *
 * WARNING: This suite deletes all cycles/participations and wallet data.
 *          Never run against production.
 */

import { PrismaClient } from '@eve/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  TestConfig,
  SharedRolloverContext,
  createSharedContext,
  cleanAllTestData,
} from './helpers';

import { scenario01JingleYieldBaseline } from './scenarios/01-jingle-yield-baseline.test';
import { scenario02JingleYieldLockedPrincipalRollover } from './scenarios/02-jingle-yield-locked-principal-rollover.test';
import { scenario03JingleYieldAdjustablePrincipalAndCycles } from './scenarios/03-jingle-yield-adjustable-principal-min-cycles.test';
import { scenario04JingleYieldPrincipalCap } from './scenarios/04-jingle-yield-principal-cap.test';
import { scenario05JingleYieldCompletionByMinCycles } from './scenarios/05-jingle-yield-completion-by-min-cycles.test';
import { scenario06JingleYieldCompletionByInterestTarget } from './scenarios/06-jingle-yield-completion-by-interest-target.test';

const dbUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
});

interface SuiteScenario {
  name: string;
  emoji: string;
  fn: (config: TestConfig, ctx: SharedRolloverContext) => Promise<void>;
  optional?: boolean;
}

const scenarios: SuiteScenario[] = [
  {
    name: 'JingleYield Creation & Admin Wiring',
    emoji: '[1]',
    fn: scenario01JingleYieldBaseline,
  },
  {
    name: 'Locked Principal Cannot Be Withdrawn (Rollover)',
    emoji: '[2]',
    fn: scenario02JingleYieldLockedPrincipalRollover,
  },
  {
    name: 'Adjustable Principal & Min Cycles',
    emoji: '[3]',
    fn: scenario03JingleYieldAdjustablePrincipalAndCycles,
  },
  {
    name: '10B User Principal Cap with Active JY Program',
    emoji: '[4]',
    fn: scenario04JingleYieldPrincipalCap,
  },
  {
    name: 'Completion by Min Cycles',
    emoji: '[5]',
    fn: scenario05JingleYieldCompletionByMinCycles,
  },
  {
    name: 'Completion by Interest Target',
    emoji: '[6]',
    fn: scenario06JingleYieldCompletionByInterestTarget,
  },
];

async function runSuite() {
  console.log('\n' + '='.repeat(64));
  console.log('           JINGLEYIELD TEST SUITE');
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
  if ((!config.token && !config.apiKey) || !config.characterId || !config.testUserId) {
    console.error('ERROR: Missing required arguments\n');
    console.log('Usage:');
    console.log(
      '  pnpm exec ts-node scripts/tests/jingle-yield/jingle-yield.suite.ts \\',
    );
    console.log('    --apiUrl http://localhost:3000 \\');
    console.log('    --apiKey <your-dev-api-key> \\');
    console.log('    --characterId <admin-character-id> \\');
    console.log('    --testUserId <real-user-id> \\');
    console.log('    [--interactive]\n');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log('   API URL: ' + config.apiUrl);
  console.log('   Auth: ' + (config.apiKey ? 'API Key' : 'Bearer Token'));
  console.log('   Admin Character ID: ' + config.characterId);
  console.log('   Test User ID: ' + config.testUserId);
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

  // Initialize shared context
  const ctx: SharedRolloverContext = createSharedContext(
    config.testUserId as string,
  );

  // Clean test data
  if (!skipCleanup) {
    await cleanAllTestData();
    // Also clear any existing JingleYield programs
    await prisma.jingleYieldProgram.deleteMany({});
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
      'RESULT: All scenarios PASSED - JingleYield wiring looks good!\n',
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


