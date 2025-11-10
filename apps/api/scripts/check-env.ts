#!/usr/bin/env tsx
/**
 * Environment Variable Checker
 * Shows which required variables are present/missing in your .env file
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env file
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Found .env file at: ${envPath}\n`);
} else {
  console.log(`❌ No .env file found at: ${envPath}\n`);
  process.exit(1);
}

const REQUIRED_VARS = [
  'DATABASE_URL',
  'ENCRYPTION_KEY',
  'NEXTAUTH_SECRET',
  'EVE_CLIENT_ID',
  'EVE_CLIENT_SECRET',
  'EVE_CLIENT_ID_LINKING',
  'EVE_CLIENT_SECRET_LINKING',
  'EVE_CLIENT_ID_SYSTEM',
  'EVE_CLIENT_SECRET_SYSTEM',
];

const RECOMMENDED_VARS = [
  'ESI_USER_AGENT',
  'API_URL',
  'NEXTAUTH_URL',
  'PORT',
  'CORS_ORIGINS',
];

console.log('📋 Required Variables:');
console.log('='.repeat(80));

const missing: string[] = [];
const present: string[] = [];

for (const varName of REQUIRED_VARS) {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName.padEnd(30)} = ${maskValue(value)}`);
    present.push(varName);
  } else {
    console.log(`❌ ${varName.padEnd(30)} = MISSING`);
    missing.push(varName);
  }
}

console.log('\n📋 Recommended Variables:');
console.log('='.repeat(80));

for (const varName of RECOMMENDED_VARS) {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName.padEnd(30)} = ${maskValue(value)}`);
  } else {
    console.log(`⚠️  ${varName.padEnd(30)} = Not set (will use default)`);
  }
}

console.log('\n📊 Summary:');
console.log('='.repeat(80));
console.log(`Present: ${present.length}/${REQUIRED_VARS.length} required variables`);
console.log(`Missing: ${missing.length}/${REQUIRED_VARS.length} required variables`);

if (missing.length > 0) {
  console.log('\n❌ You need to add these to apps/api/.env:');
  console.log('='.repeat(80));
  for (const varName of missing) {
    console.log(`${varName}=your_value_here`);
  }
  console.log('\nSee env.example.md for details on each variable.\n');
  process.exit(1);
} else {
  console.log('\n✅ All required variables are set! You can start the API.\n');
  process.exit(0);
}

function maskValue(value: string): string {
  if (value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

