import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth.config';
import { createConvexClient } from '@/lib/convexClient';
import { api } from '../../../../../convex/_generated/api';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit';
import { logger } from '@/lib/logging/logger';

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024; // 15MB safeguard
const MIN_PDF_SIZE_BYTES = 1024; // 1KB minimum - reject suspiciously small files

// PDF magic bytes (first 4 bytes should be %PDF)
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

/**
 * Validate PDF file structure
 * - Checks magic bytes (file header)
 * - Validates basic PDF structure
 */
function validatePdfStructure(buffer: Buffer): { valid: boolean; error?: string } {
  // Check minimum size
  if (buffer.length < MIN_PDF_SIZE_BYTES) {
    return { valid: false, error: 'File is too small to be a valid PDF' };
  }

  // Check PDF magic bytes (%PDF)
  for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
    if (buffer[i] !== PDF_MAGIC_BYTES[i]) {
      return { valid: false, error: 'File does not have valid PDF header' };
    }
  }

  // Check for PDF version (should be like %PDF-1.x or %PDF-2.x)
  const headerStr = buffer.subarray(0, 10).toString('ascii');
  const versionMatch = headerStr.match(/%PDF-(\d+\.\d+)/);
  if (!versionMatch) {
    return { valid: false, error: 'Invalid PDF version header' };
  }

  // Check for %%EOF at the end (with some tolerance for trailing whitespace)
  const tailLength = Math.min(1024, buffer.length);
  const tail = buffer.subarray(buffer.length - tailLength).toString('ascii');
  if (!tail.includes('%%EOF')) {
    return { valid: false, error: 'PDF file appears to be truncated or corrupted (missing EOF marker)' };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  // Apply rate limiting for file uploads
  const rateLimitResponse = await withRateLimit(request, RATE_LIMIT_PRESETS.CAPSULE_CREATE);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the incoming Bearer token for Convex auth when available
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;

    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File;

    if (!pdfFile) {
      return NextResponse.json(
        { error: 'No PDF file provided' },
        { status: 400 }
      );
    }

    if (pdfFile.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    if (pdfFile.size > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'PDF file is too large. Please upload a file under 15MB.' },
        { status: 413 }
      );
    }

    if (pdfFile.size < MIN_PDF_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'PDF file is too small. Please upload a valid PDF.' },
        { status: 400 }
      );
    }

    // Read PDF file as buffer
    const bytes = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate PDF structure (MEDIUM-2 fix: PDF content validation)
    const validation = validatePdfStructure(buffer);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid PDF file' },
        { status: 400 }
      );
    }

    // Upload to Convex storage for files of any size
    const convex = createConvexClient({ userToken: bearer });

    // Step 1: Get upload URL from Convex
    const uploadUrl = await convex.mutation(api.capsules.generateUploadUrl);

    // Step 2: Upload the file to Convex storage
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': pdfFile.type,
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      logger.error('Failed to upload to Convex storage', { status: uploadResponse.status });
      return NextResponse.json(
        { error: 'Failed to upload PDF to storage' },
        { status: 500 }
      );
    }

    const { storageId } = await uploadResponse.json();

    // Return the storage ID - the capsule will reference this
    return NextResponse.json({
      success: true,
      storageId,
      fileName: pdfFile.name,
      fileSize: pdfFile.size,
      mimeType: pdfFile.type,
    });

  } catch (error) {
    logger.error('Error in upload-pdf API', undefined, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
