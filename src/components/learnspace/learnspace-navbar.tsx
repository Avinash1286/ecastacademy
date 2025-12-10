"use client"

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Award, TrendingUp, Volume2, VolumeX, ChevronDown, CheckCircle2, Circle } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useSoundEffects } from "@/hooks/useSoundEffects";

interface LearnspaceNavbarProps {
  courseTitle: string;
  courseId: Id<"courses">;
  isCertification?: boolean;
}

export function LearnspaceNavbar({ courseTitle, courseId, isCertification }: LearnspaceNavbarProps) {
  const { data: session, status } = useAuth();
  const router = useRouter();
  const [isIssuing, setIsIssuing] = useState(false);
  const requestCertificate = useMutation(api.certificates.requestCertificate);
  const { isMuted, toggleMute } = useSoundEffects();
  
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
  const certificateAvailable = Boolean(
    courseProgress?.requirementsMet || courseProgress?.hasCertificate
  );
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

  const handleCertificateClick = async () => {
    if (certificateIssued) {
      router.push("/dashboard/certificates");
      return;
    }

    if (!userId) {
      toast.error("Please sign in to access your certificate");
      router.push("/auth/signin");
      return;
    }

    if (!courseProgress?.requirementsMet) {
      toast.error("Complete all requirements before generating the certificate");
      return;
    }

    setIsIssuing(true);
    try {
      const result = await requestCertificate({ userId, courseId });

      if (result.issued || result.alreadyIssued) {
        toast.success(result.issued ? "Certificate generated!" : "Certificate ready");
        router.push("/dashboard/certificates");
        return;
      }

      if (!result.eligible) {
        toast.error(result.reason ?? "Certificate requirements not met yet");
        return;
      }

      toast.error("Unable to issue certificate. Please try again.");
    } catch (error) {
      console.error("Certificate issuance error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate certificate");
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <nav className="sticky top-0 z-10 flex h-14 w-full items-center justify-between gap-2 sm:gap-4 border-b border-border bg-background px-2 sm:px-4">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href="/dashboard" aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <h1 className="truncate text-base sm:text-lg font-medium text-foreground max-w-[150px] sm:max-w-none">
            {courseTitle}
          </h1>
          {isCertification && (
            <Badge variant="secondary" className="hidden sm:flex bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 shrink-0">
              <Award className="h-3 w-3 mr-1" />
              Certificate
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        {/* Sound Toggle Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={toggleMute}
                className="h-8 w-8 sm:h-9 sm:w-9"
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isMuted ? "Unmute sounds" : "Mute sounds"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Mobile Progress Popover - Only visible on mobile for certification courses */}
        {isCertification && courseProgress && courseProgress.isCertification && (
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className={cn(
                  "md:hidden h-8 px-2 gap-1",
                  gradeMeetsThreshold 
                    ? "border-green-500/50 bg-green-50 dark:bg-green-950/20" 
                    : "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"
                )}
              >
                <TrendingUp className={cn(
                  "h-4 w-4",
                  gradeMeetsThreshold ? "text-green-600" : "text-amber-600"
                )} />
                <span className={cn(
                  "text-sm font-bold",
                  gradeMeetsThreshold ? "text-green-600" : "text-amber-600"
                )}>
                  {overallGradeValue !== null ? `${Math.round(overallGradeValue)}%` : '-'}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Course Progress</h4>
                  {isCertification && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                      <Award className="h-3 w-3 mr-1" />
                      Certificate
                    </Badge>
                  )}
                </div>
                
                {/* Items Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Items Completed</span>
                    <span className="font-semibold">
                      {courseProgress.completedItems}/{courseProgress.totalItems}
                    </span>
                  </div>
                  <Progress value={courseProgress.completionPercentage} className="h-2" />
                </div>

                {/* Grade Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Overall Grade</span>
                    <span className={cn(
                      "font-bold",
                      gradeMeetsThreshold
                        ? "text-green-600 dark:text-green-400"
                        : overallGradeValue !== null
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                    )}>
                      {overallGradeValue !== null ? `${Math.round(overallGradeValue)}%` : 'Not started'}
                    </span>
                  </div>
                  <Progress 
                    value={overallGradeValue ?? 0} 
                    className={cn(
                      "h-2",
                      gradeMeetsThreshold && "[&>div]:bg-green-500"
                    )}
                  />
                  {/* Additional grade details */}
                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span>Passed: <span className={cn(
                      "font-medium",
                      totalGradedItems > 0 && passedGradedItems === totalGradedItems
                        ? "text-green-600 dark:text-green-400"
                        : "text-amber-600 dark:text-amber-400"
                    )}>{passedGradedItems}/{totalGradedItems}</span></span>
                    <span>Required: <span className="font-medium">{passingThreshold}%</span></span>
                  </div>
                </div>

                {/* Requirements Checklist */}
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Certificate Requirements</p>
                  {requirementChecks.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      {item.met ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <span className={item.met ? "text-green-600" : "text-muted-foreground"}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Certificate Button */}
                <div className="pt-3 border-t">
                  {certificateAvailable ? (
                    <Button
                      size="sm"
                      disabled={isIssuing}
                      onClick={handleCertificateClick}
                      className={cn(
                        "w-full text-white shadow-lg",
                        certificateIssued
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-green-600 hover:bg-green-700"
                      )}
                    >
                      <Award className="h-4 w-4 mr-2" />
                      {certificateIssued
                        ? "View Certificate"
                        : isIssuing
                          ? "Generating..."
                          : "Get Certificate"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled
                      className="w-full cursor-not-allowed"
                      variant="outline"
                    >
                      <Award className="h-4 w-4 mr-2 opacity-50" />
                      Get Certificate
                    </Button>
                  )}
                  {!certificateAvailable && completedAllItems && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
                      ⚠️ Improve your grades to earn certificate
                    </p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Mobile Progress for non-certification courses */}
        {!isCertification && courseProgress && (
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="sm:hidden h-8 px-2 gap-1"
              >
                <span className="text-sm font-semibold">
                  {Math.round(courseProgress.completionPercentage)}%
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="end">
              <div className="space-y-3">
                <h4 className="font-semibold">Course Progress</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="font-semibold">
                      {courseProgress.completedItems}/{courseProgress.totalItems} items
                    </span>
                  </div>
                  <Progress value={courseProgress.completionPercentage} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    {Math.round(courseProgress.completionPercentage)}% complete
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Show completion and grading progress for certification courses */}
        {isCertification && courseProgress && courseProgress.isCertification && (
          <>
            {/* Completion Progress - Hidden on mobile */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border">
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

            {/* Grade Progress - Hidden on mobile */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border",
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

            {/* Certificate Button - Hidden on mobile, shown on md and up */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="hidden md:block">
                    {certificateAvailable ? (
                      <Button
                        size="sm"
                        disabled={isIssuing}
                        onClick={handleCertificateClick}
                        className={cn(
                          "text-white shadow-lg",
                          certificateIssued
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "bg-green-600 hover:bg-green-700"
                        )}
                      >
                        <Award className="h-4 w-4 mr-2" />
                        {certificateIssued
                          ? "View Certificate"
                          : isIssuing
                            ? "Generating..."
                            : "Get Certificate"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled
                        className="cursor-not-allowed"
                        variant="outline"
                      >
                        <Award className="h-4 w-4 opacity-50 mr-2" />
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

        {/* Course completion progress for non-certification courses - Hidden on mobile */}
        {!isCertification && courseProgress && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border">
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