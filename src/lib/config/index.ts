/**
 * Configuration Module
 * 
 * Centralized configuration and environment management
 */

export {
  validateEnv,
  validateEnvWithLogging,
  ensureEnvValidated,
  getEnv,
  getEnvBoolean,
  getEnvNumber,
  type ValidationResult,
} from './env';
