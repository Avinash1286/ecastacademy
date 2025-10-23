# AI Integration Guide for Background Jobs

## Overview
This guide explains how to integrate external AI APIs with the Convex background job system for automatic notes and quiz generation.

## Architecture

### Flow Diagram
```
User Creates Video
    ↓
Video saved with status='pending'
    ↓
processVideo action triggered
    ↓
Background job scheduled
    ↓
processVideoInternal runs
    ↓
Status: 'processing'
    ↓
Call External AI APIs
    ↓
Generate Notes & Quiz
    ↓
Save to Database
    ↓
Status: 'completed' or 'failed'
```

## Required Environment Variables

Add to `.env.local`:
```env
NOTES_GENERATION_ENDPOINT=https://your-api.com/generate-notes
QUIZ_GENERATION_ENDPOINT=https://your-api.com/generate-quiz
```

## AI API Requirements

### Notes Generation API

**Endpoint**: `NOTES_GENERATION_ENDPOINT`

**Request**:
```json
{
  "transcript": "Full video transcript text...",
  "title": "Video title"
}
```

**Response**:
```json
{
  "topic": "Main topic of the video",
  "sections": [
    {
      "title": "Introduction",
      "content": [
        {
          "type": "paragraph",
          "text": "Content here..."
        },
        {
          "type": "highlight",
          "text": "Important point",
          "color": "yellow"
        },
        {
          "type": "code",
          "language": "javascript",
          "code": "console.log('example');"
        }
      ]
    }
  ]
}
```

### Quiz Generation API

**Endpoint**: `QUIZ_GENERATION_ENDPOINT`

**Request**:
```json
{
  "notes": "{...notes object as string...}",
  "title": "Video title"
}
```

**Response**:
```json
{
  "topic": "Quiz topic",
  "questions": [
    {
      "question": "What is React?",
      "options": [
        "A JavaScript library",
        "A programming language",
        "A database",
        "An operating system"
      ],
      "correctAnswer": 0,
      "explanation": "React is a JavaScript library for building user interfaces."
    }
  ]
}
```

## Implementation Options

### Option 1: Use Existing AI Service (Recommended)

If you have existing AI endpoints:

1. Update environment variables
2. Test the endpoints match the expected format
3. Background jobs will work automatically

### Option 2: Create AI Service

If you need to create AI endpoints, here are example implementations:

#### Using OpenAI API

Create API routes in your Next.js app:

**File**: `src/app/api/ai/generate-notes/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { transcript, title } = await request.json();

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating educational notes from video transcripts. Format notes with clear sections, highlights, code blocks, and definitions."
        },
        {
          role: "user",
          content: `Create detailed notes from this video transcript.
Title: ${title}

Transcript:
${transcript}

Format the response as JSON with:
- topic: main topic
- sections: array of sections with title and content blocks (paragraph, highlight, code, definition, callout)`
        }
      ],
      response_format: { type: "json_object" }
    });

    const notes = JSON.parse(completion.choices[0].message.content || '{}');
    return NextResponse.json(notes);
  } catch (error) {
    console.error('Error generating notes:', error);
    return NextResponse.json(
      { error: 'Failed to generate notes' },
      { status: 500 }
    );
  }
}
```

**File**: `src/app/api/ai/generate-quiz/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { notes, title } = await request.json();

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating educational quizzes from notes. Create challenging but fair questions with clear explanations."
        },
        {
          role: "user",
          content: `Create a quiz based on these notes.
Title: ${title}

Notes:
${notes}

Format the response as JSON with:
- topic: quiz topic
- questions: array with question, options, correctAnswer (index), and explanation`
        }
      ],
      response_format: { type: "json_object" }
    });

    const quiz = JSON.parse(completion.choices[0].message.content || '{}');
    return NextResponse.json(quiz);
  } catch (error) {
    console.error('Error generating quiz:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}
```

**Environment Variables**:
```env
OPENAI_API_KEY=sk-...
NOTES_GENERATION_ENDPOINT=http://localhost:3000/api/ai/generate-notes
QUIZ_GENERATION_ENDPOINT=http://localhost:3000/api/ai/generate-quiz
```

### Option 3: Mock AI Service (For Testing)

For development/testing without AI costs:

**File**: `src/app/api/ai/mock-notes/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { title } = await request.json();
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return NextResponse.json({
    topic: title,
    sections: [
      {
        title: "Overview",
        content: [
          {
            type: "paragraph",
            text: "This is a mock notes section generated for testing."
          },
          {
            type: "highlight",
            text: "Key point: This demonstrates the notes structure.",
            color: "yellow"
          }
        ]
      },
      {
        title: "Key Concepts",
        content: [
          {
            type: "paragraph",
            text: "Mock content for demonstration purposes."
          }
        ]
      }
    ]
  });
}
```

**File**: `src/app/api/ai/mock-quiz/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { title } = await request.json();
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return NextResponse.json({
    topic: title,
    questions: [
      {
        question: "What is this video about?",
        options: [
          title,
          "Something else",
          "Not related",
          "Unknown"
        ],
        correctAnswer: 0,
        explanation: "This is a mock quiz question for testing."
      }
    ]
  });
}
```

## Testing the Background Job System

### 1. Add Status Migration

Visit: `http://localhost:3000/admin/migrate`

Or run programmatically:
```typescript
const result = await convex.mutation(api.migrations.addDefaultStatusToVideos);
console.log(result); // { totalVideos: 5, updatedVideos: 5 }
```

### 2. Test Video Processing

```typescript
import { api } from "@/convex/_generated/api";

// Create video with pending status
const videoId = await convex.mutation(api.videos.createVideo, {
  youtubeVideoId: "test123",
  title: "Test Video",
  url: "https://youtube.com/watch?v=test123",
  transcript: "Test transcript content...",
  notes: {},
  quiz: {},
});

// Trigger background processing
await convex.action(api.videoProcessing.processVideo, {
  videoId
});

// Check status (will update in real-time)
const video = await convex.query(api.videos.getVideo, { id: videoId });
console.log(video.status); // 'pending' → 'processing' → 'completed'
```

### 3. Monitor Processing

Query videos by status:
```typescript
// Get all pending videos
const pending = await convex.query(api.videoProcessing.getVideosByStatus, {
  status: "pending"
});

// Get failed videos
const failed = await convex.query(api.videoProcessing.getVideosByStatus, {
  status: "failed"
});

// Retry failed video
await convex.mutation(api.videoProcessing.retryFailedVideo, {
  videoId: failedVideoId
});
```

## Error Handling

The background job system includes comprehensive error handling:

### Automatic Status Updates
- **pending**: Initial state
- **processing**: AI generation in progress
- **completed**: Successfully generated notes/quiz
- **failed**: Error occurred (with errorMessage)

### Retry Mechanism
Failed videos can be retried:
```typescript
await convex.mutation(api.videoProcessing.retryFailedVideo, {
  videoId
});
// Status reset to 'pending', then trigger processing again
```

### Error Messages
Failed videos include error details:
```typescript
{
  status: "failed",
  errorMessage: "Failed to generate notes: API timeout",
  updatedAt: 1234567890
}
```

## Production Considerations

### 1. Rate Limiting
Add rate limiting to AI API calls:
```typescript
// In processVideoInternal
const rateLimiter = new RateLimiter({ requests: 10, per: 60 }); // 10/min
await rateLimiter.wait();
```

### 2. Timeout Handling
Set reasonable timeouts:
```typescript
const notesResponse = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
  signal: AbortSignal.timeout(60000) // 60 second timeout
});
```

### 3. Cost Management
Monitor AI API usage:
- Log all API calls
- Track token usage
- Set monthly budgets
- Use caching where possible

### 4. Queue Management
For high volume:
- Use Convex scheduler delays
- Process in batches
- Monitor queue length
- Add priority levels

### 5. Monitoring
Track video processing:
```typescript
// Dashboard query
const stats = await convex.query(api.videoProcessing.getVideosByStatus, {});
const pending = stats.filter(v => v.status === 'pending').length;
const processing = stats.filter(v => v.status === 'processing').length;
const completed = stats.filter(v => v.status === 'completed').length;
const failed = stats.filter(v => v.status === 'failed').length;
```

## Troubleshooting

### Issue: Processing Stuck
**Solution**: Check background job logs in Convex dashboard

### Issue: Failed API Calls
**Solution**: Verify endpoints, check API keys, review error messages

### Issue: Slow Processing
**Solution**: Optimize prompts, use faster models, add parallel processing

### Issue: Invalid Response Format
**Solution**: Validate AI responses, add fallback handling

## Next Steps

After setting up AI integration:

1. ✅ Configure environment variables
2. ✅ Test with mock endpoints
3. ✅ Run status migration
4. ✅ Test video processing flow
5. → Update `/create` route (Step 4)
6. → Build video library UI (Step 5)

## Support

For issues with:
- Convex background jobs: Check Convex dashboard logs
- AI API integration: Review API documentation
- Error handling: Check video.errorMessage field

Created: January 22, 2025
