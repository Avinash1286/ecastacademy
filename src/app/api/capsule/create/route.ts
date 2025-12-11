import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth.config';
import { createConvexClient } from '@/lib/convexClient';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { withRateLimitByUser, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit';
import { logger } from '@/lib/logging/logger';

// =============================================================================
// Input Sanitization
// =============================================================================

/** Maximum length for user prompts */
const MAX_USER_PROMPT_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;
const MAX_TOPIC_LENGTH = 500;

/**
 * Sanitize user input to prevent prompt injection and XSS
 * - Trims whitespace
 * - Removes potentially dangerous characters
 * - Limits length
 */
function sanitizeInput(input: string | undefined, maxLength: number): string | undefined {
  if (!input) return undefined;

  return input
    .trim()
    .slice(0, maxLength)
    // Remove potential script tags and HTML
    .replace(/<[^>]*>/g, '')
    // Remove common prompt injection patterns
    .replace(/\b(ignore|forget|disregard)\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/gi, '')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validate and sanitize the title
 */
function sanitizeTitle(title: string): string {
  const sanitized = sanitizeInput(title, MAX_TITLE_LENGTH);
  if (!sanitized || sanitized.length < 3) {
    throw new Error('Title must be at least 3 characters long');
  }
  return sanitized;
}

export async function POST(request: NextRequest) {
  // Authenticate first - we need user ID for per-user rate limiting
  const session = await auth();
  if (!session?.user?.clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Apply per-user rate limiting for capsule creation (expensive AI operation)
  const rateLimitResult = await withRateLimitByUser(
    session.user.clerkId,
    RATE_LIMIT_PRESETS.CAPSULE_CREATE,
    'capsule-create'
  );
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        },
      }
    );
  }
  
    // Capture Bearer token from the caller to authorize Convex mutations
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  try {
    const {
      title,
      sourceType,
      sourcePdfStorageId, // New: Convex storage ID for large PDFs
      sourcePdfName,
      sourcePdfMime,
      sourcePdfSize,
      sourceTopic,
      userPrompt,
    } = body;

    if (!title || !sourceType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate sourceType
    if (sourceType !== 'pdf' && sourceType !== 'topic') {
      return NextResponse.json(
        { error: 'Invalid source type. Must be "pdf" or "topic".' },
        { status: 400 }
      );
    }

    if (sourceType === 'pdf' && (!sourcePdfStorageId || !sourcePdfName || !sourcePdfMime)) {
      return NextResponse.json(
        { error: 'PDF source is missing required data or metadata' },
        { status: 400 }
      );
    }

    if (sourceType === 'topic' && !sourceTopic?.trim()) {
      return NextResponse.json(
        { error: 'Topic source requires non-empty text' },
        { status: 400 }
      );
    }

    // Sanitize all user inputs
    let sanitizedTitle: string;
    try {
      sanitizedTitle = sanitizeTitle(title);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid title' },
        { status: 400 }
      );
    }

    const sanitizedTopic = sanitizeInput(sourceTopic, MAX_TOPIC_LENGTH);
    const sanitizedUserPrompt = sanitizeInput(userPrompt, MAX_USER_PROMPT_LENGTH);

    // Get user from Convex using Clerk ID (more reliable than session.user.id which requires prior sync)
    const convex = createConvexClient({ userToken: bearer });
    
    // First try to get user by Clerk ID
    let user = await convex.query(api.clerkAuth.getOwnUserByClerkId, {
      clerkId: session.user.clerkId,
    });

    // If user doesn't exist, trigger a sync and try again
    if (!user) {
      try {
        await convex.mutation(api.clerkAuth.syncUser, {});
        user = await convex.query(api.clerkAuth.getOwnUserByClerkId, {
          clerkId: session.user.clerkId,
        });
      } catch (syncError) {
        logger.error('Failed to sync user during capsule creation', { clerkId: session.user.clerkId }, syncError as Error);
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User profile not found. Please sign out and sign in again.' },
        { status: 404 }
      );
    }

    // Create capsule with storage ID (not base64 data) and sanitized inputs
      const capsuleId = await convex.mutation(api.capsules.createCapsule, {
      userId: user._id,
      title: sanitizedTitle,
      sourceType,
      sourcePdfStorageId: sourcePdfStorageId as Id<"_storage"> | undefined,
      sourcePdfName,
      sourcePdfMime,
      sourcePdfSize,
      sourceTopic: sanitizedTopic,
      userPrompt: sanitizedUserPrompt,
    });

    // Trigger AI generation in the background (don't await - it takes several minutes)
    // The action will update the capsule status as it progresses
    convex.action(api.capsules.generateCapsuleContent, {
      capsuleId,
    }).catch(async (error) => {
      // Log error and update capsule status so user can see the failure
      logger.error('[Capsule Generation] Background generation error', { capsuleId }, error as Error);

      // Update capsule status to failed (HIGH-4 fix: don't silently swallow errors)
      try {
        await convex.mutation(api.capsules.markCapsuleGenerationFailed, {
          capsuleId,
          userId: user._id,
          errorMessage: error instanceof Error ? error.message : 'Generation failed unexpectedly',
        });
      } catch (updateError) {
        logger.error('[Capsule Generation] Failed to update status', { capsuleId }, updateError as Error);
      }
    });

    return NextResponse.json({
      success: true,
      capsuleId,
      message: 'Capsule created. Generation started in background.',
    });

  } catch (error) {
    logger.error('Error in create capsule API', undefined, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
