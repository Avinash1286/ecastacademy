/**
 * Circuit Breaker Pattern for AI Provider Resilience
 * 
 * Prevents cascading failures by:
 * 1. Tracking failures for each provider
 * 2. Opening the circuit after threshold failures
 * 3. Allowing periodic test requests to check recovery
 * 4. Closing circuit once provider is healthy again
 * 
 * States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Provider is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if provider has recovered
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number;
  /** Time in ms to wait before trying again (default: 60000) */
  resetTimeout: number;
  /** Number of successful requests to close circuit (default: 2) */
  successThreshold: number;
  /** Time window for counting failures in ms (default: 60000) */
  failureWindow: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastStateChange: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  successThreshold: 2,
  failureWindow: 60000, // 1 minute
};

/**
 * In-memory circuit breaker state
 * Note: In a distributed system, this should be stored in a shared cache (Redis, etc.)
 * For Convex, we could persist to a table, but for now we use in-memory
 */
const circuitStates = new Map<string, CircuitBreakerState>();

/**
 * Get the current circuit state for a provider
 */
export function getCircuitState(provider: string): CircuitBreakerState {
  const existing = circuitStates.get(provider);
  if (existing) {
    return existing;
  }
  
  const initial: CircuitBreakerState = {
    state: "CLOSED",
    failures: 0,
    successes: 0,
    lastFailureTime: 0,
    lastStateChange: Date.now(),
  };
  circuitStates.set(provider, initial);
  return initial;
}

/**
 * Check if a request should be allowed through the circuit breaker
 */
export function shouldAllowRequest(
  provider: string,
  config: Partial<CircuitBreakerConfig> = {}
): { allowed: boolean; state: CircuitState; reason?: string } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const circuitState = getCircuitState(provider);
  const now = Date.now();
  
  switch (circuitState.state) {
    case "CLOSED":
      return { allowed: true, state: "CLOSED" };
    
    case "OPEN": {
      // Check if we should transition to HALF_OPEN
      const timeSinceLastFailure = now - circuitState.lastFailureTime;
      if (timeSinceLastFailure >= cfg.resetTimeout) {
        // Transition to HALF_OPEN and allow test request
        circuitState.state = "HALF_OPEN";
        circuitState.successes = 0;
        circuitState.lastStateChange = now;
        console.log(`[CircuitBreaker] ${provider}: OPEN -> HALF_OPEN (testing recovery)`);
        return { allowed: true, state: "HALF_OPEN" };
      }
      
      const retryInMs = cfg.resetTimeout - timeSinceLastFailure;
      return {
        allowed: false,
        state: "OPEN",
        reason: `Circuit is OPEN for ${provider}. Retry in ${Math.ceil(retryInMs / 1000)}s`,
      };
    }
    
    case "HALF_OPEN":
      // Allow limited requests to test recovery
      return { allowed: true, state: "HALF_OPEN" };
    
    default:
      return { allowed: true, state: "CLOSED" };
  }
}

/**
 * Record a successful request
 */
export function recordSuccess(
  provider: string,
  config: Partial<CircuitBreakerConfig> = {}
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const circuitState = getCircuitState(provider);
  const now = Date.now();
  
  if (circuitState.state === "HALF_OPEN") {
    circuitState.successes++;
    
    if (circuitState.successes >= cfg.successThreshold) {
      // Recovery confirmed, close the circuit
      circuitState.state = "CLOSED";
      circuitState.failures = 0;
      circuitState.successes = 0;
      circuitState.lastStateChange = now;
      console.log(`[CircuitBreaker] ${provider}: HALF_OPEN -> CLOSED (recovered)`);
    }
  } else if (circuitState.state === "CLOSED") {
    // Reset failure count on success (sliding window)
    const timeSinceLastFailure = now - circuitState.lastFailureTime;
    if (timeSinceLastFailure > cfg.failureWindow) {
      circuitState.failures = 0;
    }
  }
}

/**
 * Record a failed request
 */
export function recordFailure(
  provider: string,
  config: Partial<CircuitBreakerConfig> = {}
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const circuitState = getCircuitState(provider);
  const now = Date.now();
  
  circuitState.lastFailureTime = now;
  
  if (circuitState.state === "HALF_OPEN") {
    // Any failure in HALF_OPEN reopens the circuit
    circuitState.state = "OPEN";
    circuitState.lastStateChange = now;
    console.log(`[CircuitBreaker] ${provider}: HALF_OPEN -> OPEN (still failing)`);
    return;
  }
  
  // In CLOSED state, count failures
  // Reset count if outside failure window
  const timeSinceLastChange = now - circuitState.lastStateChange;
  if (timeSinceLastChange > cfg.failureWindow) {
    circuitState.failures = 1;
  } else {
    circuitState.failures++;
  }
  
  if (circuitState.failures >= cfg.failureThreshold) {
    // Open the circuit
    circuitState.state = "OPEN";
    circuitState.lastStateChange = now;
    console.log(
      `[CircuitBreaker] ${provider}: CLOSED -> OPEN ` +
      `(${circuitState.failures} failures in ${cfg.failureWindow}ms window)`
    );
  }
}

/**
 * Reset circuit breaker state (for testing or manual intervention)
 */
export function resetCircuit(provider: string): void {
  circuitStates.delete(provider);
  console.log(`[CircuitBreaker] ${provider}: Reset to CLOSED`);
}

/**
 * Get all circuit breaker states (for monitoring)
 */
export function getAllCircuitStates(): Record<string, CircuitBreakerState> {
  const states: Record<string, CircuitBreakerState> = {};
  for (const [provider, state] of circuitStates.entries()) {
    states[provider] = { ...state };
  }
  return states;
}

/**
 * Wrapper to execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  provider: string,
  fn: () => Promise<T>,
  config: Partial<CircuitBreakerConfig> = {}
): Promise<T> {
  const check = shouldAllowRequest(provider, config);
  
  if (!check.allowed) {
    throw new CircuitBreakerOpenError(provider, check.reason || "Circuit is open");
  }
  
  try {
    const result = await fn();
    recordSuccess(provider, config);
    return result;
  } catch (error) {
    recordFailure(provider, config);
    throw error;
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  public readonly provider: string;
  public readonly code = "CIRCUIT_BREAKER_OPEN";
  
  constructor(provider: string, message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
    this.provider = provider;
  }
}
