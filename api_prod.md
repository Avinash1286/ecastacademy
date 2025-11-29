# API Security Audit Report - ECAST Academy

**Date:** November 29, 2025  
**Auditor:** Security Analysis  
**Scope:** All API routes in `/src/app/api/`

---

## Executive Summary

This report provides a comprehensive security analysis of the ECAST Academy API endpoints. The analysis covers authentication, authorization, rate limiting, input validation, and potential vulnerabilities that could lead to unauthorized access or DDoS attacks.

### Risk Severity Levels
- 🔴 **CRITICAL** - Immediate action required, potential for severe damage
- 🟠 **HIGH** - Should be addressed urgently
- 🟡 **MEDIUM** - Should be addressed in the near term
- 🟢 **LOW** - Minor issues, can be addressed when convenient

---

## Overall Security Posture

### ✅ Positive Findings

1. **Rate Limiting Implementation** - All API routes have rate limiting configured
2. **Authentication** - Most sensitive endpoints require authentication
3. **Input Validation** - JSON parsing is handled with try-catch blocks
4. **CSRF Protection** - State-changing API routes have CSRF protection in middleware
5. **Security Headers** - CSP, X-Frame-Options, X-Content-Type-Options are configured
6. **Body Size Limits** - Request body size limits are enforced in middleware
7. **Logging** - Structured logging is implemented for error tracking

---

## Critical and High Severity Issues

### 🔴 CRITICAL-1: Health Endpoint Leaks Sensitive Information

**File:** `/src/app/api/health/route.ts`

**Issue:** The health endpoint exposes internal system information without authentication:
- Missing environment variable names
- Memory usage statistics
- Database response times
- Version information
- System uptime

**Risk:** An attacker can use this information for reconnaissance to plan attacks.

**Current Code:**
```typescript
export async function GET(): Promise<NextResponse<HealthStatus>> {
  // No authentication required
  // Returns detailed system information
}
```

**Recommendation:**
1. Remove sensitive information from public health endpoint
2. Create a separate `/api/admin/health` endpoint with full details requiring admin auth
3. Public endpoint should only return `{ status: "healthy" | "unhealthy" }`

---

### 🔴 CRITICAL-2: Inconsistent Authorization in Admin Panel

**File:** `/src/app/api/admin/users/route.ts` + `/convex/admin.ts`

**Issue:** The admin user listing relies on a `currentUserId` passed from the client:
```typescript
export const listUsers = query({
  args: {
    currentUserId: v.id("users"),  // Client-provided, can be spoofed!
    ...
  },
  handler: async (ctx, args) => {
    await requireAdminLegacy(ctx, args.currentUserId);  // Uses client-provided ID
  }
});
```

**Risk:** While the API route checks session authentication, the Convex query accepts a user-provided `currentUserId`. An attacker with a valid session could potentially pass another user's ID.

**Recommendation:**
1. Remove `currentUserId` from function arguments
2. Use `requireAuthenticatedUser(ctx)` to get the current user from the authentication context
3. Deprecate `requireAdminLegacy` function completely

---

### 🟠 HIGH-1: Rate Limit Configuration Fail-Open Behavior

**File:** `/src/lib/security/rateLimit.ts`

**Issue:** When Redis is unavailable, the rate limiter fails open (allows all requests):
```typescript
// On Redis error, allow the request (fail open for availability)
return {
  success: true,
  limit: config.maxRequests,
  remaining: config.maxRequests - 1,
  reset: now + config.interval,
};
```

**Risk:** An attacker can potentially overwhelm Redis or wait for Redis outages to bypass rate limiting entirely.

**Recommendation:**
1. Implement a circuit breaker pattern
2. Fall back to in-memory rate limiting when Redis fails
3. Add alerting when Redis rate limiting fails
4. Consider a fail-closed policy for sensitive endpoints (auth, admin)

---

### 🟠 HIGH-2: In-Memory Rate Limiting Not Production-Safe

**File:** `/src/lib/security/rateLimit.ts`

**Issue:** In production without Redis configured, the rate limiting falls back to in-memory storage:
```typescript
if (process.env.NODE_ENV === "production" && !isRedisConfigured) {
  console.warn("[RATE_LIMIT] Warning: Redis not configured in production...");
}
return rateLimitInMemory(identifier, config);
```

**Risk:** In a multi-instance deployment (e.g., Vercel with multiple serverless functions), rate limits won't be shared across instances. An attacker can bypass rate limits by hitting different instances.

**Recommendation:**
1. Make Redis **required** for production deployments
2. Fail the application startup if Redis is not configured in production
3. Document this requirement clearly

---

### 🟠 HIGH-3: Transcript API Lacks Authentication

**File:** `/src/app/api/transcript/route.ts`

**Issue:** The transcript endpoint only has rate limiting but no authentication:
```typescript
export async function GET(request: NextRequest) {
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.TRANSCRIPT);
  if (rateLimitResponse) return rateLimitResponse;
  // No authentication check!
  ...
}
```

**Risk:** 
- Unauthenticated users can fetch transcripts
- Potential for data scraping
- YouTube API costs incurred by unauthorized users

**Recommendation:**
1. Add authentication requirement
2. Consider caching transcripts to reduce API calls

---

### 🟠 HIGH-4: YouTube API Route Lacks Authentication

**File:** `/src/app/api/youtube/route.ts`

**Issue:** The YouTube API proxy has no authentication:
```typescript
export async function GET(request: NextRequest) {
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.YOUTUBE);
  // No auth check - anyone can use this as a YouTube API proxy
}
```

**Risk:**
- Anyone can use your server as a YouTube API proxy
- Exhaustion of YouTube API quota
- Potential for abuse and increased costs

**Recommendation:**
1. Add authentication requirement
2. Consider additional per-user rate limiting

---

### 🟠 HIGH-5: Middleware CSRF Bypass via Path Matching

**File:** `/middleware.ts`

**Issue:** CSRF protection can be bypassed due to path exemptions:
```typescript
const CSRF_EXEMPT_PATHS = ["/api/auth", "/api/webhooks", "/api/health"];
```

The `/api/auth` exemption is too broad and exempts the entire auth namespace from CSRF protection.

**Risk:** While auth routes may need exemption for OAuth flows, this could potentially be exploited.

**Recommendation:**
1. Make exemptions more specific: `["/api/auth/[...nextauth]", "/api/webhooks", "/api/health"]`
2. Ensure forgot-password and reset-password have CSRF protection

---

## Medium Severity Issues

### 🟡 MEDIUM-1: Certificate Verify Endpoint Information Disclosure

**File:** `/src/app/api/certificates/verify/route.ts`

**Issue:** The certificate verification endpoint returns detailed certificate information:
```typescript
return NextResponse.json({
  valid: true,
  certificate: {
    courseName: result.certificate?.courseName,
    recipientName: result.certificate?.userName,
    completionDate: result.certificate?.completionDate,
    grade: result.certificate?.overallGrade,
    issuedAt: result.certificate?.issuedAt,
  },
});
```

**Risk:** While this is a public verification endpoint, it reveals:
- User's full name
- Course names
- Grades achieved
- Completion dates

An attacker could enumerate certificate IDs to collect this data.

**Recommendation:**
1. Only return minimal information (valid/invalid status)
2. Require the certificate holder to consent to displaying detailed information
3. Implement CAPTCHA for high-volume verification requests

---

### 🟡 MEDIUM-2: Password Reset Token Predictability

**File:** `/src/lib/auth/utils.ts`

**Issue:** Password reset tokens use UUID v4:
```typescript
export function generateToken(): string {
  return randomUUID();
}
```

While UUID v4 is random, it's not designed for security tokens and has only ~122 bits of entropy.

**Recommendation:**
1. Use `crypto.randomBytes(32).toString('hex')` for 256-bit tokens
2. Store tokens hashed (SHA-256) in the database
3. Implement token expiration validation strictly

---

### 🟡 MEDIUM-3: Verbose Error Messages in Development

**File:** Multiple API routes

**Issue:** Some error handlers return detailed error messages:
```typescript
// /api/ai/tutor-chat/route.ts
const message = error instanceof Error ? error.message : "Something went wrong...";
return NextResponse.json({ error: message }, { status });
```

**Risk:** Error messages may leak implementation details, stack traces, or internal paths.

**Recommendation:**
1. Only return generic error messages in production
2. Log detailed errors server-side
3. Use error codes for client-side error handling

---

### 🟡 MEDIUM-4: Course Chapters API Missing Ownership Validation

**File:** `/src/app/api/courses/[courseId]/chapters/route.ts`

**Issue:** The chapters endpoint returns data without verifying if the user should have access:
```typescript
export async function GET(request: NextRequest, context: ...) {
  // Only rate limiting, no auth or ownership check
  const chapters = await getCourseChapters(courseId as Id<"courses">);
  return NextResponse.json(chapters, { status: 200 });
}
```

**Risk:** Anyone can enumerate course IDs and retrieve chapter information.

**Recommendation:**
1. Verify user enrollment before returning chapter data
2. Or confirm this is intentionally public data

---

### 🟡 MEDIUM-5: Missing Rate Limit per User for Authenticated Routes

**File:** `/src/lib/security/rateLimit.ts`

**Issue:** Rate limiting is based on IP address only:
```typescript
function getIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  // Only IP-based identification
}
```

**Risk:** 
- An attacker behind a large NAT (university, corporate network) affects legitimate users
- Authenticated users share rate limits with unauthenticated users from the same IP

**Recommendation:**
1. For authenticated endpoints, use user ID as the rate limit identifier
2. Implement tiered rate limits: stricter for anonymous, lenient for authenticated
3. Use `withRateLimitByUser` function that already exists but isn't used

---

### 🟡 MEDIUM-6: Course Single Endpoint Lacks Caching Headers

**File:** `/src/app/api/courses/[courseId]/single/route.ts`

**Issue:** The course details endpoint has no caching:
```typescript
export async function GET(...) {
  // No cache headers set
  return NextResponse.json(courseDetails);
}
```

**Risk:** Every request hits the database, making DDoS more effective.

**Recommendation:**
1. Add appropriate cache headers: `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`
2. Consider edge caching for public course data

---

## Low Severity Issues

### 🟢 LOW-1: Console.log Statements in Production Code ✅ FIXED

**Files:** Multiple API routes

**Issue:** Several files use `console.log` or `console.error` instead of the structured logger:
```typescript
// /api/courses/[courseId]/chapters/[chapterId]/route.ts
console.log('Chapter details from Convex:', {...});
```

**Fix Applied:**
Replaced all `console.*` calls with structured `logger` from `@/lib/logging/logger`:
```typescript
import { logger } from '@/lib/logging/logger';

// Before
console.log('Chapter details from Convex:', {...});

// After  
logger.debug('Chapter details retrieved', { chapterId, hasNotes, hasQuiz });
```

**Files Updated:**
- `/src/app/api/courses/[courseId]/chapters/[chapterId]/route.ts`
- `/src/app/api/courses/[courseId]/chapters/route.ts`
- `/src/app/api/courses/[courseId]/single/route.ts`
- `/src/app/api/courses/[courseId]/modify/route.ts`
- `/src/app/api/courses/route.ts`
- `/src/app/api/course/create/route.ts`
- `/src/app/api/course/create-from-videos/route.ts`

---

### 🟢 LOW-2: Missing Request Timeout Configuration ✅ FIXED

**Issue:** No explicit timeout configuration for external API calls (YouTube, AI services).

**Risk:** Slow responses can tie up resources and amplify DDoS effects.

**Fix Applied:**
Added `fetchWithTimeout` utility with AbortController:
```typescript
const EXTERNAL_API_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, timeoutMs: number = EXTERNAL_API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

Added timeout error handling:
```typescript
if (error instanceof Error && error.name === 'AbortError') {
  return NextResponse.json({ error: 'Request timed out. Please try again.' }, { status: 504 });
}
```

**Files Updated:**
- `/src/app/api/youtube/route.ts` - All external YouTube API calls now have 15s timeout

---

### 🟢 LOW-3: Missing Input Length Validation

**Files:** Various AI and creation routes

**Issue:** While there's some input sanitization, maximum length validation varies:
```typescript
// /api/capsule/create/route.ts - Good
const MAX_USER_PROMPT_LENGTH = 2000;

// /api/ai/generate-quiz/route.ts - Notes field has no length limit
const { notes, title } = body;
if (!notes) { ... }  // Only checks if exists
```

**Status:** Partial - Some endpoints have limits, others don't. Consider standardizing.

**Recommendation:**
1. Standardize input length limits across all endpoints
2. Document maximum field lengths in API documentation

---

### 🟢 LOW-4: Potential Integer Overflow in Pagination ✅ FIXED

**File:** `/src/app/api/courses/route.ts`

**Issue:** Pagination limit is parsed without bounds checking:
```typescript
const limit = parseInt(searchParams.get('limit') || '9', 10);
```

**Risk:** Extremely large limits could cause resource exhaustion.

**Fix Applied:**
```typescript
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 9;

const requestedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
const limit = Math.min(Math.max(isNaN(requestedLimit) ? DEFAULT_LIMIT : requestedLimit, MIN_LIMIT), MAX_LIMIT);
```

---

### 🟢 LOW-5: CORS Not Explicitly Configured ✅ ALREADY ADDRESSED

**Issue:** CORS configuration needs review.

**Status:** Already configured in `next.config.ts`:
```typescript
headers: [
  {
    key: 'Access-Control-Allow-Origin',
    value: process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? '' : '*'),
  },
  // ... other CORS headers
],
```

The configuration:
- Uses environment variable for allowed origin in production
- Falls back to empty string (no CORS) in production if not configured
- Only allows `*` in development
- Includes proper `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`

---

## Rate Limiting Analysis Summary

| Endpoint | Rate Limit | Auth Required | Risk Assessment |
|----------|------------|---------------|-----------------|
| `/api/ai/generate-notes` | 10/min | ✅ Yes | 🟢 Low |
| `/api/ai/generate-quiz` | 10/min | ✅ Yes | 🟢 Low |
| `/api/ai/generate-text-quiz` | 10/min | ✅ Yes | 🟢 Low |
| `/api/ai/tutor-chat` | 10/min | ✅ Yes | 🟢 Low |
| `/api/admin/users` | 30/min | ✅ Yes | 🟡 Medium (legacy auth) |
| `/api/auth/forgot-password` | 5/5min | ❌ No | 🟢 Low |
| `/api/auth/reset-password` | 5/5min | ❌ No | 🟢 Low |
| `/api/capsule/create` | 5/min | ✅ Yes | 🟢 Low |
| `/api/capsule/upload-pdf` | 5/min | ✅ Yes | 🟢 Low |
| `/api/certificates/generate-pdf` | 5/min | ✅ Yes | 🟢 Low |
| `/api/certificates/verify` | 5/min | ❌ No | 🟡 Medium |
| `/api/chat` | 10/min | ✅ Yes | 🟢 Low |
| `/api/course/create` | 10/min | ✅ Yes | 🟢 Low |
| `/api/course/create-from-videos` | 10/min | ✅ Yes | 🟢 Low |
| `/api/courses` | 60/min | ❌ No | 🟢 Low |
| `/api/courses/[id]/chapters` | 60/min | ❌ No | 🟡 Medium |
| `/api/courses/[id]/modify` | 10/min | ✅ Yes | 🟢 Low |
| `/api/courses/[id]/single` | 60/min | ❌ No | 🟢 Low |
| `/api/health` | ❌ None | ❌ No | 🔴 Critical |
| `/api/transcript` | 20/min | ❌ No | 🟠 High |
| `/api/videos/create` | 15/min | ✅ Yes | 🟢 Low |
| `/api/youtube` | 30/min | ❌ No | 🟠 High |

---

## DDoS Vulnerability Assessment

### Current Protections
1. ✅ Rate limiting on all major endpoints
2. ✅ Request body size limits in middleware
3. ✅ Security headers (mitigate certain attacks)

### Vulnerabilities
1. **No WAF/CDN protection** - Consider Cloudflare or similar
2. **Health endpoint unprotected** - Easy target for enumeration
3. **Public endpoints** - `/api/courses`, `/api/transcript`, `/api/youtube` are targets
4. **No IP blocking** - No mechanism to block abusive IPs
5. **In-memory rate limits** - Can be bypassed in multi-instance deployments

### Recommendations
1. **Implement edge protection** (Cloudflare, AWS WAF)
2. **Add IP blocking capability** for known attackers
3. **Implement request signing** for API calls from your frontend
4. **Add CAPTCHA** for anonymous endpoints
5. **Require Redis** for rate limiting in production
6. **Add circuit breakers** for external service calls

---

## Remediation Priority

### Immediate (P0) - Fix within 24-48 hours
1. [CRITICAL-1] Secure health endpoint
2. [CRITICAL-2] Fix admin authorization bypass potential

### Urgent (P1) - Fix within 1 week
1. [HIGH-1] Improve rate limit fail behavior
2. [HIGH-2] Require Redis in production
3. [HIGH-3] Add auth to transcript API
4. [HIGH-4] Add auth to YouTube API
5. [HIGH-5] Fix CSRF exemption paths

### Soon (P2) - Fix within 2 weeks
1. [MEDIUM-1] Reduce certificate verification info
2. [MEDIUM-2] Improve password reset tokens
3. [MEDIUM-3] Sanitize production error messages
4. [MEDIUM-4] Add course ownership validation
5. [MEDIUM-5] Implement per-user rate limiting
6. [MEDIUM-6] Add caching headers

### Backlog (P3) - Fix when convenient
1. [LOW-1] Replace console.log with logger
2. [LOW-2] Add request timeouts
3. [LOW-3] Standardize input validation
4. [LOW-4] Fix pagination bounds
5. [LOW-5] Configure CORS explicitly

---

## Remediation Status Summary

### ✅ COMPLETED FIXES

| Issue ID | Severity | Description | Status |
|----------|----------|-------------|--------|
| CRITICAL-1 | 🔴 | Health endpoint info leak | ✅ Fixed |
| CRITICAL-2 | 🔴 | Admin auth bypass | ✅ Fixed |
| HIGH-1 | 🟠 | Rate limit fail-open | ✅ Fixed |
| HIGH-2 | 🟠 | Redis production warning | ✅ Fixed |
| HIGH-3 | 🟠 | Transcript API auth | ✅ Fixed |
| HIGH-4 | 🟠 | YouTube API auth | ✅ Fixed |
| HIGH-5 | 🟠 | CSRF exemption paths | ✅ Fixed |
| MEDIUM-1 | 🟡 | Certificate PII exposure | ✅ Fixed |
| MEDIUM-2 | 🟡 | Password reset tokens | ✅ Fixed |
| MEDIUM-3 | 🟡 | Verbose error messages | ✅ Fixed |
| MEDIUM-5 | 🟡 | Per-user rate limiting | ✅ Fixed |
| MEDIUM-6 | 🟡 | Caching headers | ✅ Fixed |
| LOW-1 | 🟢 | Console.log usage | ✅ Fixed |
| LOW-2 | 🟢 | Request timeouts | ✅ Fixed |
| LOW-4 | 🟢 | Pagination bounds | ✅ Fixed |
| LOW-5 | 🟢 | CORS configuration | ✅ Already configured |

### ⏳ REMAINING ITEMS

| Issue ID | Severity | Description | Notes |
|----------|----------|-------------|-------|
| MEDIUM-4 | 🟡 | Course ownership validation | Already implemented in modify routes |
| LOW-3 | 🟢 | Standardize input validation | Partial - some endpoints have limits |

---

## Appendix: Security Checklist

### Authentication
- [x] Sessions use JWTs with proper signing
- [x] Password hashing uses bcrypt with cost factor 12
- [x] OAuth integrations follow best practices
- [x] Password reset tokens use 256-bit cryptographic randomness
- [ ] JWT refresh tokens (not implemented, using session expiry)
- [ ] Account lockout after failed attempts (not implemented)

### Authorization
- [x] Admin routes check admin role via session
- [x] Resource ownership validation (implemented on modify/delete)
- [ ] RBAC for granular permissions (only user/admin roles)

### Input Validation
- [x] JSON parsing protected
- [x] File upload validation (PDF)
- [x] Pagination bounds checking
- [ ] Consistent length limits (partially implemented)
- [ ] Schema validation on all inputs (some endpoints use Zod)

### Rate Limiting
- [x] All endpoints have rate limits
- [x] Preset configurations for different endpoint types
- [x] Per-user rate limiting on AI endpoints
- [x] In-memory fallback with security warnings
- [ ] IP blocking capability (not implemented)

### Logging & Monitoring
- [x] Structured logging implemented
- [x] Console.log replaced with structured logger
- [ ] Security event alerting (not implemented)
- [ ] Rate limit breach notifications (not implemented)

### Network Security
- [x] CORS explicitly configured
- [x] External API request timeouts (15s)
- [x] Security headers configured
- [ ] WAF protection (recommend Cloudflare)

---

**Report Generated:** November 29, 2025  
**Last Updated:** November 29, 2025  
**Next Review:** Recommended after deploying fixes to production
