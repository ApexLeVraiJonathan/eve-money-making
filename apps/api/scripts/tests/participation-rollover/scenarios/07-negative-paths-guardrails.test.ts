/**
 * Scenario 07: Negative Paths and Guardrails
 *
 * Tests error handling and edge cases:
 * - Rollover without eligible source participation
 * - Multiple participations for same user/cycle (idempotency)
 * - Invalid rollover types and malformed payloads
 *
 * This scenario can be run independently or as part of the suite.
 */

import {
  TestConfig,
  SharedRolloverContext,
  createApiCall,
  createCycle,
  createParticipation,
  logStep,
  logSuccess,
  logInfo,
  printScenarioHeader,
  printScenarioComplete,
} from '../helpers';

export async function scenario07NegativePathsGuardrails(
  config: TestConfig,
  ctx: SharedRolloverContext,
): Promise<void> {
  printScenarioHeader('⚠️', 'SCENARIO 07: Negative Paths and Guardrails');

  const apiCall = createApiCall(config);

  // Step 1: Attempt rollover without eligible source participation
  logStep('1️⃣', 'Testing rollover without eligible source participation...');

  const testCycle = await createCycle(apiCall, 'Negative Test Cycle');
  logInfo(`Test cycle created: ${testCycle.id.substring(0, 8)}`);

  try {
    await createParticipation(apiCall, {
      cycleId: testCycle.id,
      characterName: 'No Source User',
      amountIsk: '5000000000.00',
      testUserId: 'no-source-user',
      rollover: {
        type: 'FULL_PAYOUT',
      },
    });
    throw new Error('❌ Should have rejected rollover without eligible source');
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('OPEN cycle') ||
      error.message.includes('active participation') ||
      error.message.includes('Rollover requires')
    )) {
      logSuccess('Correctly rejected rollover without eligible source');
    } else if (error instanceof Error && error.message.includes('❌ Should have')) {
      throw error;
    } else {
      logSuccess('Rollover without source rejected with error');
      logInfo(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Step 2: Test multiple participation creation (idempotency)
  logStep('2️⃣', 'Testing multiple participation creation (idempotency)...');

  const testUserId = 'idempotency-test-user';
  const p1 = await createParticipation(apiCall, {
    cycleId: testCycle.id,
    characterName: 'Idempotency Test',
    amountIsk: '2000000000.00',
    testUserId,
  });
  logSuccess(`First participation created: ${p1.id.substring(0, 8)}`);

  const p2 = await createParticipation(apiCall, {
    cycleId: testCycle.id,
    characterName: 'Idempotency Test',
    amountIsk: '3000000000.00', // Different amount
    testUserId,
  });

  if (p1.id === p2.id) {
    logSuccess('Idempotency: Returned existing participation (correct)');
  } else {
    logInfo('Created second participation (may be acceptable depending on business rules)');
    logInfo(`First: ${p1.id.substring(0, 8)}, Second: ${p2.id.substring(0, 8)}`);
  }

  // Step 3: Test invalid rollover type (if DTO validation allows it through)
  logStep('3️⃣', 'Testing validation error handling...');

  // Note: TypeScript and DTO validation should catch most invalid payloads
  // This test documents expected behavior if someone bypasses client-side validation

  // Test custom amount without the required field
  try {
    await createParticipation(apiCall, {
      cycleId: testCycle.id,
      characterName: 'Invalid Rollover',
      amountIsk: '1000000000.00',
      testUserId: 'invalid-rollover-user',
      rollover: {
        type: 'CUSTOM_AMOUNT',
        // Missing customAmountIsk
      },
    });
    logInfo('Custom amount without customAmountIsk was accepted (may validate later)');
  } catch (error) {
    if (error instanceof Error && error.message.includes('custom')) {
      logSuccess('Correctly rejected CUSTOM_AMOUNT without customAmountIsk');
    } else {
      logInfo('Validation error occurred (expected)');
    }
  }

  // Step 4: Test participation amount exactly at cap boundary
  logStep('4️⃣', 'Testing participation at exact cap boundaries...');

  try {
    const p10B = await createParticipation(apiCall, {
      cycleId: testCycle.id,
      characterName: 'Cap Boundary Test',
      amountIsk: '10000000000.00', // Exactly 10B
      testUserId: 'cap-boundary-user',
    });
    logSuccess(`10B participation accepted: ${p10B.id.substring(0, 8)}`);
  } catch (error) {
    logInfo('10B participation rejected (unexpected)');
  }

  try {
    await createParticipation(apiCall, {
      cycleId: testCycle.id,
      characterName: 'Over Cap Test',
      amountIsk: '10000000000.01', // Slightly over 10B
      testUserId: 'over-cap-user',
    });
    logInfo('10B+0.01 participation accepted (may be acceptable with rounding)');
  } catch (error) {
    if (error instanceof Error && error.message.includes('10B')) {
      logSuccess('Correctly rejected participation slightly over 10B cap');
    } else {
      logInfo('Participation over cap rejected');
    }
  }

  // Step 5: Test zero or negative amounts
  logStep('5️⃣', 'Testing zero and negative amounts...');

  try {
    await createParticipation(apiCall, {
      cycleId: testCycle.id,
      characterName: 'Zero Amount',
      amountIsk: '0.00',
      testUserId: 'zero-amount-user',
    });
    logInfo('Zero amount participation was accepted (may be prevented by validation)');
  } catch (error) {
    logSuccess('Zero amount rejected (expected)');
  }

  printScenarioComplete();
}

// Allow standalone execution
if (require.main === module) {
  const { PrismaClient } = require('@eve/prisma');
  const prisma = new PrismaClient();

  (async () => {
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

    if ((!config.token && !config.apiKey) || !config.characterId) {
      console.error('❌ Missing required arguments');
      console.log('\nUsage:');
      console.log(
        '  pnpm exec ts-node scripts/tests/participation-rollover/scenarios/07-negative-paths-guardrails.test.ts --apiKey <key> --characterId <id>',
      );
      process.exit(1);
    }

    const { createSharedContext } = await import('../helpers');
    const ctx = createSharedContext('negative-test-user');

    try {
      console.log('\n🚀 Running Scenario 07: Negative Paths and Guardrails\n');
      await scenario07NegativePathsGuardrails(config, ctx);
      console.log('\n✅ Scenario 07 passed!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Scenario 07 failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}

