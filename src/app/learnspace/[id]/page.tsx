import { getCourseChapters } from '@/lib/services/courseService';
import Learnspace from '@/components/learnspace/Learnspace';
import { BookOpen, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function LearningPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const chapters = await getCourseChapters(id);

  if (!chapters || chapters.length === 0) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-8">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="mb-6 rounded-full bg-muted p-6">
            <BookOpen className="h-16 w-16 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            No Content Available
          </h1>
          <p className="text-muted-foreground mb-8 text-lg">
            This course doesn&apos;t have any chapters or content yet. Please check back later or contact the course administrator.
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <Learnspace initialChapters={chapters as unknown as import('@/lib/types').ChapterWithVideo[]} />;
}