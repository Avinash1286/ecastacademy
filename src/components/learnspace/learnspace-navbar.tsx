"use client"

import Link from "next/link";
import { ArrowLeft, Award, TrendingUp } from "lucide-react";
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

export function LearnspaceNavbar({ courseTitle, courseId, isCertification }: LearnspaceNavbarProps) {
  const { data: session, status } = useSession();
  
  // Get userId from session
  const userId = session?.user && "id" in session.user
    ? (session.user.id as Id<"users">)
    : undefined;
  
  // Fetch course progress for all courses
  const courseProgress = useQuery(
    api.completions.calculateCourseProgress,
    userId && status === "authenticated" ? { courseId, userId } : "skip"
  );

  const certificateIssued = Boolean(courseProgress?.hasCertificate);
  const certificateRequirementsMet = Boolean(courseProgress?.requirementsMet);
  const certificateAvailable = Boolean(courseProgress?.eligibleForCertificate);
  const passingThreshold = courseProgress?.passingGrade ?? 70;
  const overallGradeValue = courseProgress?.overallGrade ?? null;
  const gradeMeetsThreshold = overallGradeValue !== null && overallGradeValue >= passingThreshold;
  const passedGradedItems = courseProgress?.passedGradedItems ?? 0;
  const totalGradedItems = courseProgress?.gradedItems ?? 0;
  const completedAllItems = (courseProgress?.completionPercentage ?? 0) >= 100 && (courseProgress?.totalItems ?? 0) > 0;
  const requirementChecks = [
    {
      label: courseProgress
        ? `Complete all ${courseProgress.totalItems} items (${courseProgress.completedItems} done)`
        : "Complete all items",
      met: completedAllItems,
    },
    {
      label:
        totalGradedItems > 0
          ? `Pass all ${totalGradedItems} graded items (${passedGradedItems} passed)`
          : "Graded assessments configured",
      met: totalGradedItems > 0 ? passedGradedItems === totalGradedItems : false,
    },
    {
      label: `Achieve ${passingThreshold}% overall grade (current: ${overallGradeValue !== null ? Math.round(overallGradeValue) : 0}%)`,
      met: gradeMeetsThreshold,
    },
  ];

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
                  <p>{courseProgress.completedItems}/{courseProgress.totalItems} items completed</p>
                  {completedAllItems && !certificateRequirementsMet && !certificateIssued && (
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
                    gradeMeetsThreshold
                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                      : overallGradeValue !== null
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                      : "bg-muted/50"
                  )}>
                    <TrendingUp className={cn(
                      "h-4 w-4",
                      gradeMeetsThreshold
                        ? "text-green-600"
                        : "text-amber-600"
                    )} />
                    <div className="flex flex-col min-w-[100px]">
                      <div className="flex items-center justify-between gap-2 text-xs font-medium">
                        <span className="text-muted-foreground">Grade</span>
                        <span className={cn(
                          "font-bold text-base",
                          gradeMeetsThreshold
                            ? 'text-green-600 dark:text-green-400'
                            : overallGradeValue !== null
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-muted-foreground'
                        )}>
                          {overallGradeValue !== null 
                            ? `${Math.round(overallGradeValue)}%`
                            : '-'
                          }
                        </span>
                      </div>
                      <Progress 
                        value={overallGradeValue ?? 0} 
                        className={cn(
                          "h-1.5 mt-1",
                          gradeMeetsThreshold && "[&>div]:bg-green-500"
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
                          totalGradedItems > 0 && passedGradedItems === totalGradedItems
                            ? "text-green-600 dark:text-green-400"
                            : "text-amber-600 dark:text-amber-400"
                        )}>
                          {passedGradedItems}/{totalGradedItems}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Overall Grade:</span>
                        <span className={cn(
                          "font-medium",
                          gradeMeetsThreshold
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}>
                          {overallGradeValue !== null
                            ? `${Math.round(overallGradeValue)}%`
                            : 'Not started'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Required to Pass:</span>
                        <span className="font-medium">{passingThreshold}%</span>
                      </div>
                    </div>
                    {certificateAvailable ? (
                      <p className="text-green-600 dark:text-green-400 font-medium pt-2 border-t">
                        {certificateIssued ? '✓ Certificate already issued' : '✓ Eligible for certificate!'}
                      </p>
                    ) : completedAllItems ? (
                      <p className="text-amber-600 dark:text-amber-400 font-medium pt-2 border-t">
                        ⚠️ Improve your grades to earn certificate
                      </p>
                    ) : null}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Certificate Button - Always show for certification courses */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    {certificateAvailable ? (
                      <Button
                        asChild
                        size="sm"
                        className={cn(
                          "text-white shadow-lg",
                          certificateIssued
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "bg-green-600 hover:bg-green-700"
                        )}
                      >
                        <Link href="/dashboard/certificates">
                          <Award className="h-4 w-4 mr-2" />
                          {certificateIssued ? "View Certificate" : "Get Certificate"}
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled
                        className="cursor-not-allowed"
                        variant="outline"
                      >
                        <Award className="h-4 w-4 mr-2 opacity-50" />
                        Get Certificate
                      </Button>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {certificateAvailable ? (
                    certificateIssued ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-green-600">🎉 Certificate Ready</p>
                        <p className="text-sm">You&apos;ve already earned this certificate.</p>
                        <p className="text-xs text-muted-foreground">Click to view and download.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-green-600">🎉 Congratulations!</p>
                        <p className="text-sm">All requirements met. Download your certificate.</p>
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <p className="font-semibold">Certificate Requirements</p>
                      <div className="text-sm space-y-1">
                        {requirementChecks.map((item, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className={item.met ? "text-green-600" : "text-amber-600"}>
                              {item.met ? "✓" : "○"}
                            </span>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {/* Course completion progress for non-certification courses */}
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