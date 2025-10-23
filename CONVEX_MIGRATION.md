# Convex Migration Guide

This application has been migrated from NeonDB/Drizzle to Convex.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Convex
```bash
npx convex dev
```

This command will:
- Create a Convex project (first time only)
- Generate TypeScript types in `convex/_generated/`
- Start the Convex development server
- Provide you with your `NEXT_PUBLIC_CONVEX_URL`

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

The URL will be provided when you run `npx convex dev`.

### 4. Run the Development Server

In a new terminal:
```bash
npm run dev
```

This will run both the Next.js and Convex development servers concurrently.

## Database Schema

The Convex schema includes three main tables:

### Videos
- `youtubeVideoId` (string, indexed)
- `title` (string)
- `url` (string)
- `thumbnailUrl` (optional string)
- `channelTitle` (optional string)
- `durationInSeconds` (optional number)
- `publishedAt` (optional number/timestamp)
- `transcript` (optional string)
- `notes` (JSON)
- `quiz` (JSON)
- `createdAt` (number/timestamp)

### Courses
- `name` (string)
- `description` (optional string)
- `createdAt` (number/timestamp)
- `updatedAt` (number/timestamp)

### Chapters
- `name` (string)
- `order` (number)
- `courseId` (reference to courses)
- `videoId` (reference to videos)
- `createdAt` (number/timestamp)

## Convex Functions

### Queries (Read Operations)
- `api.courses.getCourse` - Get a single course
- `api.courses.getAllCourses` - Get paginated courses list
- `api.courses.getCourseWithThumbnail` - Get course with thumbnail
- `api.courses.getChaptersForCourse` - Get chapters for a course
- `api.courses.getFullCourseChapters` - Get full course with chapter details
- `api.courses.getChaptersWithVideosByCourseId` - Get chapters with basic video info
- `api.videos.getVideo` - Get a video by ID
- `api.videos.findVideoByYoutubeId` - Find video by YouTube ID
- `api.chapters.getChapter` - Get a chapter by ID
- `api.chapters.getChaptersByCourseId` - Get chapters by course ID
- `api.chapters.getChapterWithDetails` - Get chapter with full course and video details

### Mutations (Write Operations)
- `api.courses.createCourse` - Create a new course
- `api.courses.updateCourse` - Update a course
- `api.courses.deleteCourse` - Delete a course (cascades to chapters)
- `api.videos.createVideo` - Create a new video
- `api.videos.updateVideo` - Update a video
- `api.videos.deleteVideo` - Delete a video (if not referenced)
- `api.chapters.createChapter` - Create a new chapter
- `api.chapters.updateChapter` - Update a chapter
- `api.chapters.deleteChapter` - Delete a chapter

## Key Changes

1. **Database Connection**: Replaced Drizzle ORM with Convex client
2. **Service Layer**: Created new `courseServiceConvex.ts` that uses Convex HTTP client
3. **API Routes**: Updated all API routes to use Convex service
4. **Schema**: Migrated from Drizzle schema to Convex schema
5. **IDs**: Convex uses its own ID system (`Id<"tablename">`) instead of UUIDs
6. **Timestamps**: Using `Date.now()` (milliseconds) instead of PostgreSQL timestamps
7. **JSON Fields**: Convex uses `v.any()` for JSON fields

## Development Workflow

1. Make changes to Convex functions in `convex/` directory
2. Convex automatically reloads and regenerates types
3. Use the generated types from `convex/_generated/` in your code
4. Test your changes in the Next.js app

## Deployment

To deploy to production:

```bash
npx convex deploy
```

This will deploy your Convex functions to production and provide you with a production URL.

Update your production environment variables with the production Convex URL.

## Notes

- Convex automatically handles relationships through ID references
- Cascade deletes are implemented in the mutation functions
- Indexes are defined in the schema for efficient queries
- All timestamps are stored as numbers (milliseconds since epoch)
- The `as any` type assertions in API routes will be resolved once Convex generates the types

## Troubleshooting

If you see TypeScript errors about missing Convex types:
1. Make sure `npx convex dev` is running
2. Check that `convex/_generated/` directory exists
3. Restart your TypeScript server in VS Code

For more information, see the [Convex documentation](https://docs.convex.dev).
