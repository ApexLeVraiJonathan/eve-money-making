import { Logger } from '@nestjs/common';

/**
 * Environment variable validation at startup
 *
 * Validates that all required environment variables are set before the app starts.
 * Fails fast with clear error messages if any required variables are missing.
 */

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

const logger = new Logger('EnvValidation');

/**
 * Required environment variables for the application to function
 */
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
] as const;

/**
 * Optional but recommended environment variables
 */
const RECOMMENDED_VARS = [
  'ESI_USER_AGENT',
  'API_URL',
  'NEXTAUTH_URL',
  'PORT',
  'CORS_ORIGINS',
] as const;

/**
 * Validate environment variables at startup
 *
 * @throws Error if required variables are missing
 */
export function validateEnvironment(): void {
  const result = checkEnvironment();

  // Log warnings for missing recommended variables
  if (result.warnings.length > 0) {
    logger.warn(
      `Missing recommended environment variables: ${result.warnings.join(', ')}`,
    );
    logger.warn('The application will use default values for these variables.');
  }

  // Fail if required variables are missing
  if (!result.valid) {
    logger.error('❌ Environment validation failed!');
    logger.error(`Missing required variables: ${result.missing.join(', ')}`);
    logger.error(
      'Please set these environment variables before starting the application.',
    );
    logger.error('See env.example.md for configuration details.');
    throw new Error(
      `Missing required environment variables: ${result.missing.join(', ')}`,
    );
  }

  logger.log('✅ Environment validation passed');

  // Log environment info (without sensitive values)
  logger.log(`NODE_ENV: ${process.env.NODE_ENV ?? 'development'}`);
  logger.log(`PORT: ${process.env.PORT ?? '3000'}`);
  logger.log(
    `Database: ${maskConnectionString(process.env.DATABASE_URL ?? '')}`,
  );
}

/**
 * Check environment variables and return validation result
 */
function checkEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check recommended variables
  for (const varName of RECOMMENDED_VARS) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Mask sensitive parts of connection strings for logging
 */
function maskConnectionString(connectionString: string): string {
  try {
    // Mask password in connection strings
    return connectionString.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1****$2');
  } catch {
    return '****';
  }
}

/**
 * Validate a specific environment variable and provide a default
 */
export function getRequiredEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value ?? defaultValue!;
}

/**
 * Get optional environment variable with default
 */
export function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}
