"use client"

import Link from "next/link";
import { ArrowLeft, Award, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "convex/react";
import { useSession } from "next-auth/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface LearnspaceNavbarProps {
  courseTitle: string;
  courseId: Id<"courses">;
  isCertification?: boolean;
}

// Extend session user type to include id
interface ExtendedUser {
  id: Id<"users">
  name?: string | null
  email?: string | null
  image?: string | null
}

export function LearnspaceNavbar({ courseTitle, courseId, isCertification }: LearnspaceNavbarProps) {
  const { data: session, status } = useSession();
  
  // Get userId from session
  const userId = session?.user ? (session.user as ExtendedUser).id : undefined;
  
  // Fetch course progress for all courses
  const courseProgress = useQuery(
    api.completions.calculateCourseProgress,
    userId && status === "authenticated" ? { courseId, userId } : "skip"
  );

  return (
    <nav className="sticky top-0 z-10 flex h-14 w-full items-center justify-between gap-4 border-b border-border bg-background px-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard" aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-medium text-foreground text-ellipsis">
            {courseTitle}
          </h1>
          {isCertification && (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
              <Award className="h-3 w-3 mr-1" />
              Certificate
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Show completion and grading progress for certification courses */}
        {isCertification && courseProgress && courseProgress.isCertification && (
          <>
            {/* Completion Progress */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border">
                    <div className="flex flex-col min-w-[100px]">
                      <div className="flex items-center justify-between gap-2 text-xs font-medium">
                        <span className="text-muted-foreground">Items</span>
                        <span className="font-semibold">
                          {courseProgress.completedItems}/{courseProgress.totalItems}
                        </span>
                      </div>
                      <Progress 
                        value={courseProgress.completionPercentage} 
                        className="h-1.5 mt-1"
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{courseProgress.completedItems}/{courseProgress.totalItems} items attempted</p>
                  {courseProgress.completionPercentage === 100 && !courseProgress.eligibleForCertificate && (
                    <p className="text-amber-500 mt-1">⚠️ All items attempted, but need passing grades</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Grade Progress - More prominent */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md border",
                    (courseProgress.overallGrade || 0) >= 70
                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                      : courseProgress.overallGrade !== null
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                      : "bg-muted/50"
                  )}>
                    <TrendingUp className={cn(
                      "h-4 w-4",
                      (courseProgress.overallGrade || 0) >= 70
                        ? "text-green-600"
                        : "text-amber-600"
                    )} />
                    <div className="flex flex-col min-w-[100px]">
                      <div className="flex items-center justify-between gap-2 text-xs font-medium">
                        <span className="text-muted-foreground">Grade</span>
                        <span className={cn(
                          "font-bold text-base",
                          (courseProgress.overallGrade || 0) >= 70
                            ? 'text-green-600 dark:text-green-400'
                            : courseProgress.overallGrade !== null
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-muted-foreground'
                        )}>
                          {courseProgress.overallGrade !== null 
                            ? `${Math.round(courseProgress.overallGrade)}%`
                            : '-'
                          }
                        </span>
                      </div>
                      <Progress 
                        value={courseProgress.overallGrade || 0} 
                        className={cn(
                          "h-1.5 mt-1",
                          (courseProgress.overallGrade || 0) >= 70 && "[&>div]:bg-green-500"
                        )}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2">
                    <p className="font-semibold">Course Grade</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Passed Graded Items:</span>
                        <span className={cn(
                          "font-medium",
                          courseProgress.passedGradedItems === courseProgress.gradedItems
                            ? "text-green-600 dark:text-green-400"
                            : "text-amber-600 dark:text-amber-400"
                        )}>
                          {courseProgress.passedGradedItems}/{courseProgress.gradedItems}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Overall Grade:</span>
                        <span className={cn(
                          "font-medium",
                          (courseProgress.overallGrade || 0) >= 70
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}>
                          {courseProgress.overallGrade !== null
                            ? `${Math.round(courseProgress.overallGrade)}%`
                            : 'Not started'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Required to Pass:</span>
                        <span className="font-medium">70%</span>
                      </div>
                    </div>
                    {courseProgress.eligibleForCertificate ? (
                      <p className="text-green-600 dark:text-green-400 font-medium pt-2 border-t">
                        ✓ Eligible for certificate!
                      </p>
                    ) : courseProgress.completionPercentage === 100 ? (
                      <p className="text-amber-600 dark:text-amber-400 font-medium pt-2 border-t">
                        ⚠️ Improve your grades to earn certificate
                      </p>
                    ) : null}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Certificate Button - Show when eligible */}
            {courseProgress.eligibleForCertificate && (
              <Button 
                asChild
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
              >
                <Link href="/dashboard/profile?tab=certificates">
                  <Award className="h-4 w-4 mr-2" />
                  Get Certificate
                </Link>
              </Button>
            )}
            
            {/* Show "Not Eligible" indicator when all items done but not passing */}
            {!courseProgress.eligibleForCertificate && courseProgress.completionPercentage === 100 && courseProgress.overallGrade !== null && (
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-3 w-3 mr-1" />
                Need {70}% Grade
              </Badge>
            )}
          </>
        )}

        {/* Course completion progress for all courses */}
        {!isCertification && courseProgress && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border">
                  <div className="flex flex-col min-w-[80px]">
                    <div className="flex items-center justify-between gap-2 text-xs font-medium">
                      <span>Progress</span>
                      <span className="font-semibold">
                        {Math.round(courseProgress.completionPercentage)}%
                      </span>
                    </div>
                    <Progress 
                      value={courseProgress.completionPercentage} 
                      className="h-1.5 mt-1"
                    />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{courseProgress.completedItems}/{courseProgress.totalItems} items completed</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </nav>
  );
}