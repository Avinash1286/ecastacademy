import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every 5 minutes to clean up stuck videos
// Videos in "processing" status for more than 10 minutes will be marked as "failed"
crons.interval(
  "cleanup-stuck-videos",
  { minutes: 5 },
  internal.videoProcessing.cleanupStuckVideos
);

export default crons;
