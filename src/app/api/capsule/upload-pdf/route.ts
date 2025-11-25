import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth.config';
import { createConvexClient } from '@/lib/convexClient';
import { api } from '../../../../../convex/_generated/api';

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024; // 15MB safeguard

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Read PDF file as buffer
    const bytes = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Convex storage for files of any size
    const convex = createConvexClient();
    
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
      console.error('Failed to upload to Convex storage:', await uploadResponse.text());
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
    console.error('Error in upload-pdf API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
