import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth.config';
import { createConvexClient } from '@/lib/convexClient';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';

const convex = createConvexClient();

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
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

    // Get user ID from Convex
    const userId = session.user.id as Id<'users'>;
    const user = await convex.query(api.auth.getUserById, {
      id: userId,
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create capsule with storage ID (not base64 data)
    const capsuleId = await convex.mutation(api.capsules.createCapsule, {
      userId: user._id,
      title,
      sourceType,
      sourcePdfStorageId: sourcePdfStorageId as Id<"_storage"> | undefined,
      sourcePdfName,
      sourcePdfMime,
      sourcePdfSize,
      sourceTopic,
      userPrompt,
    });

    // Trigger AI generation in the background (don't await - it takes several minutes)
    // The action will update the capsule status as it progresses
    convex.action(api.capsules.generateCapsuleContent, {
      capsuleId,
    }).catch((error) => {
      // Log any errors but don't block the response
      console.error('[Capsule Generation] Background generation error:', error);
    });

    return NextResponse.json({
      success: true,
      capsuleId,
      message: 'Capsule created. Generation started in background.',
    });
    
  } catch (error) {
    console.error('Error in create capsule API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
