# Course Certification & Grading System - Implementation Plan

**Created**: October 24, 2025  
**Status**: Awaiting Approval  
**Version**: 1.0

---

## 📋 Executive Summary

This document outlines a comprehensive plan to implement a certification and grading system for ECAST Academy. The system will allow:

1. **Course-level certification toggle** - Admins can mark courses as certification or non-certification
2. **Item-level grading** - Individual content items (videos, quizzes, assignments) can be marked as graded
3. **Automatic grading for certification courses** - Video-associated quizzes automatically become graded in certification courses
4. **Smart progress tracking** - Only graded items count toward course completion for certification courses
5. **Certificate generation** - Upon successful completion of all graded items

---

## 🎯 Feature Requirements

### 1. Course Certification Settings
- Admin can choose "Certification" or "Non-Certification" when creating a course
- Certification courses require passing grades on graded items
- Non-certification courses track completion without grades
- Setting is editable after course creation

### 2. Content Item Grading
- Each content item has a `isGraded` flag
- For certification courses:
  - Video quizzes are automatically marked as graded (when video exists in chapter)
  - Text quizzes can be manually set as graded/ungraded
  - Standalone quiz items can be graded/ungraded
  - Assignments can be graded/ungraded
  - Text and resource items are non-graded by default
- For non-certification courses:
  - All items are non-graded by default
  - Items can still be manually marked as graded for feedback purposes

### 3. Quiz Scoring System
- Each quiz question has points (default: 1 point per question)
- Passing threshold: 70% (configurable per quiz)
- Track attempts, best score, and latest score
- Allow retakes for failed attempts

### 4. Progress Tracking Logic
- **For Certification Courses**:
  - Only graded items count toward completion percentage
  - Must achieve passing grade on all graded items
  - Non-graded items don't affect completion but are tracked for engagement
  - Formula: `(Passed Graded Items / Total Graded Items) × 100`

- **For Non-Certification Courses**:
  - All items count toward completion
  - No passing grade required
  - Formula: `(Completed Items / Total Items) × 100`

### 5. Certificate Generation
- Automatically generate certificate when:
  - Course is a certification course
  - All graded items have passing grades
  - User completes the course
- Certificate includes:
  - Course name
  - User name
  - Completion date
  - Overall grade percentage
  - Unique certificate ID

---

## 🗄️ Database Schema Changes

### 1. Update `courses` Table

```typescript
courses: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  thumbnailUrl: v.optional(v.string()),
  status: v.optional(v.union(
    v.literal("draft"),
    v.literal("generating"),
    v.literal("ready"),
    v.literal("failed")
  )),
  
  // NEW FIELDS
  isCertification: v.boolean(),              // Is this a certification course?
  passingGrade: v.optional(v.number()),      // Minimum grade to pass (default: 70)
  certificateTemplate: v.optional(v.string()), // Template for certificate
  
  createdBy: v.optional(v.string()),
  isPublished: v.optional(v.boolean()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

### 2. Update `contentItems` Table

```typescript
contentItems: defineTable({
  chapterId: v.id("chapters"),
  type: v.union(
    v.literal("video"),
    v.literal("text"),
    v.literal("quiz"),
    v.literal("assignment"),
    v.literal("resource")
  ),
  title: v.string(),
  order: v.number(),
  
  // NEW FIELDS
  isGraded: v.boolean(),                      // Is this item graded?
  maxPoints: v.optional(v.number()),          // Maximum points for graded items
  passingScore: v.optional(v.number()),       // Minimum score to pass (percentage)
  allowRetakes: v.optional(v.boolean()),      // Allow multiple attempts
  
  // Existing fields
  videoId: v.optional(v.id("videos")),
  textContent: v.optional(v.string()),
  textQuiz: v.optional(v.any()),
  textQuizStatus: v.optional(v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed")
  )),
  textQuizError: v.optional(v.string()),
  quizData: v.optional(v.any()),
  assignmentData: v.optional(v.any()),
  resourceUrl: v.optional(v.string()),
  resourceTitle: v.optional(v.string()),
  createdAt: v.number(),
})
```

### 3. Update `progress` Table

```typescript
progress: defineTable({
  userId: v.id("users"),
  courseId: v.id("courses"),
  chapterId: v.optional(v.id("chapters")),
  contentItemId: v.optional(v.id("contentItems")),
  
  // Completion tracking
  completed: v.boolean(),
  completedAt: v.optional(v.number()),
  
  // NEW FIELDS - Grading
  isGradedItem: v.optional(v.boolean()),      // Is this a graded item?
  score: v.optional(v.number()),              // Score achieved (points)
  maxScore: v.optional(v.number()),           // Maximum possible score
  percentage: v.optional(v.number()),         // Score as percentage
  passed: v.optional(v.boolean()),            // Did user pass this item?
  attempts: v.optional(v.number()),           // Number of attempts
  bestScore: v.optional(v.number()),          // Best score achieved
  lastAttemptAt: v.optional(v.number()),      // Timestamp of last attempt
  
  // Progress tracking
  progressPercentage: v.optional(v.number()),
})
.index("by_userId_courseId", ["userId", "courseId"])
.index("by_userId_contentItemId", ["userId", "contentItemId"])
.index("by_userId_courseId_contentItemId", ["userId", "courseId", "contentItemId"])
```

### 4. New `certificates` Table

```typescript
certificates: defineTable({
  userId: v.id("users"),
  courseId: v.id("courses"),
  certificateId: v.string(),                  // Unique certificate ID
  
  // Certificate details
  courseName: v.string(),
  userName: v.string(),
  completionDate: v.number(),
  overallGrade: v.number(),                   // Overall grade percentage
  
  // Certificate data
  certificateUrl: v.optional(v.string()),     // Generated certificate PDF/image
  issuedAt: v.number(),
  
  // Metadata
  totalGradedItems: v.number(),
  passedItems: v.number(),
  averageScore: v.number(),
})
.index("by_userId", ["userId"])
.index("by_courseId", ["courseId"])
.index("by_certificateId", ["certificateId"])
.index("by_userId_courseId", ["userId", "courseId"])
```

### 5. New `quizAttempts` Table

```typescript
quizAttempts: defineTable({
  userId: v.id("users"),
  contentItemId: v.id("contentItems"),
  courseId: v.id("courses"),
  
  // Attempt details
  attemptNumber: v.number(),
  answers: v.any(),                           // User's answers
  score: v.number(),                          // Points scored
  maxScore: v.number(),                       // Maximum possible score
  percentage: v.number(),                     // Score as percentage
  passed: v.boolean(),                        // Did this attempt pass?
  
  // Timing
  startedAt: v.number(),
  completedAt: v.number(),
  timeSpent: v.number(),                      // Seconds spent on quiz
})
.index("by_userId_contentItemId", ["userId", "contentItemId"])
.index("by_userId_courseId", ["userId", "courseId"])
```

---

## 🔧 Backend Implementation (Convex)

### Phase 1: Schema Migration

**File**: `convex/schema.ts`

1. Add new fields to `courses` table
2. Add new fields to `contentItems` table
3. Add new fields to `progress` table
4. Create `certificates` table
5. Create `quizAttempts` table

**Migration Strategy**:
- Add all new fields as optional to maintain compatibility
- Set default values for existing records
- Create migration script to update existing data

---

### Phase 2: Course Management Functions

**File**: `convex/courses.ts`

#### New/Updated Mutations:

```typescript
// Updated createCourse mutation
export const createCourse = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isCertification: v.boolean(),              // NEW
    passingGrade: v.optional(v.number()),      // NEW (default: 70)
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const courseId = await ctx.db.insert("courses", {
      name: args.name,
      description: args.description,
      isCertification: args.isCertification,
      passingGrade: args.passingGrade || 70,   // Default 70%
      status: "draft",
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });
    return courseId;
  },
});

// Updated updateCourse mutation
export const updateCourse = mutation({
  args: {
    id: v.id("courses"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    isCertification: v.optional(v.boolean()),   // NEW
    passingGrade: v.optional(v.number()),       // NEW
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});
```

#### New Queries:

```typescript
// Get course grading configuration
export const getCourseGradingConfig = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) return null;
    
    return {
      isCertification: course.isCertification,
      passingGrade: course.passingGrade || 70,
      // Calculate total graded items count
      // This will be implemented
    };
  },
});
```

---

### Phase 3: Content Item Functions

**File**: `convex/contentItems.ts`

#### Updated Mutations:

```typescript
// Updated createContentItem mutation
export const createContentItem = mutation({
  args: {
    chapterId: v.id("chapters"),
    type: v.union(
      v.literal("video"),
      v.literal("text"),
      v.literal("quiz"),
      v.literal("assignment"),
      v.literal("resource")
    ),
    title: v.string(),
    order: v.number(),
    
    // NEW GRADING FIELDS
    isGraded: v.optional(v.boolean()),
    maxPoints: v.optional(v.number()),
    passingScore: v.optional(v.number()),
    allowRetakes: v.optional(v.boolean()),
    
    // Existing fields...
    videoId: v.optional(v.id("videos")),
    textContent: v.optional(v.string()),
    quizData: v.optional(v.any()),
    // ... other fields
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get chapter and course to check if it's a certification course
    const chapter = await ctx.db.get(args.chapterId);
    if (!chapter) throw new Error("Chapter not found");
    
    const course = await ctx.db.get(chapter.courseId);
    if (!course) throw new Error("Course not found");
    
    // Auto-determine grading based on course type and content type
    let isGraded = args.isGraded;
    
    if (course.isCertification && isGraded === undefined) {
      // For certification courses, auto-grade certain types
      if (args.type === "video" && args.videoId) {
        // Check if video has a quiz
        const video = await ctx.db.get(args.videoId);
        isGraded = video?.quiz ? true : false;
      } else if (args.type === "quiz" || args.type === "assignment") {
        isGraded = true; // Quizzes and assignments are graded by default
      } else {
        isGraded = false; // Text and resources are not graded by default
      }
    } else if (isGraded === undefined) {
      isGraded = false; // Non-certification courses default to non-graded
    }
    
    const contentItemId = await ctx.db.insert("contentItems", {
      chapterId: args.chapterId,
      type: args.type,
      title: args.title,
      order: args.order,
      isGraded,
      maxPoints: args.maxPoints || (isGraded ? 100 : undefined),
      passingScore: args.passingScore || (isGraded ? 70 : undefined),
      allowRetakes: args.allowRetakes ?? true,
      videoId: args.videoId,
      textContent: args.textContent,
      quizData: args.quizData,
      createdAt: now,
    });
    
    return contentItemId;
  },
});

// Toggle grading for content item
export const toggleContentItemGrading = mutation({
  args: {
    contentItemId: v.id("contentItems"),
    isGraded: v.boolean(),
    maxPoints: v.optional(v.number()),
    passingScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contentItemId, {
      isGraded: args.isGraded,
      maxPoints: args.maxPoints || (args.isGraded ? 100 : undefined),
      passingScore: args.passingScore || (args.isGraded ? 70 : undefined),
    });
    
    return await ctx.db.get(args.contentItemId);
  },
});
```

---

### Phase 4: Progress Tracking Functions

**New File**: `convex/progress.ts`

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Submit quiz attempt
export const submitQuizAttempt = mutation({
  args: {
    userId: v.id("users"),
    contentItemId: v.id("contentItems"),
    answers: v.any(),
    score: v.number(),
    maxScore: v.number(),
    timeSpent: v.number(),
  },
  handler: async (ctx, args) => {
    const contentItem = await ctx.db.get(args.contentItemId);
    if (!contentItem) throw new Error("Content item not found");
    
    const chapter = await ctx.db.get(contentItem.chapterId);
    if (!chapter) throw new Error("Chapter not found");
    
    const percentage = (args.score / args.maxScore) * 100;
    const passed = percentage >= (contentItem.passingScore || 70);
    
    // Get existing attempts
    const existingAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_userId_contentItemId", (q) =>
        q.eq("userId", args.userId).eq("contentItemId", args.contentItemId)
      )
      .collect();
    
    const attemptNumber = existingAttempts.length + 1;
    
    // Record the attempt
    const attemptId = await ctx.db.insert("quizAttempts", {
      userId: args.userId,
      contentItemId: args.contentItemId,
      courseId: chapter.courseId,
      attemptNumber,
      answers: args.answers,
      score: args.score,
      maxScore: args.maxScore,
      percentage,
      passed,
      startedAt: Date.now() - (args.timeSpent * 1000),
      completedAt: Date.now(),
      timeSpent: args.timeSpent,
    });
    
    // Update progress record
    const progressRecord = await ctx.db
      .query("progress")
      .withIndex("by_userId_contentItemId", (q) =>
        q.eq("userId", args.userId).eq("contentItemId", args.contentItemId)
      )
      .first();
    
    const bestScore = Math.max(
      args.score,
      ...(existingAttempts.map(a => a.score))
    );
    
    if (progressRecord) {
      await ctx.db.patch(progressRecord._id, {
        score: args.score,
        maxScore: args.maxScore,
        percentage,
        passed,
        attempts: attemptNumber,
        bestScore,
        lastAttemptAt: Date.now(),
        completed: passed,
        completedAt: passed ? Date.now() : undefined,
      });
    } else {
      await ctx.db.insert("progress", {
        userId: args.userId,
        courseId: chapter.courseId,
        chapterId: chapter._id,
        contentItemId: args.contentItemId,
        isGradedItem: contentItem.isGraded,
        score: args.score,
        maxScore: args.maxScore,
        percentage,
        passed,
        attempts: attemptNumber,
        bestScore,
        lastAttemptAt: Date.now(),
        completed: passed,
        completedAt: passed ? Date.now() : undefined,
      });
    }
    
    // Check if course is complete and issue certificate if needed
    await checkAndIssueCertificate(ctx, args.userId, chapter.courseId);
    
    return attemptId;
  },
});

// Mark non-graded item as complete
export const markItemComplete = mutation({
  args: {
    userId: v.id("users"),
    contentItemId: v.id("contentItems"),
  },
  handler: async (ctx, args) => {
    const contentItem = await ctx.db.get(args.contentItemId);
    if (!contentItem) throw new Error("Content item not found");
    
    if (contentItem.isGraded) {
      throw new Error("Cannot mark graded items complete without quiz submission");
    }
    
    const chapter = await ctx.db.get(contentItem.chapterId);
    if (!chapter) throw new Error("Chapter not found");
    
    const existingProgress = await ctx.db
      .query("progress")
      .withIndex("by_userId_contentItemId", (q) =>
        q.eq("userId", args.userId).eq("contentItemId", args.contentItemId)
      )
      .first();
    
    if (existingProgress) {
      await ctx.db.patch(existingProgress._id, {
        completed: true,
        completedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("progress", {
        userId: args.userId,
        courseId: chapter.courseId,
        chapterId: chapter._id,
        contentItemId: args.contentItemId,
        isGradedItem: false,
        completed: true,
        completedAt: Date.now(),
      });
    }
    
    return existingProgress?._id;
  },
});

// Calculate course progress
export const getCourseProgress = query({
  args: {
    userId: v.id("users"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) return null;
    
    // Get all chapters for this course
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();
    
    // Get all content items across all chapters
    const allContentItems = [];
    for (const chapter of chapters) {
      const items = await ctx.db
        .query("contentItems")
        .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
        .collect();
      allContentItems.push(...items);
    }
    
    // Get user's progress for this course
    const progressRecords = await ctx.db
      .query("progress")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .collect();
    
    let totalItems, completedItems, gradedItems, passedGradedItems;
    
    if (course.isCertification) {
      // For certification courses, only count graded items
      gradedItems = allContentItems.filter(item => item.isGraded);
      totalItems = gradedItems.length;
      
      const gradedProgress = progressRecords.filter(p => p.isGradedItem);
      passedGradedItems = gradedProgress.filter(p => p.passed).length;
      completedItems = passedGradedItems;
    } else {
      // For non-certification courses, count all items
      totalItems = allContentItems.length;
      completedItems = progressRecords.filter(p => p.completed).length;
      gradedItems = [];
      passedGradedItems = 0;
    }
    
    const progressPercentage = totalItems > 0 
      ? Math.round((completedItems / totalItems) * 100) 
      : 0;
    
    const isComplete = totalItems > 0 && completedItems === totalItems;
    
    // Calculate overall grade for certification courses
    let overallGrade = null;
    if (course.isCertification && gradedItems.length > 0) {
      const gradedProgress = progressRecords.filter(p => p.isGradedItem);
      const totalScore = gradedProgress.reduce((sum, p) => sum + (p.bestScore || 0), 0);
      const maxScore = gradedProgress.reduce((sum, p) => sum + (p.maxScore || 0), 0);
      overallGrade = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    }
    
    return {
      courseId: args.courseId,
      userId: args.userId,
      isCertification: course.isCertification,
      totalItems,
      completedItems,
      gradedItems: gradedItems.length,
      passedGradedItems,
      progressPercentage,
      isComplete,
      overallGrade,
      passingGrade: course.passingGrade || 70,
    };
  },
});

// Internal helper to check and issue certificate
async function checkAndIssueCertificate(ctx: any, userId: any, courseId: any) {
  const course = await ctx.db.get(courseId);
  if (!course || !course.isCertification) return;
  
  const progress = await getCourseProgress._query(ctx, { userId, courseId });
  
  if (progress.isComplete && progress.overallGrade >= progress.passingGrade) {
    // Check if certificate already exists
    const existingCert = await ctx.db
      .query("certificates")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", userId).eq("courseId", courseId)
      )
      .first();
    
    if (!existingCert) {
      // Get user details
      const user = await ctx.db.get(userId);
      if (!user) return;
      
      // Generate unique certificate ID
      const certificateId = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      await ctx.db.insert("certificates", {
        userId,
        courseId,
        certificateId,
        courseName: course.name,
        userName: user.name || user.email,
        completionDate: Date.now(),
        overallGrade: progress.overallGrade,
        totalGradedItems: progress.gradedItems,
        passedItems: progress.passedGradedItems,
        averageScore: progress.overallGrade,
        issuedAt: Date.now(),
      });
    }
  }
}

// Get user's certificate for a course
export const getCertificate = query({
  args: {
    userId: v.id("users"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    const certificate = await ctx.db
      .query("certificates")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.courseId)
      )
      .first();
    
    return certificate;
  },
});
```

---

## 🎨 Frontend Implementation

### Phase 5: Course Creation/Edit UI

**File**: `src/app/admin/courses/create/page.tsx`

#### Updates Needed:

1. Add certification toggle to course creation form
2. Add passing grade input (default 70%)
3. Display information about what certification means

```tsx
// Add to course creation form
<div className="space-y-4">
  <Label>Course Type</Label>
  <RadioGroup value={isCertification ? "certification" : "non-certification"}>
    <Card className="cursor-pointer">
      <CardContent className="flex items-start gap-4 p-6">
        <RadioGroupItem value="certification" id="certification" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Certification Course</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Students must pass graded quizzes and assignments to complete. 
            Certificate issued upon successful completion.
          </p>
        </div>
      </CardContent>
    </Card>
    
    <Card className="cursor-pointer">
      <CardContent className="flex items-start gap-4 p-6">
        <RadioGroupItem value="non-certification" id="non-certification" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold">Regular Course</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Students learn at their own pace. No grades or certificates required.
          </p>
        </div>
      </CardContent>
    </Card>
  </RadioGroup>
  
  {isCertification && (
    <div className="space-y-2">
      <Label htmlFor="passingGrade">Passing Grade (%)</Label>
      <Input
        id="passingGrade"
        type="number"
        min="0"
        max="100"
        value={passingGrade}
        onChange={(e) => setPassingGrade(Number(e.target.value))}
        placeholder="70"
      />
      <p className="text-xs text-muted-foreground">
        Minimum percentage required to pass graded items
      </p>
    </div>
  )}
</div>
```

---

### Phase 6: Content Item Grading UI

**File**: `src/app/admin/courses/[id]/edit/page.tsx` (or similar)

#### Add Grading Toggle for Each Content Item:

```tsx
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>{contentItem.title}</CardTitle>
      <div className="flex items-center gap-2">
        <Label htmlFor={`graded-${contentItem.id}`}>Graded</Label>
        <Switch
          id={`graded-${contentItem.id}`}
          checked={contentItem.isGraded}
          onCheckedChange={(checked) => handleToggleGrading(contentItem.id, checked)}
        />
      </div>
    </div>
  </CardHeader>
  
  {contentItem.isGraded && (
    <CardContent>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Max Points</Label>
          <Input
            type="number"
            value={contentItem.maxPoints}
            onChange={(e) => handleUpdatePoints(contentItem.id, e.target.value)}
          />
        </div>
        <div>
          <Label>Passing Score (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={contentItem.passingScore}
            onChange={(e) => handleUpdatePassingScore(contentItem.id, e.target.value)}
          />
        </div>
      </div>
    </CardContent>
  )}
</Card>
```

---

### Phase 7: Quiz Submission & Scoring

**File**: `src/components/learnspace/quizzes-panel.tsx`

#### Updates Needed:

1. Display grading information if quiz is graded
2. Show passing score requirement
3. Submit quiz with scoring
4. Display score and pass/fail status
5. Allow retakes if enabled

```tsx
// Add to quiz submission handler
const handleSubmitQuiz = async () => {
  const answers = getUserAnswers();
  const { score, maxScore } = calculateScore(answers, quiz.questions);
  
  try {
    await submitQuizAttempt({
      userId: session.user.id,
      contentItemId: currentContentItem.id,
      answers,
      score,
      maxScore,
      timeSpent: getTimeSpent(),
    });
    
    const percentage = (score / maxScore) * 100;
    const passed = percentage >= currentContentItem.passingScore;
    
    if (passed) {
      toast.success(`Congratulations! You passed with ${percentage.toFixed(1)}%`);
    } else {
      toast.error(`You scored ${percentage.toFixed(1)}%. Need ${currentContentItem.passingScore}% to pass.`);
      if (currentContentItem.allowRetakes) {
        toast.info("You can retake this quiz to improve your score.");
      }
    }
  } catch (error) {
    toast.error("Failed to submit quiz");
  }
};
```

---

### Phase 8: Progress Display

**File**: `src/components/dashboard/CourseCard.tsx` or Course Details

#### Show Progress Based on Course Type:

```tsx
{course.isCertification ? (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">Graded Items Completed</span>
      <span className="font-semibold">{progress.passedGradedItems}/{progress.gradedItems}</span>
    </div>
    <Progress value={progress.progressPercentage} />
    {progress.overallGrade !== null && (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Overall Grade</span>
        <span className={`font-semibold ${progress.overallGrade >= course.passingGrade ? 'text-green-500' : 'text-yellow-500'}`}>
          {progress.overallGrade}%
        </span>
      </div>
    )}
  </div>
) : (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">Progress</span>
      <span className="font-semibold">{progress.completedItems}/{progress.totalItems}</span>
    </div>
    <Progress value={progress.progressPercentage} />
  </div>
)}
```

---

### Phase 9: Certificate Display

**New File**: `src/app/dashboard/certificates/page.tsx`

```tsx
'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Download, Share2 } from 'lucide-react';

export default function CertificatesPage() {
  const { data: session } = useSession();
  const certificates = useQuery(api.certificates.getUserCertificates, {
    userId: session?.user?.id,
  });

  return (
    <div className="container mx-auto py-12">
      <h1 className="text-3xl font-bold mb-8">My Certificates</h1>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {certificates?.map((cert) => (
          <Card key={cert._id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">{cert.courseName}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grade:</span>
                  <span className="font-semibold">{cert.overallGrade}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed:</span>
                  <span>{new Date(cert.completionDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Certificate ID:</span>
                  <span className="text-xs font-mono">{cert.certificateId}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## 📊 Implementation Phases & Timeline

### Phase 1: Database Schema (Week 1)
- [ ] Update schema.ts with new fields
- [ ] Create migration script for existing data
- [ ] Test schema changes in development

### Phase 2: Backend - Course & Content Management (Week 1-2)
- [ ] Update courses.ts mutations
- [ ] Update contentItems.ts mutations
- [ ] Add grading configuration queries
- [ ] Test with sample data

### Phase 3: Backend - Progress & Grading (Week 2)
- [ ] Create progress.ts with new functions
- [ ] Implement quiz submission logic
- [ ] Implement progress calculation
- [ ] Add certificate generation logic

### Phase 4: Frontend - Course Creation (Week 3)
- [ ] Update course creation form
- [ ] Add certification toggle UI
- [ ] Add passing grade configuration
- [ ] Test course creation flow

### Phase 5: Frontend - Content Management (Week 3)
- [ ] Add grading toggle to content items
- [ ] Add grading configuration UI
- [ ] Auto-grading logic for certification courses
- [ ] Test content item management

### Phase 6: Frontend - Quiz Experience (Week 4)
- [ ] Update quiz panel for grading
- [ ] Add score display
- [ ] Implement retake functionality
- [ ] Show pass/fail feedback

### Phase 7: Frontend - Progress & Certificates (Week 4-5)
- [ ] Update progress displays
- [ ] Create certificate page
- [ ] Implement certificate download
- [ ] Add certificate sharing

### Phase 8: Testing & Polish (Week 5-6)
- [ ] End-to-end testing
- [ ] Edge case handling
- [ ] Performance optimization
- [ ] Documentation

---

## 🧪 Testing Strategy

### Unit Tests
- Course creation with certification flag
- Content item grading toggle
- Quiz score calculation
- Progress calculation logic
- Certificate generation conditions

### Integration Tests
- Complete course as non-certification
- Complete certification course and earn certificate
- Fail graded quiz and retake
- Mixed content course with graded/non-graded items
- Progress calculation accuracy

### User Acceptance Tests
- Admin creates certification course
- Admin toggles grading on content items
- Student completes graded quiz
- Student receives certificate
- Certificate displays correctly

---

## 🚨 Edge Cases to Handle

1. **Course Type Change**: What happens if admin changes non-certification → certification?
   - Solution: Prompt to configure grading for existing items
   
2. **Grading Toggle on Completed Items**: Can admin toggle grading after students completed?
   - Solution: Show warning and recalculate all student progress
   
3. **Multiple Quiz Attempts**: How to track best vs latest score?
   - Solution: Store all attempts, display best score in progress
   
4. **Certificate Revocation**: What if student fails after certificate issued?
   - Solution: Don't allow after certificate issue, or implement revocation system
   
5. **Partial Progress Migration**: How to handle existing progress records?
   - Solution: Migration script adds default values, recalculates progress

---

## 📈 Future Enhancements

1. **Custom Certificate Templates** - Allow admins to design certificates
2. **Gradebook View** - Admin panel to see all student grades
3. **Grade Weights** - Different items worth different percentages
4. **Timed Quizzes** - Add time limits to graded quizzes
5. **Peer Review** - For assignment grading
6. **Learning Analytics** - Track time spent, attempts, common errors
7. **Badge System** - Micro-credentials for specific achievements
8. **Certificate Verification** - Public page to verify certificate authenticity

---

## ✅ Success Criteria

1. ✅ Admin can create both certification and non-certification courses
2. ✅ Admin can toggle grading on individual content items
3. ✅ Video quizzes auto-grade in certification courses
4. ✅ Students see different progress indicators based on course type
5. ✅ Quiz submissions are scored and tracked
6. ✅ Certificates are automatically issued upon completion
7. ✅ Students can view and download their certificates
8. ✅ Progress calculation is accurate for both course types
9. ✅ System handles retakes and multiple attempts
10. ✅ All existing functionality continues to work

---

## 📝 Notes & Considerations

- **Performance**: Progress calculation may need optimization for courses with many items
- **Data Migration**: Existing courses will default to non-certification
- **Backward Compatibility**: Old progress records will be marked as non-graded
- **Security**: Ensure quiz answers are validated server-side
- **UX**: Clear messaging about grading requirements
- **Accessibility**: Ensure certificate display is accessible
- **Mobile**: Quiz submission should work on mobile devices

---

## 🎓 Conclusion

This implementation plan provides a comprehensive roadmap for adding certification and grading capabilities to ECAST Academy. The phased approach allows for iterative development and testing while maintaining the existing functionality.

**Next Steps**:
1. Review and approve this plan
2. Prioritize phases based on business needs
3. Allocate resources for implementation
4. Begin with Phase 1 (Schema Changes)

---

**Status**: ⏳ **AWAITING APPROVAL**

Please review this plan and provide feedback before proceeding with implementation.
