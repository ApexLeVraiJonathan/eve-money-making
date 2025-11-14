/**
 * Complete Plan Restore
 * 
 * One-stop script that:
 * 1. Checks for/creates an open cycle
 * 2. Restores the plan from file
 * 3. Commits it to the database
 */

import { execSync } from 'child_process';

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && idx < process.argv.length - 1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const apiKey = getArg('--apiKey');
  const apiUrl = getArg('--apiUrl') || 'http://localhost:3000';
  const filePath = getArg('--file') || '../../docs/plan.md';
  
  if (!apiKey) {
    console.error('❌ Missing required argument: --apiKey');
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/restore-plan-complete.ts --apiKey KEY [--file PATH] [--apiUrl URL]');
    console.log('\nExample:');
    console.log('  npx ts-node scripts/restore-plan-complete.ts --apiKey dev_1234567890');
    process.exit(1);
  }
  
  console.log('\n🔄 Starting complete plan restore process...\n');
  console.log('=' .repeat(80));
  
  try {
    // Step 1: Check for open cycle
    console.log('\n📋 Step 1: Checking for open cycle...\n');
    execSync('npx ts-node scripts/check-open-cycle.ts', { stdio: 'inherit' });
    
    // Step 2: Create open cycle if needed
    console.log('\n📋 Step 2: Creating open cycle (if needed)...\n');
    try {
      execSync(
        `npx ts-node scripts/create-open-cycle.ts --apiKey ${apiKey} --apiUrl ${apiUrl}`,
        { stdio: 'inherit' }
      );
    } catch (e) {
      console.log('   (Cycle might already exist, continuing...)\n');
    }
    
    // Step 3: Restore the plan
    console.log('\n📋 Step 3: Restoring plan from file...\n');
    execSync(
      `npx ts-node scripts/restore-plan-from-file.ts --file ${filePath} --apiKey ${apiKey} --apiUrl ${apiUrl} --memo "Restored from production incident"`,
      { stdio: 'inherit' }
    );
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ COMPLETE! Your plan has been restored.\n');
    console.log('Next steps:');
    console.log('  1. Visit http://localhost:3001/tradecraft/admin/cycles');
    console.log('  2. Review the committed packages');
    console.log('  3. Verify the cycle lines look correct\n');
    
  } catch (error) {
    console.error('\n❌ Error during restore:', error);
    process.exit(1);
  }
}

main();

