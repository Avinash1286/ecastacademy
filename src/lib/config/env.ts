/**
 * Environment Variable Validation
 * 
 * Validates required environment variables at startup to fail fast
 * if the application is misconfigured.
 * 
 * Usage: Import this file early in the application lifecycle (e.g., in layout.tsx)
 */

import { logger } from '@/lib/logging/logger';

// Define environment variable requirements
interface EnvVarConfig {
  name: string;
  required: boolean;
  requiredInProduction?: boolean;
  description: string;
}

const ENV_VARS: EnvVarConfig[] = [
  // Core - Always Required
  { name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', required: true, description: 'Clerk publishable key' },
  { name: 'CLERK_SECRET_KEY', required: true, description: 'Clerk secret key' },
  { name: 'NEXT_PUBLIC_CONVEX_URL', required: true, description: 'Convex deployment URL' },
  
  // App URLs
  { name: 'NEXT_PUBLIC_APP_URL', required: false, requiredInProduction: true, description: 'Public app URL for CORS and redirects' },
  
  // Convex
  { name: 'CONVEX_DEPLOY_KEY', required: false, requiredInProduction: false, description: 'Convex deploy key for server-side operations' },
  
  // AI Services (at least one should be configured)
  { name: 'GEMINI_API_KEY', required: false, description: 'Google Gemini API key' },
  { name: 'OPENAI_API_KEY', required: false, description: 'OpenAI API key' },
  
  // Rate Limiting (required in production for multi-instance)
  { name: 'UPSTASH_REDIS_REST_URL', required: false, requiredInProduction: true, description: 'Upstash Redis URL for rate limiting' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', required: false, requiredInProduction: true, description: 'Upstash Redis token' },
  
  // YouTube
  { name: 'YOUTUBE_API_KEY', required: false, description: 'YouTube Data API key' },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate all environment variables
 */
export function validateEnv(): ValidationResult {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];
    const isEmpty = !value || value.trim() === '';
    
    if (envVar.required && isEmpty) {
      errors.push(`Missing required env var: ${envVar.name} - ${envVar.description}`);
    } else if (isProduction && envVar.requiredInProduction && isEmpty) {
      errors.push(`Missing production-required env var: ${envVar.name} - ${envVar.description}`);
    } else if (isEmpty && !envVar.required) {
      // Only warn for optional vars that might be useful
      if (envVar.name.includes('OAUTH') || envVar.name.includes('CLIENT')) {
        warnings.push(`Optional env var not set: ${envVar.name} - ${envVar.description}`);
      }
    }
  }
  
  // Check that at least one AI provider is configured
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  
  if (!hasGemini && !hasOpenAI) {
    if (isProduction) {
      errors.push('At least one AI provider (GEMINI_API_KEY or OPENAI_API_KEY) must be configured');
    } else {
      warnings.push('No AI provider configured - AI features will not work');
    }
  }
  
  // Check OAuth pairs (if one is set, both should be)
  const oauthPairs = [
    ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
  ];
  
  for (const [id, secret] of oauthPairs) {
    const hasId = !!process.env[id];
    const hasSecret = !!process.env[secret];
    
    if (hasId !== hasSecret) {
      warnings.push(`OAuth misconfigured: ${id} and ${secret} should both be set or both empty`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate environment and log results
 * Call this early in the application lifecycle
 */
export function validateEnvWithLogging(): void {
  const result = validateEnv();
  
  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      logger.warn(`[ENV] ${warning}`);
    }
  }
  
  if (!result.valid) {
    for (const error of result.errors) {
      logger.error(`[ENV] ${error}`);
    }
    
    // In production, fail fast
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Environment validation failed:\n${result.errors.join('\n')}\n\n` +
        'Please configure all required environment variables before starting the application.'
      );
    } else {
      logger.warn('[ENV] Environment validation failed - some features may not work in development');
    }
  } else {
    logger.info('[ENV] Environment validation passed');
  }
}

/**
 * Get a typed environment variable with validation
 */
export function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value || defaultValue || '';
}

/**
 * Get a boolean environment variable
 */
export function getEnvBoolean(name: string, defaultValue = false): boolean {
  const value = process.env[name]?.toLowerCase();
  if (!value) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Get a number environment variable
 */
export function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Export a singleton validation check that runs once
let validated = false;
export function ensureEnvValidated(): void {
  if (!validated) {
    validated = true;
    validateEnvWithLogging();
  }
}
