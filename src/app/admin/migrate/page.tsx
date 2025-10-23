"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminMigrationPage() {
  const checkVideos = useQuery(api.migrations.checkVideosWithoutContent);
  const fixVideos = useMutation(api.migrations.fixStringifiedVideos);
  const migrateChapters = useMutation(api.migrations.migrateChaptersToContentItems);
  
  const [isFixingVideos, setIsFixingVideos] = useState(false);
  const [isMigratingChapters, setIsMigratingChapters] = useState(false);

  const handleFix = async () => {
    setIsFixingVideos(true);
    try {
      const result = await fixVideos();
      toast.success(`Migration complete! Fixed ${result.fixedVideos} out of ${result.totalVideos} videos.`);
      window.location.reload();
    } catch (error) {
      console.error("Migration failed:", error);
      toast.error("Migration failed. Check console for details.");
    } finally {
      setIsFixingVideos(false);
    }
  };

  const handleMigrateChapters = async () => {
    setIsMigratingChapters(true);
    try {
      const result = await migrateChapters();
      toast.success(result.message);
      window.location.reload();
    } catch (error) {
      console.error("Chapter migration failed:", error);
      toast.error("Chapter migration failed. Check console for details.");
    } finally {
      setIsMigratingChapters(false);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Database Migration</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Video Data Status</CardTitle>
          <CardDescription>
            Check if videos have properly formatted notes and quizzes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checkVideos ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Videos</p>
                  <p className="text-2xl font-bold">{checkVideos.total}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Videos Needing Fix</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {checkVideos.withoutContent}
                  </p>
                </div>
              </div>

              {checkVideos.withoutContent > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-2">Videos Needing Fix:</h3>
                  <ul className="space-y-2">
                    {checkVideos.videos.map((video: {
                      id: string;
                      title: string;
                      notesType: string;
                      quizType: string;
                    }) => (
                      <li key={video.id} className="text-sm border-l-2 pl-3 py-1">
                        <p className="font-medium">{video.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Notes: {video.notesType} | Quiz: {video.quizType}
                        </p>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    onClick={handleFix} 
                    className="mt-6 w-full"
                    size="lg"
                    disabled={isFixingVideos}
                  >
                    {isFixingVideos ? "Fixing..." : "Fix All Videos (Parse JSON Strings)"}
                  </Button>
                </div>
              )}

              {checkVideos.withoutContent === 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="text-green-700 dark:text-green-400 font-medium">
                    ✓ All videos have properly formatted data!
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p>Loading...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Migrate Chapters to Content Items</CardTitle>
          <CardDescription>
            Convert old chapter structure (videoId in chapter) to new content items system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This migration will create content items for chapters that have a videoId but no content items yet.
              This is necessary for courses created before the content items system was implemented.
            </p>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>What this does:</strong>
                <br />
                • Finds all chapters with a videoId
                <br />
                • Creates a video content item for each chapter if it doesn&apos;t have one
                <br />
                • Allows you to add additional content items to these chapters
              </p>
            </div>

            <Button 
              onClick={handleMigrateChapters} 
              className="w-full"
              size="lg"
              disabled={isMigratingChapters}
            >
              {isMigratingChapters ? "Migrating..." : "Migrate Chapters to Content Items"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}