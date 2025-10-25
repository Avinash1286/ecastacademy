// Migration Script for Quiz & Certificate System
// Run this in Convex Dashboard > Functions tab

import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Migration script to fix existing progress records after quiz system upgrade
 * This should be run ONCE after deploying the new changes
 * 
 * What it does:
 * 1. Finds all certification courses
 * 2. Recalculates progress for each course
 * 3. Ensures completed status matches graded/ungraded logic
 * 4. Updates isGradedItem flags
 * 
 * Usage in Convex Dashboard:
 * 1. Go to Functions tab
 * 2. Create new mutation with this code
 * 3. Run it (no arguments needed)
 * 4. Check logs for results
 */

export const migrateQuizSystemData = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🚀 Starting quiz system migration...");
    
    // Get all courses
    const allCourses = await ctx.db.query("courses").collect();
    console.log(`Found ${allCourses.length} total courses`);
    
    // Filter certification courses
    const certificationCourses = allCourses.filter(c => c.isCertification);
    console.log(`Found ${certificationCourses.length} certification courses`);
    
    let totalUpdated = 0;
    const results = [];
    
    // Process each certification course
    for (const course of certificationCourses) {
      console.log(`\n📚 Processing course: ${course.name} (${course._id})`);
      
      // Get all chapters
      const chapters = await ctx.db
        .query("chapters")
        .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
        .collect();
      
      // Get all content items
      const contentItemsArrays = await Promise.all(
        chapters.map((chapter) =>
          ctx.db
            .query("contentItems")
            .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
            .collect()
        )
      );
      const contentItems = contentItemsArrays.flat();
      
      console.log(`  Found ${contentItems.length} content items`);
      
      // Get all progress records for this course
      const progressRecords = await ctx.db
        .query("progress")
        .filter((q) => q.eq(q.field("courseId"), course._id))
        .collect();
      
      console.log(`  Found ${progressRecords.length} progress records`);
      
      let courseUpdatedCount = 0;
      
      // Update each progress record
      for (const progress of progressRecords) {
        if (!progress.contentItemId) continue;
        
        const contentItem = contentItems.find(
          (item) => item._id === progress.contentItemId
        );
        
        if (!contentItem) {
          console.log(`  ⚠️  Content item not found for progress ${progress._id}`);
          continue;
        }
        
        const isGraded = contentItem.isGraded ?? false;
        const passed = progress.passed ?? false;
        const hasAttempts = (progress.attempts ?? 0) > 0;
        
        // Calculate what completed status should be
        let shouldBeCompleted;
        if (isGraded && course.isCertification) {
          // For graded items in cert courses: only completed if passed
          shouldBeCompleted = passed;
        } else {
          // For ungraded items: completed if attempted
          shouldBeCompleted = hasAttempts;
        }
        
        // Check if updates needed
        const needsUpdate =
          shouldBeCompleted !== progress.completed ||
          (progress.isGradedItem ?? false) !== isGraded;
        
        if (needsUpdate) {
          const updates: {
            completed?: boolean;
            isGradedItem?: boolean;
          } = {};
          
          if (shouldBeCompleted !== progress.completed) {
            updates.completed = shouldBeCompleted;
            console.log(
              `  ✏️  Updating progress ${progress._id}: completed ${progress.completed} → ${shouldBeCompleted}`
            );
          }
          
          if ((progress.isGradedItem ?? false) !== isGraded) {
            updates.isGradedItem = isGraded;
          }
          
          await ctx.db.patch(progress._id, updates);
          courseUpdatedCount++;
          totalUpdated++;
        }
      }
      
      results.push({
        courseId: course._id,
        courseName: course.name,
        progressRecords: progressRecords.length,
        updated: courseUpdatedCount,
      });
      
      console.log(`  ✅ Updated ${courseUpdatedCount} progress records`);
    }
    
    // Also process non-certification courses to fix isGradedItem flags
    const nonCertCourses = allCourses.filter(c => !c.isCertification);
    console.log(`\n📖 Processing ${nonCertCourses.length} non-certification courses...`);
    
    for (const course of nonCertCourses) {
      // Get all chapters
      const chapters = await ctx.db
        .query("chapters")
        .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
        .collect();
      
      // Get all content items
      const contentItemsArrays = await Promise.all(
        chapters.map((chapter) =>
          ctx.db
            .query("contentItems")
            .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
            .collect()
        )
      );
      const contentItems = contentItemsArrays.flat();
      
      // Get all progress records
      const progressRecords = await ctx.db
        .query("progress")
        .filter((q) => q.eq(q.field("courseId"), course._id))
        .collect();
      
      let courseUpdatedCount = 0;
      
      for (const progress of progressRecords) {
        if (!progress.contentItemId) continue;
        
        const contentItem = contentItems.find(
          (item) => item._id === progress.contentItemId
        );
        
        if (!contentItem) continue;
        
        const isGraded = contentItem.isGraded ?? false;
        const hasAttempts = (progress.attempts ?? 0) > 0;
        
        // For non-cert courses: completed if attempted
        const shouldBeCompleted = hasAttempts;
        
        const needsUpdate =
          shouldBeCompleted !== progress.completed ||
          (progress.isGradedItem ?? false) !== isGraded;
        
        if (needsUpdate) {
          const updates: {
            completed?: boolean;
            isGradedItem?: boolean;
          } = {};
          
          if (shouldBeCompleted !== progress.completed) {
            updates.completed = shouldBeCompleted;
          }
          
          if ((progress.isGradedItem ?? false) !== isGraded) {
            updates.isGradedItem = isGraded;
          }
          
          await ctx.db.patch(progress._id, updates);
          courseUpdatedCount++;
          totalUpdated++;
        }
      }
      
      if (courseUpdatedCount > 0) {
        results.push({
          courseId: course._id,
          courseName: course.name,
          progressRecords: progressRecords.length,
          updated: courseUpdatedCount,
        });
        
        console.log(`  ✅ ${course.name}: Updated ${courseUpdatedCount} records`);
      }
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Migration Complete!");
    console.log(`Total courses processed: ${allCourses.length}`);
    console.log(`Total progress records updated: ${totalUpdated}`);
    console.log("=".repeat(60));
    
    return {
      success: true,
      totalCourses: allCourses.length,
      certificationCourses: certificationCourses.length,
      totalUpdated,
      results,
    };
  },
});

/**
 * Helper function to verify migration results
 * Run this AFTER migration to check everything looks good
 */
export const verifyMigration = mutation({
  args: {
    courseId: v.optional(v.id("courses")),
  },
  handler: async (ctx, args) => {
    console.log("🔍 Verifying migration...\n");
    
    let coursesToCheck;
    
    if (args.courseId) {
      // Check specific course
      const course = await ctx.db.get(args.courseId);
      coursesToCheck = course ? [course] : [];
    } else {
      // Check all certification courses
      coursesToCheck = await ctx.db
        .query("courses")
        .filter((q) => q.eq(q.field("isCertification"), true))
        .collect();
    }
    
    const results = [];
    
    for (const course of coursesToCheck) {
      // Get chapters and content items
      const chapters = await ctx.db
        .query("chapters")
        .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
        .collect();
      
      const contentItemsArrays = await Promise.all(
        chapters.map((chapter) =>
          ctx.db
            .query("contentItems")
            .withIndex("by_chapterId", (q) => q.eq("chapterId", chapter._id))
            .collect()
        )
      );
      const contentItems = contentItemsArrays.flat();
      const gradedItems = contentItems.filter((item) => item.isGraded);
      
      // Get progress records
      const progressRecords = await ctx.db
        .query("progress")
        .filter((q) => q.eq(q.field("courseId"), course._id))
        .collect();
      
      // Check for inconsistencies
      const inconsistencies = [];
      
      for (const progress of progressRecords) {
        if (!progress.contentItemId) continue;
        
        const contentItem = contentItems.find(
          (item) => item._id === progress.contentItemId
        );
        
        if (!contentItem) continue;
        
        const isGraded = contentItem.isGraded ?? false;
        const passed = progress.passed ?? false;
        
        // For graded items in cert courses: completed should equal passed
        if (isGraded && course.isCertification) {
          if (progress.completed !== passed) {
            inconsistencies.push({
              progressId: progress._id,
              contentItemId: contentItem._id,
              issue: `Completed (${progress.completed}) doesn't match passed (${passed})`,
            });
          }
        }
        
        // Check isGradedItem flag
        if ((progress.isGradedItem ?? false) !== isGraded) {
          inconsistencies.push({
            progressId: progress._id,
            contentItemId: contentItem._id,
            issue: `isGradedItem (${progress.isGradedItem}) doesn't match contentItem.isGraded (${isGraded})`,
          });
        }
      }
      
      results.push({
        courseId: course._id,
        courseName: course.name,
        isCertification: course.isCertification,
        stats: {
          totalItems: contentItems.length,
          gradedItems: gradedItems.length,
          progressRecords: progressRecords.length,
          inconsistencies: inconsistencies.length,
        },
        inconsistencies,
      });
      
      console.log(`\n📚 ${course.name}`);
      console.log(`  Total items: ${contentItems.length}`);
      console.log(`  Graded items: ${gradedItems.length}`);
      console.log(`  Progress records: ${progressRecords.length}`);
      console.log(`  Inconsistencies: ${inconsistencies.length}`);
      
      if (inconsistencies.length > 0) {
        console.log("  ⚠️  Issues found:");
        inconsistencies.forEach((issue, i) => {
          console.log(`    ${i + 1}. ${issue.issue}`);
        });
      } else {
        console.log("  ✅ All good!");
      }
    }
    
    return {
      coursesChecked: coursesToCheck.length,
      totalInconsistencies: results.reduce(
        (sum, r) => sum + r.stats.inconsistencies,
        0
      ),
      results,
    };
  },
});
