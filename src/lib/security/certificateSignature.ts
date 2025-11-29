/**
 * Certificate Signature Utilities
 * 
 * Implements HMAC-based signatures for certificate verification.
 * This prevents certificate ID forgery and ensures authenticity.
 */

import crypto from 'crypto';

// Secret key for HMAC signing - MUST be set in environment variables
function getCertificateSecret(): string {
  const secret = process.env.CERTIFICATE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'CERTIFICATE_SECRET_KEY environment variable is required. ' +
      'Generate a secure key using: openssl rand -base64 32'
    );
  }
  return secret;
}

// Validate at module load time in production
const CERTIFICATE_SECRET: string = getCertificateSecret();

/**
 * Data structure for certificate signing
 */
export interface CertificateSignatureData {
  courseId: string;
  userId: string;
  completionDate: number;
  overallGrade: number;
}

/**
 * Generate a unique certificate ID with HMAC signature
 * Format: {timestamp}-{shortHash}-{signature}
 */
export function generateCertificateId(data: CertificateSignatureData): string {
  const timestamp = data.completionDate;

  // Create a payload string for hashing
  const payload = `${data.courseId}:${data.userId}:${data.completionDate}:${data.overallGrade.toFixed(2)}`;

  // Generate short identifier hash (first 8 chars)
  const identifierHash = crypto
    .createHash('sha256')
    .update(`${data.courseId}-${data.userId}`)
    .digest('hex')
    .substring(0, 8);

  // Generate HMAC signature
  const signature = crypto
    .createHmac('sha256', CERTIFICATE_SECRET)
    .update(payload)
    .digest('base64url')
    .substring(0, 16); // Use first 16 chars for reasonable length

  return `CERT-${timestamp}-${identifierHash}-${signature}`;
}

/**
 * Verify a certificate signature
 * Returns true if the signature is valid, false otherwise
 */
export function verifyCertificateSignature(
  certificateId: string,
  data: CertificateSignatureData
): boolean {
  try {
    // Parse the certificate ID
    const parts = certificateId.split('-');
    if (parts.length !== 4 || parts[0] !== 'CERT') {
      return false;
    }

    const [, timestamp, identifierHash, providedSignature] = parts;

    // Verify timestamp matches
    if (parseInt(timestamp) !== data.completionDate) {
      return false;
    }

    // Verify identifier hash
    const expectedIdentifierHash = crypto
      .createHash('sha256')
      .update(`${data.courseId}-${data.userId}`)
      .digest('hex')
      .substring(0, 8);

    if (identifierHash !== expectedIdentifierHash) {
      return false;
    }

    // Verify HMAC signature
    const payload = `${data.courseId}:${data.userId}:${data.completionDate}:${data.overallGrade.toFixed(2)}`;
    const expectedSignature = crypto
      .createHmac('sha256', CERTIFICATE_SECRET)
      .update(payload)
      .digest('base64url')
      .substring(0, 16);

    return crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Create a verification token for public certificate validation
 * This can be shared publicly and used to verify certificate authenticity
 */
export function createVerificationToken(certificateId: string, userId: string): string {
  const payload = `${certificateId}:${userId}`;
  return crypto
    .createHmac('sha256', CERTIFICATE_SECRET)
    .update(payload)
    .digest('base64url');
}

/**
 * Verify a public verification token
 */
export function verifyVerificationToken(
  certificateId: string,
  userId: string,
  token: string
): boolean {
  try {
    const expectedToken = createVerificationToken(certificateId, userId);
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expectedToken)
    );
  } catch {
    return false;
  }
}
