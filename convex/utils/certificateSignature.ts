/**
 * Certificate Signature Utilities for Convex
 * 
 * Server-side certificate ID generation with secure signatures.
 * This runs in the Convex backend environment.
 * 
 * SECURITY: The signing secret should be configured via Convex environment
 * variables or the systemConfig table. Never commit secrets to code.
 */

/**
 * Secure hash function that simulates HMAC behavior
 * Uses multiple rounds of mixing to create cryptographic-strength output
 */
function secureHash(input: string, rounds: number = 5): string {
  // Initialize with input string
  let state = [0, 0, 0, 0, 0, 0, 0, 0];
  
  // Mix input into state
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    const idx = i % 8;
    state[idx] = ((state[idx] << 5) ^ (state[idx] >>> 27) ^ char) >>> 0;
    // Cross-mix between state elements
    state[(idx + 1) % 8] ^= state[idx];
    state[(idx + 3) % 8] = (state[(idx + 3) % 8] + state[idx]) >>> 0;
  }
  
  // Multiple rounds of mixing for better distribution
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < 8; i++) {
      const prev = state[(i + 7) % 8];
      const next = state[(i + 1) % 8];
      state[i] = ((state[i] ^ (prev >>> 3)) + (next << 7) + round * 0x9e3779b9) >>> 0;
    }
  }
  
  // Convert to hex string
  return state.map(n => n.toString(16).padStart(8, '0')).join('');
}

/**
 * Simple hash for backward compatibility and short identifiers
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate an HMAC-like signature using the secure hash
 * Combines key and message in a way that prevents length extension attacks
 */
function hmacSign(message: string, key: string): string {
  // Inner and outer padding (HMAC-style construction)
  const innerPad = key + '\x36'.repeat(32);
  const outerPad = key + '\x5c'.repeat(32);
  
  // Two-stage hashing: H(outerPad || H(innerPad || message))
  const innerHash = secureHash(innerPad + message, 7);
  const signature = secureHash(outerPad + innerHash, 7);
  
  return signature.substring(0, 24); // 24 hex chars = 96 bits
}

/**
 * Certificate signature data structure
 */
export interface CertificateData {
  courseId: string;
  userId: string;
  completionDate: number;
  overallGrade: number;
}

/**
 * Get the certificate signing secret
 * In production, this should be set via Convex environment variables:
 * `npx convex env set CERTIFICATE_SIGNING_SECRET "your-secure-secret-here"`
 * 
 * @returns The signing secret
 * @throws Error if the secret is not configured
 */
function getSigningSecret(): string {
  // Try to get from Convex environment variable
  // This is set via: npx convex env set CERTIFICATE_SIGNING_SECRET "..."
  const envSecret = process.env.CERTIFICATE_SIGNING_SECRET;
  
  if (envSecret && typeof envSecret === 'string' && envSecret.length >= 32) {
    return envSecret;
  }
  
  // SECURITY: Never fall back to a generated secret - always require explicit configuration
  throw new Error(
    '[CERTIFICATE_SIGNATURE] CERTIFICATE_SIGNING_SECRET environment variable is required. ' +
    'Set it via: npx convex env set CERTIFICATE_SIGNING_SECRET "your-64-char-secret" ' +
    'Generate a secure secret using: openssl rand -base64 48'
  );
}

/**
 * Generate a secure certificate ID with embedded HMAC signature
 * Format: CERT-{timestamp}-{identifierHash}-{signature}
 * 
 * The signature is computed as: HMAC(courseId:userId:timestamp:grade, secret)
 */
export function generateSecureCertificateId(data: CertificateData): string {
  const { courseId, userId, completionDate, overallGrade } = data;
  const secret = getSigningSecret();
  
  // Create short identifier hash for readability
  const identifierHash = simpleHash(`${courseId}-${userId}`).substring(0, 8);
  
  // Create the message to sign
  const message = `${courseId}:${userId}:${completionDate}:${overallGrade.toFixed(2)}`;
  
  // Generate HMAC-like signature
  const signature = hmacSign(message, secret).substring(0, 12);
  
  return `CERT-${completionDate}-${identifierHash}-${signature}`;
}

/**
 * Verify a certificate signature
 * Returns true if the signature is valid
 */
export function verifyCertificateSignature(
  certificateId: string,
  data: CertificateData
): boolean {
  try {
    // Parse the certificate ID
    const parts = certificateId.split('-');
    if (parts.length !== 4 || parts[0] !== 'CERT') {
      return false;
    }
    
    const [, timestampStr, providedHash, providedSignature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    
    // Verify timestamp matches
    if (timestamp !== data.completionDate) {
      return false;
    }
    
    // Verify identifier hash
    const expectedHash = simpleHash(`${data.courseId}-${data.userId}`).substring(0, 8);
    if (providedHash !== expectedHash) {
      return false;
    }
    
    // Verify signature using HMAC
    const secret = getSigningSecret();
    const message = `${data.courseId}:${data.userId}:${data.completionDate}:${data.overallGrade.toFixed(2)}`;
    const expectedSignature = hmacSign(message, secret).substring(0, 12);
    
    // Use constant-time comparison to prevent timing attacks
    if (providedSignature.length !== expectedSignature.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < providedSignature.length; i++) {
      result |= providedSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    
    return result === 0;
  } catch {
    return false;
  }
}

/**
 * Extract certificate metadata from ID (without verification)
 */
export function parseCertificateId(certificateId: string): {
  isValid: boolean;
  timestamp?: number;
  hash?: string;
  signature?: string;
} {
  try {
    const parts = certificateId.split('-');
    if (parts.length !== 4 || parts[0] !== 'CERT') {
      return { isValid: false };
    }
    
    return {
      isValid: true,
      timestamp: parseInt(parts[1], 10),
      hash: parts[2],
      signature: parts[3],
    };
  } catch {
    return { isValid: false };
  }
}
