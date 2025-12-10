"use client";

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, Users, BookOpen, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { CapsuleBookmarkButton } from '@/components/capsule/CapsuleBookmarkButton';

const CAPSULES_PER_PAGE = 12;

export default function CommunityCapsulePage() {
  const router = useRouter();
  const { data: session } = useAuth();
  const userId = session?.user?.id as Id<"users"> | undefined;

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [capsuleItems, setCapsuleItems] = useState<Array<{
    _id: Id<"capsules">;
    userId: Id<"users">;
    title: string;
    description?: string | null;
    moduleCount?: number | null;
    estimatedDuration?: number | null;
  }>>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  // Fetch community capsules with pagination (includes user's own public capsules)
  const communityCapsules = useQuery(
    api.capsules.getCommunityCapsules,
    {
      limit: CAPSULES_PER_PAGE,
      cursor,
    }
  );

  const loading = communityCapsules === undefined && capsuleItems.length === 0;

  // Accumulate pages instead of replacing
  useEffect(() => {
    if (!communityCapsules) return;

    setHasMore(communityCapsules.hasMore);
    setNextCursor(communityCapsules.nextCursor ?? undefined);

    setCapsuleItems((prev) => {
      // If cursor is undefined, this is the first page – replace
      if (!cursor) {
        return communityCapsules.capsules;
      }
      // Append new page, avoiding duplicates
      const existingIds = new Set(prev.map((c) => c._id));
      const newOnes = communityCapsules.capsules.filter((c) => !existingIds.has(c._id));
      return [...prev, ...newOnes];
    });

    setIsLoadingMore(false);
  }, [communityCapsules, cursor]);

  const handleLoadMore = useCallback(() => {
    if (nextCursor) {
      setIsLoadingMore(true);
      setCursor(nextCursor);
    }
  }, [nextCursor]);



  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="gap-1 -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
              Community Capsules
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Explore capsules shared by the community
            </p>
          </div>
        </div>

        {/* Capsules Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full mb-4" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : capsuleItems.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {capsuleItems.map((capsule) => {
                const isOwn = userId && capsule.userId === userId;
                return (
                <Card 
                  key={capsule._id} 
                  className={`overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group ${isOwn ? 'ring-1 ring-primary/30' : ''}`}
                  onClick={() => router.push(`/capsule/learn/${capsule._id}`)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                        <Globe className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="flex items-center gap-2">
                        {!isOwn && (
                          <CapsuleBookmarkButton
                            capsuleId={capsule._id}
                            userId={userId}
                          />
                        )}
                        {isOwn ? (
                          <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                            Yours
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                            Public
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors mt-3">
                      {capsule.title}
                    </CardTitle>
                    {capsule.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                        {capsule.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      {capsule.moduleCount !== undefined && (
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          <span>{capsule.moduleCount} modules</span>
                        </div>
                      )}
                      {capsule.estimatedDuration && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{capsule.estimatedDuration} min</span>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end pt-3 border-t border-border/50">
                      <Button size="sm" variant="ghost" className="gap-1">
                        Learn
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )})}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="p-6 rounded-full bg-muted inline-block mb-4">
              <Globe className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No community capsules yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Be the first to share! Make your completed capsules public from your library to help others learn.
            </p>
            <Button asChild className="gap-2">
              <Link href="/dashboard/capsule/library">
                Go to My Library
              </Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
