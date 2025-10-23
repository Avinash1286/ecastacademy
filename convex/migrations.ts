import { mutation, query } from "./_generated/server";

// Query to check videos without proper notes/quiz
export const checkVideosWithoutContent = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").collect();
    
    const videosWithoutContent = videos.filter(video => {
      const hasValidNotes = video.notes && 
                           typeof video.notes === 'object' && 
                           'topic' in video.notes && 
                           'sections' in video.notes;
      const hasValidQuiz = video.quiz && 
                          typeof video.quiz === 'object' && 
                          'topic' in video.quiz && 
                          'questions' in video.quiz;
      return !hasValidNotes || !hasValidQuiz;
    });
    
    return {
      total: videos.length,
      withoutContent: videosWithoutContent.length,
      videos: videosWithoutContent.map(v => ({
        id: v._id,
        title: v.title,
        hasValidNotes: !!(v.notes && typeof v.notes === 'object' && 'topic' in v.notes),
        hasValidQuiz: !!(v.quiz && typeof v.quiz === 'object' && 'topic' in v.quiz),
        notesType: typeof v.notes,
        quizType: typeof v.quiz,
      }))
    };
  },
});

// Mutation to fix videos with stringified JSON
export const fixStringifiedVideos = mutation({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").collect();
    let fixedCount = 0;
    
    for (const video of videos) {
      let needsUpdate = false;
      let updatedNotes = video.notes;
      let updatedQuiz = video.quiz;
      
      // Check if notes is a string and parse it
      if (typeof video.notes === 'string') {
        try {
          updatedNotes = JSON.parse(video.notes);
          needsUpdate = true;
        } catch (e) {
          console.error(`Failed to parse notes for video ${video._id}:`, e);
        }
      }
      
      // Check if quiz is a string and parse it
      if (typeof video.quiz === 'string') {
        try {
          updatedQuiz = JSON.parse(video.quiz);
          needsUpdate = true;
        } catch (e) {
          console.error(`Failed to parse quiz for video ${video._id}:`, e);
        }
      }
      
      if (needsUpdate) {
        await ctx.db.patch(video._id, {
          notes: updatedNotes,
          quiz: updatedQuiz,
        });
        fixedCount++;
      }
    }
    
    return {
      totalVideos: videos.length,
      fixedVideos: fixedCount,
    };
  },
});

// Note: To regenerate notes and quizzes for existing videos, 
// you'll need to either:
// 1. Delete and recreate the courses (recommended)
// 2. Manually run the AI generation again for each video

// Query to check videos without status field
export const checkVideosWithoutStatus = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").collect();
    
    const videosWithoutStatus = videos.filter(video => !video.status);
    
    return {
      total: videos.length,
      withoutStatus: videosWithoutStatus.length,
      videos: videosWithoutStatus.map(v => ({
        id: v._id,
        title: v.title,
        createdAt: v.createdAt,
      }))
    };
  },
});

// Mutation to add default status to existing videos
export const addDefaultStatusToVideos = mutation({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").collect();
    let updatedCount = 0;
    
    for (const video of videos) {
      if (!video.status) {
        await ctx.db.patch(video._id, {
          status: "completed", // Existing videos are already processed
          updatedAt: Date.now(),
        });
        updatedCount++;
      }
    }
    
    return {
      totalVideos: videos.length,
      updatedVideos: updatedCount,
    };
  },
});

// Mutation to migrate chapters with videoId to content items
export const migrateChaptersToContentItems = mutation({
  args: {},
  handler: async (ctx) => {
    const chapters = await ctx.db.query("chapters").collect();
    let migratedCount = 0;
    
    for (const chapter of chapters) {
      // Check if chapter has a videoId but no content items
      if (chapter.videoId) {
        const existingContentItems = await ctx.db
          .query("contentItems")
          .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
          .collect();
        
        // Only migrate if there are no content items yet
        if (existingContentItems.length === 0) {
          const video = await ctx.db.get(chapter.videoId);
          
          if (video) {
            // Create a content item for this video
            await ctx.db.insert("contentItems", {
              chapterId: chapter._id,
              type: "video",
              title: video.title,
              order: 1,
              videoId: chapter.videoId,
              createdAt: Date.now(),
            });
            migratedCount++;
          }
        }
      }
    }
    
    return {
      totalChapters: chapters.length,
      migratedChapters: migratedCount,
      message: `Successfully migrated ${migratedCount} chapters to use content items`,
    };
  },
});
