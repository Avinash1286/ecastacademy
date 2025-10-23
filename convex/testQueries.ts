import { query } from "./_generated/server";

// Test query to check what's in a video
export const checkVideoData = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").take(1);
    
    if (videos.length > 0) {
      const video = videos[0];
      return {
        id: video._id,
        title: video.title,
        hasNotes: !!video.notes,
        hasQuiz: !!video.quiz,
        notesType: typeof video.notes,
        quizType: typeof video.quiz,
        notesKeys: video.notes ? Object.keys(video.notes) : [],
        quizKeys: video.quiz ? Object.keys(video.quiz) : [],
      };
    }
    
    return null;
  },
});

// Test query to check contentItems with chapter details
export const checkContentItems = query({
  args: {},
  handler: async (ctx) => {
    const contentItems = await ctx.db.query("contentItems").collect();
    
    const enriched = await Promise.all(
      contentItems.map(async (item) => {
        const chapter = await ctx.db.get(item.chapterId);
        return {
          contentItemId: item._id,
          chapterId: item.chapterId,
          chapterName: chapter?.name,
          chapterOrder: chapter?.order,
          type: item.type,
          title: item.title,
          order: item.order,
          textContent: item.textContent ? item.textContent.substring(0, 50) + "..." : null,
        };
      })
    );
    
    return enriched;
  },
});
