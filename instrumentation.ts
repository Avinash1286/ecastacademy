/**
 * Next.js Instrumentation
 * 
 * This file runs once when the Next.js server starts up.
 * Used for initialization tasks like environment validation.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvWithLogging } = await import('@/lib/config/env');
    
    console.log('[Instrumentation] Starting server initialization...');
    
    // Validate environment variables
    // In production, validateEnvWithLogging() throws on validation failure
    // This will prevent the server from starting with invalid configuration
    validateEnvWithLogging();
    
    console.log('[Instrumentation] Server initialization complete');
  }
}
