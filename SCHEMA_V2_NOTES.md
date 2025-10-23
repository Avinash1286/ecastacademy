# Schema V2.0 - Flexible LMS Architecture

## Overview
Enhanced Convex schema to support a flexible Learning Management System with:
- Independent video library
- Background job processing
- Mixed content types (video, text, quiz, assignment, resource)
- Status tracking and error handling
- User progress tracking

## Schema Changes

### Videos Table (Enhanced)
```typescript
videos: {
  // Existing fields
  youtubeVideoId: string
  title: string
  url: string
  thumbnailUrl?: string
  channelTitle?: string
  durationInSeconds?: number
  publishedAt?: number
  transcript?: string
  notes: any
  quiz: any
  createdAt: number
  
  // NEW FIELDS
  updatedAt?: number  // Last update timestamp
  status?: "pending" | "processing" | "completed" | "failed"
  errorMessage?: string  // Error details if processing fails
}
```

**Indexes**:
- `by_youtubeVideoId`: Find by YouTube ID
- `by_status`: Filter by processing status

### Courses Table (Enhanced)
```typescript
courses: {
  // Existing fields
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  
  // NEW FIELDS
  thumbnailUrl?: string  // Course thumbnail
  status?: "draft" | "generating" | "ready" | "failed"
  createdBy?: string  // User ID who created
  isPublished?: boolean  // Publication status
}
```

**Indexes**:
- `by_status`: Filter by course status
- `by_createdBy`: Get courses by user

### Chapters Table (Enhanced)
```typescript
chapters: {
  courseId: Id<"courses">
  videoId?: Id<"videos">  // Optional - backward compatibility
  name: string
  description?: string
  order: number
  createdAt: number
}
```

**Indexes**:
- `by_courseId`: Get chapters by course
- `by_courseId_order`: Get ordered chapters
- `by_videoId`: Find chapters using a video

### ContentItems Table (NEW)
```typescript
contentItems: {
  chapterId: Id<"chapters">
  type: "video" | "text" | "quiz" | "assignment" | "resource"
  order: number
  
  // Content-specific fields (populated based on type)
  videoId?: Id<"videos">           // For video type
  textContent?: string             // For text type
  quizData?: any                   // For quiz type
  assignmentData?: any             // For assignment type
  resourceUrl?: string             // For resource type
  resourceTitle?: string           // For resource type
  
  createdAt: number
}
```

**Indexes**:
- `by_chapterId`: Get content by chapter
- `by_chapterId_order`: Get ordered content

### Progress Table (NEW)
```typescript
progress: {
  userId: string
  courseId: Id<"courses">
  chapterId?: Id<"chapters">
  contentItemId?: Id<"contentItems">
  completed: boolean
  completedAt?: number
  progressPercentage?: number
}
```

**Indexes**:
- `by_userId_courseId`: Get user's course progress
- `by_userId_contentItemId`: Get specific content progress

## Backward Compatibility Strategy

All new fields are **optional** to support existing data:
- Old courses without `status` or `isPublished` still work
- Old videos without `status` still work
- Old chapters with direct `videoId` still work
- New flexible content via `contentItems` table

## Migration Strategy

### Phase 1: Schema Update (Completed ✅)
- Added new optional fields
- Added new tables (contentItems, progress)
- Maintained backward compatibility

### Phase 2: Background Jobs (In Progress)
- Created `videoProcessing.ts` with action/internalAction pattern
- Supports async AI content generation
- Status tracking and error handling

### Phase 3: Video Library (TODO)
- Videos exist independently of courses
- Create videos with `status='pending'`
- Background job processes and updates status
- Admin interface to view/manage videos

### Phase 4: Course Builder (TODO)
- Create course with flexible structure
- Add chapters as organizational units
- Add contentItems with various types
- Link existing videos from library
- Add text, quizzes, assignments directly

### Phase 5: Frontend Updates (TODO)
- Dynamic content rendering based on type
- Progress tracking integration
- Real-time status updates

## Background Job System

### File: `convex/videoProcessing.ts`

**Action Pattern**:
```typescript
// Public action - callable from client/server
export const processVideo = action({
  handler: async (ctx, args) => {
    // Schedule background job
    await ctx.scheduler.runAfter(0, 
      internal.videoProcessing.processVideoInternal, 
      { videoId: args.videoId }
    );
  }
});
```

**Internal Action Pattern**:
```typescript
// Internal - only callable from other Convex functions
export const processVideoInternal = internalAction({
  handler: async (ctx, args) => {
    // Update status to processing
    await ctx.runMutation(internal.videoProcessing.updateVideoStatus, {
      videoId: args.videoId,
      status: "processing"
    });
    
    // Call external AI APIs
    const notes = await generateNotes();
    const quiz = await generateQuiz();
    
    // Update with results
    await ctx.runMutation(internal.videoProcessing.updateVideoContent, {
      videoId: args.videoId,
      notes,
      quiz,
      status: "completed"
    });
  }
});
```

**Required Environment Variables**:
```
NOTES_GENERATION_ENDPOINT=<your-ai-notes-api-url>
QUIZ_GENERATION_ENDPOINT=<your-ai-quiz-api-url>
```

## Usage Examples

### Create Video with Background Processing
```typescript
// 1. Create video with pending status
const videoId = await ctx.mutation(api.videos.createVideo, {
  youtubeVideoId: "abc123",
  title: "Introduction to AI",
  url: "https://youtube.com/watch?v=abc123",
  transcript: "...",
  notes: {},
  quiz: {},
});

// 2. Trigger background processing
await ctx.action(api.videoProcessing.processVideo, {
  videoId
});

// 3. Video status updates automatically: pending → processing → completed
```

### Create Flexible Course
```typescript
// 1. Create course
const courseId = await ctx.mutation(api.courses.createCourse, {
  name: "Full Stack Development",
  description: "Learn web development",
  status: "draft",
  isPublished: false
});

// 2. Add chapter
const chapterId = await ctx.mutation(api.chapters.createChapter, {
  courseId,
  name: "Introduction",
  order: 1
});

// 3. Add video content item
await ctx.mutation(api.contentItems.create, {
  chapterId,
  type: "video",
  videoId: existingVideoId,  // From video library
  order: 1
});

// 4. Add text content item
await ctx.mutation(api.contentItems.create, {
  chapterId,
  type: "text",
  textContent: "<h1>Welcome</h1><p>Course overview...</p>",
  order: 2
});

// 5. Publish when ready
await ctx.mutation(api.courses.updateCourse, {
  id: courseId,
  isPublished: true,
  status: "ready"
});
```

### Track User Progress
```typescript
// Mark content as completed
await ctx.mutation(api.progress.markCompleted, {
  userId: "user123",
  courseId,
  contentItemId,
  completed: true
});

// Get user progress
const progress = await ctx.query(api.progress.getUserCourseProgress, {
  userId: "user123",
  courseId
});
// Returns: { completed: 5, total: 10, percentage: 50 }
```

## Implementation Checklist

### Completed ✅
- [x] Schema design with new tables
- [x] Backward compatibility (optional fields)
- [x] Background job system structure
- [x] Video status tracking
- [x] Course status tracking
- [x] All Convex functions updated
- [x] Type safety maintained

### In Progress 🔄
- [ ] External AI API integration
- [ ] Background job testing

### TODO 📝
- [ ] ContentItems CRUD functions
- [ ] Progress tracking functions
- [ ] Video library UI
- [ ] Course management UI
- [ ] Course builder UI
- [ ] Dynamic content renderer
- [ ] Progress tracking UI

## Benefits

1. **Flexibility**: Mix videos, text, quizzes, assignments, resources
2. **Reusability**: Videos exist independently, reuse across courses
3. **Scalability**: Background jobs handle AI processing
4. **Status Tracking**: Know what's ready, generating, or failed
5. **Error Handling**: Retry failed operations
6. **User Experience**: Real-time status updates
7. **Analytics**: Track progress per content item

## Development Workflow

### Video Creation
1. User pastes YouTube URL
2. System fetches video data
3. Video saved with `status='pending'`
4. Background job triggered
5. Status updates: pending → processing → completed/failed
6. User sees real-time updates

### Course Creation
1. Create course structure (name, description)
2. Add chapters
3. For each chapter:
   - Add content items (any type)
   - Order content
4. Preview course
5. Publish when ready

### Content Consumption
1. User enrolls in course
2. Learnspace renders content based on type:
   - Video: Player component
   - Text: Rich text display
   - Quiz: Interactive quiz
   - Assignment: Assignment viewer
   - Resource: Download link
3. Progress tracked automatically
4. User sees completion status

## Database Queries

### Get Videos by Status
```typescript
const pendingVideos = await ctx.query(api.videos.getVideosByStatus, {
  status: "pending"
});
```

### Get Course with Structure
```typescript
const course = await ctx.query(api.courses.getCourseWithStructure, {
  courseId
});
// Returns: course with chapters and contentItems nested
```

### Get User Progress
```typescript
const userProgress = await ctx.query(api.progress.getUserProgress, {
  userId,
  courseId
});
```

## Next Implementation Steps

1. **Create ContentItems functions** (convex/contentItems.ts)
   - createContentItem
   - updateContentItem
   - deleteContentItem
   - getContentItemsByChapter
   
2. **Create Progress functions** (convex/progress.ts)
   - markCompleted
   - getUserCourseProgress
   - getUserOverallProgress
   
3. **Update Videos functions**
   - getVideosByStatus
   - retryFailedVideo
   
4. **Build Admin UIs**
   - /admin/videos
   - /admin/courses
   - /admin/courses/[id]/builder

Created: January 22, 2025
Status: In Development
