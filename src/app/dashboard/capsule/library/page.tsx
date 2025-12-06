"use client";

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Clock, BookOpen, Plus, Loader2, CheckCircle2, XCircle, Globe, Lock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

export default function CapsuleLibraryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = session?.user?.id as Id<"users"> | undefined;

  const capsules = useQuery(
    api.capsules.getUserCapsules,
    userId
      ? {
          userId,
        }
      : "skip"
  );

  // Mutation for toggling visibility
  const toggleVisibility = useMutation(api.capsules.toggleCapsuleVisibility);
  
  // Mutation for deleting a capsule
  const deleteCapsule = useMutation(api.capsules.deleteCapsule);
  
  // State for delete confirmation
  const [deletingCapsuleId, setDeletingCapsuleId] = useState<Id<'capsules'> | null>(null);

  // Get generation jobs for progress tracking
  const generationJobs = useQuery(
    api.generationJobs.getActiveGenerationJobs,
    userId ? { userId } : 'skip'
  );

  // Helper to get generation progress for a capsule
  // Updated for module-wise pipeline
  const getGenerationProgress = (capsuleId: Id<'capsules'>) => {
    if (!generationJobs) return null;
    const job = generationJobs.find(j => j.capsuleId === capsuleId);
    if (!job) return null;
    
    const { state, currentModuleIndex, totalModules, currentStage } = job;
    const effectiveState = currentStage || state;
    
    if (effectiveState === 'completed') return { percentage: 100, message: 'Complete!' };
    if (effectiveState === 'failed') return null;
    if (effectiveState === 'idle') return { percentage: 0, message: 'Starting...' };
    if (effectiveState === 'generating_outline') return { percentage: 5, message: 'Generating outline...' };
    if (effectiveState === 'outline_complete') return { percentage: 10, message: 'Outline ready' };
    
    // Module-wise content generation
    if (effectiveState === 'generating_module_content' || effectiveState.startsWith('module_')) {
      const modulesCompleted = currentModuleIndex || 0;
      const total = totalModules || 1;
      const moduleProgress = total > 0 ? (modulesCompleted / total) * 85 : 0;
      const percentage = Math.min(10 + moduleProgress, 95);
      return { 
        percentage, 
        message: `Generating module ${modulesCompleted + 1}/${total}...` 
      };
    }
    
    // Handle dynamic module_X_complete states
    if (effectiveState.match && effectiveState.match(/^module_\d+_complete$/)) {
      const match = effectiveState.match(/module_(\d+)_complete/);
      if (match) {
        const completedModule = parseInt(match[1], 10);
        const total = totalModules || completedModule;
        const moduleProgress = total > 0 ? (completedModule / total) * 85 : 0;
        const percentage = Math.min(10 + moduleProgress, 95);
        return { 
          percentage, 
          message: `Module ${completedModule}/${total} complete` 
        };
      }
    }
    
    return { percentage: 0, message: 'Processing...' };
  };

  const isAuthenticated = !!userId && status === 'authenticated';
  const loading = status === 'loading' || (isAuthenticated && capsules === undefined);

  // Handle visibility toggle
  const handleToggleVisibility = async (
    e: React.MouseEvent,
    capsuleId: Id<'capsules'>,
    currentIsPublic: boolean | undefined
  ) => {
    e.stopPropagation(); // Prevent card click
    if (!userId) return;

    try {
      const result = await toggleVisibility({
        capsuleId,
        userId,
        isPublic: !currentIsPublic,
      });
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update visibility';
      toast.error(message);
    }
  };

  // Handle capsule deletion
  const handleDeleteCapsule = async (capsuleId: Id<'capsules'>) => {
    if (!userId) return;

    setDeletingCapsuleId(capsuleId);
    try {
      await deleteCapsule({
        capsuleId,
        userId,
      });
      toast.success('Capsule deleted successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete capsule';
      toast.error(message);
    } finally {
      setDeletingCapsuleId(null);
    }
  };

  if (!isAuthenticated && status !== 'loading') {
    return (
      <main className="bg-background min-h-screen">
        <div className="container mx-auto max-w-3xl py-24 px-4 text-center">
          <div className="p-6 rounded-full bg-muted inline-block mb-6">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Sign in to view your capsules</h1>
          <p className="text-muted-foreground mb-6">
            Create and revisit your personalized learning capsules after signing in.
          </p>
          <Button asChild className="gap-2">
            <Link href="/auth/signin">
              <Sparkles className="h-4 w-4" />
              Go to sign in
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              My Capsules
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Your AI-generated interactive courses
            </p>
          </div>
          <Button asChild className="gap-2 w-full sm:w-auto">
            <Link href="/dashboard/capsule">
              <Plus className="h-4 w-4" />
              Create New Capsule
            </Link>
          </Button>
        </div>

        {/* Capsules Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : capsules && capsules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capsules.map((capsule) => (
              <Card 
                key={capsule._id} 
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => {
                  if (capsule.status === 'completed') {
                    router.push(`/capsule/learn/${capsule._id}`);
                  }
                }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                      {capsule.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={capsule.status} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => e.stopPropagation()}
                            disabled={deletingCapsuleId === capsule._id}
                          >
                            {deletingCapsuleId === capsule._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Capsule</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;{capsule.title}&quot;? This will permanently remove the capsule and all its modules, lessons, and progress. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteCapsule(capsule._id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {capsule.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                      {capsule.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                  
                  {capsule.status === 'processing' && (() => {
                    const progress = getGenerationProgress(capsule._id);
                    return (
                      <div className="mt-4 space-y-2">
                        {progress ? (
                          <>
                            <Progress value={progress.percentage} className="h-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {progress.message}
                              </span>
                              <span className="font-medium">{Math.round(progress.percentage)}%</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating your course...
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {capsule.status === 'failed' && capsule.errorMessage && (
                    <div className="mt-4 text-sm text-destructive">
                      Error: {capsule.errorMessage}
                    </div>
                  )}

                  {capsule.status === 'completed' && (
                    <div className="space-y-3 mt-4">
                      {/* Visibility Toggle */}
                      <div 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          {capsule.isPublic ? (
                            <Globe className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">
                            {capsule.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>
                        <Switch
                          checked={capsule.isPublic ?? false}
                          onCheckedChange={() => {}}
                          onClick={(e) => handleToggleVisibility(e, capsule._id, capsule.isPublic)}
                          aria-label="Toggle capsule visibility"
                        />
                      </div>
                      
                      <Button 
                        className="w-full gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/capsule/learn/${capsule._id}`);
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                        Start Learning
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="p-6 rounded-full bg-muted inline-block mb-4">
              <Sparkles className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No capsules yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first AI-generated interactive course
            </p>
            <Button asChild className="gap-2">
              <Link href="/dashboard/capsule">
                <Plus className="h-4 w-4" />
                Create Your First Capsule
              </Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { label: 'Pending', icon: Clock, className: 'bg-yellow-500/10 text-yellow-500' },
    processing: { label: 'Processing', icon: Loader2, className: 'bg-blue-500/10 text-blue-500' },
    completed: { label: 'Ready', icon: CheckCircle2, className: 'bg-green-500/10 text-green-500' },
    failed: { label: 'Failed', icon: XCircle, className: 'bg-red-500/10 text-red-500' },
  }[status] || { label: status, icon: Clock, className: '' };

  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={`gap-1 ${config.className}`}>
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}
