# Text Quiz Generation Feature

## Overview
This feature allows instructors to generate quizzes from text content items using AI. The quiz generation works similarly to video transcript quiz generation, with proper state management for pending, processing, completed, and failed states.

## Changes Made

### 1. Schema Updates (`convex/schema.ts`)
Added quiz-related fields to contentItems table:
- `textQuiz`: Stores the generated quiz data (JSON)
- `textQuizStatus`: Tracks generation status ('pending' | 'processing' | 'completed' | 'failed')
- `textQuizError`: Stores error message if generation fails

### 2. Convex Mutations (`convex/contentItems.ts`)
Added new mutations:
- `updateTextQuizStatus`: Updates quiz generation status and data
- `getContentItemById`: Retrieves a specific content item by ID

### 3. API Endpoint (`src/app/api/ai/generate-text-quiz/route.ts`)
New POST endpoint that:
- Accepts `contentItemId` in request body
- Validates that the content item is of type 'text'
- Sets status to 'processing'
- Calls `generateQuiz()` from aimodel service with text content
- Updates status to 'completed' with quiz data on success
- Updates status to 'failed' with error message on failure

### 4. Course Builder UI (`src/app/admin/courses/[courseId]/builder/page.tsx`)
Enhanced with:
- **State Management**:
  - `generatingQuizForContentId`: Tracks which content item is generating
  
- **Handler Functions**:
  - `handleGenerateTextQuiz()`: Initiates quiz generation
  - `handleRetryTextQuiz()`: Retries failed quiz generation
  
- **UI Components**:
  - "Generate Quiz" button (sparkles icon) for text content without quiz
  - "Retry" button (rotating icon) for failed quiz generation
  - "Regenerate" button for completed quizzes
  - Status badges showing quiz state:
    - Yellow "Quiz Pending" with alert icon
    - Blue "Generating Quiz" with spinning loader
    - Green "Quiz Ready" with checkmark
    - Red "Quiz Failed" with alert icon
  
- **Icons Added**:
  - `Sparkles`: Generate quiz button
  - `Loader2`: Processing indicator
  - `AlertCircle`: Pending/Failed status
  - `CheckCircle`: Completed status
  - `RotateCcw`: Retry/Regenerate button

### 5. Learnspace Display (`src/components/learnspace/ai-tutor-panel.tsx`)
Updated quiz rendering logic:
- **For Text Content**:
  - Notes tab: Shows formatted text content
  - Quizzes tab: Shows generated quiz if available (`textQuiz`)
  - Shows "No quiz available" message if not generated yet
  - Chat tab: Shows "Not available" message
  
- **For Video Content**:
  - Maintains existing functionality (shows video quiz)

### 6. Type Definitions (`src/lib/types/index.ts`)
Updated `ContentItem` type with:
```typescript
textQuiz?: Quiz;
textQuizStatus?: 'pending' | 'processing' | 'completed' | 'failed';
textQuizError?: string;
```

### 7. Data Layer (`convex/courses.ts`)
Updated `getChaptersWithVideosByCourseId` to include:
- `textQuiz`
- `textQuizStatus`
- `textQuizError`

in enriched content items response.

## User Flow

### Instructor Experience (Course Builder)

1. **Create Text Content**:
   - Instructor adds a text content item to a chapter
   - Uses rich text editor to write content

2. **Generate Quiz**:
   - Clicks sparkles icon next to edit button
   - Toast notification: "Generating quiz from text content..."
   - Button shows spinning loader
   - Status badge shows "Generating Quiz" (blue)

3. **Quiz Generation States**:
   - **Success**: Badge changes to "Quiz Ready" (green), button becomes "Regenerate"
   - **Failure**: Badge shows "Quiz Failed" (red), button becomes "Retry"

4. **Retry Failed Generation**:
   - Clicks retry button
   - Confirms retry action
   - Generation process restarts

5. **Regenerate Quiz**:
   - Clicks regenerate button on completed quiz
   - Generates new quiz from same content

### Student Experience (Learnspace)

1. **Select Text Content**:
   - Student clicks on text content item in chapter list

2. **View Content**:
   - **Notes Tab**: Shows formatted text content with rich formatting

3. **Take Quiz**:
   - **Quizzes Tab**: 
     - If quiz generated: Shows interactive quiz interface
     - If not generated: Shows "No quiz available" message

4. **Quiz Interface**:
   - Same quiz interface as video quizzes
   - Multiple choice questions
   - Instant feedback
   - Score and results display

## Technical Details

### State Flow
```
Initial → [Click Generate] → Processing → [AI Generation] → Completed/Failed
                                                          ↓
                                                    [Click Retry] → Processing
```

### API Request/Response

**Request**:
```json
POST /api/ai/generate-text-quiz
{
  "contentItemId": "k17abc123..."
}
```

**Success Response**:
```json
{
  "success": true,
  "quiz": {
    "topic": "Introduction to React",
    "questions": [
      {
        "question": "What is React?",
        "options": ["Library", "Framework", "Language", "Tool"],
        "correctAnswer": 0,
        "explanation": "React is a JavaScript library..."
      }
    ]
  }
}
```

**Error Response**:
```json
{
  "error": "Failed to generate quiz"
}
```

### Database Updates

When generating quiz:
1. Status set to 'processing'
2. On success: `textQuiz` populated, status set to 'completed'
3. On failure: `textQuizError` populated, status set to 'failed'

## Benefits

1. **Automated Assessment**: Automatically generate quizzes from any text content
2. **Consistent UX**: Same quiz interface for both video and text content
3. **Graceful Error Handling**: Clear feedback and retry mechanism
4. **Flexible Content**: Supports regeneration if content is updated
5. **Student Engagement**: More interactive learning with quizzes on all content types

## Future Enhancements

Possible improvements:
- Auto-generate quiz when text content is created
- Manual quiz editing interface
- Quiz difficulty settings
- Question count configuration
- Export/import quiz questions
- Analytics on quiz performance
