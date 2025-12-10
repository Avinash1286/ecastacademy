"use client";

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useAction } from 'convex/react';
import { useAuthenticatedFetchRaw } from '@/hooks/useAuthenticatedFetch';
import { api } from '../../../../convex/_generated/api';
import { Doc, Id } from '../../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Paperclip, FileText, Loader2, CheckCircle2, AlertTriangle, Clock, Trash2, RefreshCw, ArrowUp, X, Sparkles, Globe, Users, ChevronRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { CapsuleBookmarkButton } from '@/components/capsule/CapsuleBookmarkButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CapsuleStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Stale job threshold - must match backend
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export default function CapsulePage() {
  const router = useRouter();
  const { data: session, status } = useAuth();
  const userId = session?.user?.id as Id<'users'> | undefined;
  const isAuthenticated = !!userId;
  const authenticatedFetch = useAuthenticatedFetchRaw();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [ideaText, setIdeaText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [capsuleToDelete, setCapsuleToDelete] = useState<Id<'capsules'> | null>(null);
  const staleJobsMarkedRef = useRef<Set<string>>(new Set()); // Track which stale jobs we've already tried to mark

  type CapsuleDoc = Doc<'capsules'>;

  const capsules = useQuery(
    api.capsules.getUserCapsules,
    userId ? { userId } : 'skip'
  );

  // Community capsules - public capsules (including user's own)
  const communityCapsules = useQuery(
    api.capsules.getCommunityCapsules,
    { limit: 6 }
  );

  const deleteCapsule = useMutation(api.capsules.deleteCapsule);
  const generateCapsule = useAction(api.capsules.generateCapsuleContent);

  // Get generation jobs for progress tracking
  const generationJobs = useQuery(
    api.generationJobs.getActiveGenerationJobs,
    userId ? { userId } : 'skip'
  );

  const capsuleList: CapsuleDoc[] = capsules ?? [];
  const isCapsulesLoading = capsules === undefined;
  const canSubmit = !!pdfFile || ideaText.trim().length > 0;

  // Helper to get generation progress for a capsule
  // Updated for module-wise pipeline: outline (1 call) + modules (1 call per module)
  const getGenerationProgress = (capsuleId: Id<'capsules'>) => {
    if (!generationJobs) return null;
    const job = generationJobs.find(j => j.capsuleId === capsuleId);
    if (!job) return null;

    // Calculate progress percentage based on state and modules generated
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
    if (effectiveState.match(/^module_\d+_complete$/)) {
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

  const formatErrorMessage = (error: string) => {
    // Check for content safety violation (keep the full message)
    if (error.includes('⚠️') || error.includes('CONTENT_SAFETY') || error.includes('cannot be used to create educational content')) {
      // Clean up the error but preserve the safety message
      return error.replace(/^\[.*?\]:\s*/, '').replace(/^Error:\s*/, '').replace(/^⚠️\s*/, '');
    }
    if (error.includes('429') || error.includes('Quota exceeded')) {
      const retryMatch = error.match(/Please retry in ([0-9.]+)s/);
      if (retryMatch) {
        return `AI is busy. Please retry in ${Math.ceil(parseFloat(retryMatch[1]))} seconds.`;
      }
      return "AI rate limit exceeded. Please try again later.";
    }
    // Strip technical prefixes if present
    const cleanError = error.replace(/^\[.*?\]:\s*/, '').replace(/^Error:\s*/, '');
    // If it's very long and looks like a stack trace or JSON dump, truncate it
    if (cleanError.length > 150) {
      return "Generation failed due to an AI service error. Please try again.";
    }
    return cleanError;
  };

  // Monitor for status changes to show toasts
  const prevCapsulesRef = useRef<CapsuleDoc[]>([]);
  useEffect(() => {
    if (!capsules) return;

    capsules.forEach(cap => {
      const prev = prevCapsulesRef.current.find(p => p._id === cap._id);
      if (prev && prev.status === 'processing' && cap.status === 'failed') {
        toast.error(formatErrorMessage(cap.errorMessage || 'Unknown error'));
      }
    });

    prevCapsulesRef.current = capsules;
  }, [capsules]);

  // Stale job detection - mark jobs as failed if they haven't updated in 15+ minutes
  const markStaleJobAsFailed = useMutation(api.generationJobs.markStaleJobAsFailed);

  useEffect(() => {
    if (!generationJobs || !capsules) return;

    // Check each processing capsule for stale jobs
    capsules.forEach(capsule => {
      if (capsule.status !== 'processing') return;
      
      // Skip if we've already attempted to mark this capsule's job as stale
      const capsuleIdStr = capsule._id.toString();
      if (staleJobsMarkedRef.current.has(capsuleIdStr)) return;
      
      const job = generationJobs.find(j => j.capsuleId === capsule._id);
      if (!job) return;
      
      // Check if job is stale (hasn't updated in threshold time)
      const timeSinceUpdate = Date.now() - job.updatedAt;
      if (timeSinceUpdate > STALE_THRESHOLD_MS) {
        // Mark this capsule as attempted to prevent repeated calls
        staleJobsMarkedRef.current.add(capsuleIdStr);
        
        markStaleJobAsFailed({ capsuleId: capsule._id })
          .then(result => {
            if (result?.success) {
              toast.error('Generation timed out. Please try again.');
            }
          })
          .catch(err => {
            console.error('[StaleJob] Failed to mark stale job:', err);
            // Remove from tracked set on error so it can be retried
            staleJobsMarkedRef.current.delete(capsuleIdStr);
          });
      }
    });
  }, [generationJobs, capsules, markStaleJobAsFailed]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        setPdfFile(file);
      } else {
        toast.error('Please upload a PDF file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setPdfFile(file);
      } else {
        toast.error('Please upload a PDF file');
      }
    }
  };

  const buildTitle = () => {
    if (pdfFile) {
      return pdfFile.name.replace(/\.pdf$/i, '') || 'Untitled Capsule';
    }
    return ideaText.trim().slice(0, 60) || 'Personalized Capsule';
  };

  const handleGenerate = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to create a capsule.');
      return;
    }

    if (!canSubmit) {
      toast.error('Provide a topic or upload a PDF to continue.');
      return;
    }

    setIsUploading(true);

    try {
      let pdfStorageId: string | undefined;
      let pdfMeta: { name?: string; mime?: string; size?: number } | undefined;

      if (pdfFile) {
        const formData = new FormData();
        formData.append('pdf', pdfFile);

        const uploadResponse = await authenticatedFetch('/api/capsule/upload-pdf', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          if (uploadResponse.status === 429) {
            const retryAfterSeconds = Number(uploadResponse.headers.get('Retry-After') || errorData.retryAfter || 0);
            const retryMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
            toast.error(`Capsule generation is rate limited. Please try again in about ${retryMinutes} minute(s).`);
            return;
          }
          throw new Error(errorData.error || 'Failed to upload PDF');
        }

        const uploadData = await uploadResponse.json();
        pdfStorageId = uploadData.storageId; // Now using storage ID instead of base64
        pdfMeta = {
          name: uploadData.fileName ?? pdfFile.name,
          mime: uploadData.mimeType ?? pdfFile.type ?? 'application/pdf',
          size: uploadData.fileSize ?? pdfFile.size,
        };
      }

      const trimmedIdea = ideaText.trim();
      const payload = {
        title: buildTitle(),
        sourceType: pdfFile ? 'pdf' : 'topic',
        sourcePdfStorageId: pdfFile ? pdfStorageId : undefined, // Using storage ID
        sourcePdfName: pdfFile ? pdfMeta?.name ?? pdfFile.name : undefined,
        sourcePdfMime: pdfFile ? pdfMeta?.mime ?? pdfFile.type ?? 'application/pdf' : undefined,
        sourcePdfSize: pdfFile ? pdfMeta?.size ?? pdfFile.size : undefined,
        sourceTopic: !pdfFile && trimmedIdea ? trimmedIdea : undefined,
        userPrompt: trimmedIdea || undefined,
      };

      const response = await authenticatedFetch('/api/capsule/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          const retryAfterSeconds = Number(response.headers.get('Retry-After') || errorData.retryAfter || 0);
          const retryMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
          toast.error(`Capsule generation is rate limited. Please try again in about ${retryMinutes} minute(s).`);
          return;
        }
        throw new Error(errorData.error || 'Failed to create capsule');
      }

      await response.json();
      toast.success('Capsule created! We will notify you when it is ready.');
      setPdfFile(null);
      setIdeaText('');
      router.refresh();
    } catch (error) {
      console.error('Error creating capsule:', error);
      toast.error('Failed to create capsule. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const openDeleteDialog = (capsuleId: Id<'capsules'>) => {
    setCapsuleToDelete(capsuleId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!capsuleToDelete || !userId) return;
    try {
      await deleteCapsule({ capsuleId: capsuleToDelete, userId });
      toast.success('Capsule deleted');
    } catch (error) {
      console.error('Error deleting capsule:', error);
      toast.error('Failed to delete capsule');
    } finally {
      setDeleteDialogOpen(false);
      setCapsuleToDelete(null);
    }
  };

  const handleRetry = async (capsuleId: Id<'capsules'>) => {
    try {
      toast.info('Retrying generation...');
      await generateCapsule({ capsuleId });
    } catch (error) {
      console.error('Error retrying generation:', error);
      toast.error('Failed to retry generation');
    }
  };

  const statusBadgeClasses = (status: CapsuleStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-900 border-emerald-200';
      case 'processing':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case 'pending':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'failed':
      default:
        return 'bg-rose-100 text-rose-900 border-rose-200';
    }
  };

  const statusIcon = (status: CapsuleStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'failed':
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const handleCapsuleClick = (capsuleId: string, status: CapsuleStatus) => {
    if (status === 'completed') {
      router.push(`/capsule/learn/${capsuleId}`);
    } else if (status === 'failed') {
      // Do nothing, let them use the actions
    } else {
      toast.info('This capsule is still generating. Check back soon.');
    }
  };

  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto max-w-4xl py-16 px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-10">
            What do you want to learn?
          </h1>

          {/* Search/Input Bar with Attach Button */}
          <div
            className={`relative max-w-2xl mx-auto ${dragActive ? 'ring-2 ring-primary ring-offset-2 rounded-full' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {/* Attached file indicator */}
            {pdfFile && (
              <div className="absolute -top-10 left-0 right-0 flex justify-center">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm">
                  <FileText className="h-4 w-4" />
                  <span className="max-w-[200px] truncate">{pdfFile.name}</span>
                  <button
                    onClick={() => setPdfFile(null)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="relative flex items-center">
              {/* Attach file button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full hover:bg-muted"
                onClick={() => fileInputRef.current?.click()}
                title="Attach PDF file"
              >
                <Paperclip className="h-5 w-5 text-muted-foreground" />
              </Button>

              <Input
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                placeholder="Learn anything"
                className="h-14 pl-14 pr-14 rounded-full text-base bg-card border-border/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit && !isUploading) {
                    handleGenerate();
                  }
                }}
              />

              {/* Submit button */}
              <Button
                onClick={handleGenerate}
                disabled={isUploading || !canSubmit}
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowUp className="h-5 w-5" />
                )}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {!isAuthenticated && status !== 'loading' && (
          <div className="mb-10 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 text-center">
            Please{' '}
            <Link href="/auth/signin" className="underline font-semibold">
              sign in
            </Link>{' '}
            to generate personalized capsules.
          </div>
        )}

        {/* My Capsules Section */}
        <section className="mt-16">
          {/* Mobile: View all on top right */}
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center justify-end md:hidden">
              {capsuleList.length > 0 && (
                <Button
                  variant="ghost"
                  className="text-sm"
                  onClick={() => router.push('/dashboard/capsule/library')}
                >
                  View all
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                <h2 className="text-xl font-semibold">My Capsules</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Newest</span>
                </div>
              </div>
              {/* Desktop: View all inline */}
              {capsuleList.length > 0 && (
                <Button
                  variant="ghost"
                  className="text-sm hidden md:flex"
                  onClick={() => router.push('/dashboard/capsule/library')}
                >
                  View all
                </Button>
              )}
            </div>
          </div>

          {!isAuthenticated && status !== 'loading' ? (
            <Card className="border-2 border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Sparkles className="h-12 w-12 mb-4 text-primary/50" />
                <p className="text-lg font-medium mb-2">Sign in to create capsules</p>
                <p className="text-sm text-center max-w-md">
                  Create personalized learning capsules from PDFs or topics
                </p>
              </CardContent>
            </Card>
          ) : isCapsulesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, idx) => (
                <Card key={idx} className="h-48 animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : capsuleList.length === 0 ? (
            <Card className="border-2 border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Sparkles className="h-12 w-12 mb-4 text-primary/50" />
                <p className="text-lg font-medium mb-2">Generate your First Capsule</p>
                <p className="text-sm text-center max-w-md">
                  Enter a topic or attach a PDF above to create your first interactive learning capsule
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Show only 3 newest capsules */}
              {capsuleList.slice(0, 3).map((capsule) => (
                <Card
                  key={capsule._id}
                  className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md group relative bg-card"
                  onClick={() => handleCapsuleClick(capsule._id, capsule.status as CapsuleStatus)}
                >
                  <CardContent className="p-5 min-h-[220px] flex flex-col">
                    {/* Header with icon and actions */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {capsule.status === 'failed' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(capsule._id);
                            }}
                            title="Retry Generation"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteDialog(capsule._id);
                          }}
                          title="Delete Capsule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-base line-clamp-2 mb-2">{capsule.title}</h3>

                    {/* Description - with more lines visible */}
                    {capsule.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{capsule.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground/50 italic mb-3">
                        {capsule.status === 'processing' ? 'Generating...' : 'No description'}
                      </p>
                    )}

                    {/* Progress bar for generating capsules */}
                    {capsule.status === 'processing' && (() => {
                      const progress = getGenerationProgress(capsule._id);
                      if (!progress) return null;
                      return (
                        <div className="space-y-1 mb-3">
                          <Progress value={progress.percentage} className="h-1.5" />
                          <p className="text-[11px] text-muted-foreground">{progress.message}</p>
                        </div>
                      );
                    })()}

                    {/* Footer with status and info */}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                      <Badge
                        variant="outline"
                        className={`text-xs gap-1 ${statusBadgeClasses(capsule.status as CapsuleStatus)}`}
                      >
                        {statusIcon(capsule.status as CapsuleStatus)}
                        <span className="capitalize">{capsule.status}</span>
                      </Badge>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {capsule.moduleCount && capsule.status === 'completed' && (
                          <span>{capsule.moduleCount} modules</span>
                        )}
                        {capsule.createdAt && (
                          <span>{new Date(capsule.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Community Capsules Section */}
        <section className="mt-16">
          {/* Mobile: View all on top right */}
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center justify-end md:hidden">
              {communityCapsules?.capsules && communityCapsules.capsules.length > 0 && (
                <Button
                  variant="ghost"
                  className="text-sm gap-1"
                  onClick={() => router.push('/dashboard/capsule/community')}
                >
                  View all
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Community Capsules
                </h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Shared by learners</span>
                </div>
              </div>
              {/* Desktop: View all inline */}
              {communityCapsules?.capsules && communityCapsules.capsules.length > 0 && (
                <Button
                  variant="ghost"
                  className="text-sm gap-1 hidden md:flex"
                  onClick={() => router.push('/dashboard/capsule/community')}
                >
                  View all
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {communityCapsules === undefined ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, idx) => (
                <Card key={idx} className="h-48 animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : communityCapsules.capsules.length === 0 ? (
            <Card className="border-2 border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Globe className="h-10 w-10 mb-4 text-primary/50" />
                <p className="text-lg font-medium mb-2">No community capsules yet</p>
                <p className="text-sm text-center max-w-md">
                  Be the first to share! Make your completed capsules public to help others learn.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {communityCapsules.capsules.slice(0, 3).map((capsule) => {
                const isOwn = userId && capsule.userId === userId;
                return (
                <Card
                  key={capsule._id}
                  className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md group relative bg-card ${isOwn ? 'ring-1 ring-primary/30' : ''}`}
                  onClick={() => router.push(`/capsule/learn/${capsule._id}`)}
                >
                  <CardContent className="p-5 min-h-[220px] flex flex-col">
                    {/* Header with icon and bookmark button */}
                    <div className="flex items-start justify-between mb-3">
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

                    {/* Title */}
                    <h3 className="font-semibold text-base line-clamp-2 mb-2">{capsule.title}</h3>

                    {/* Description */}
                    {capsule.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{capsule.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground/50 italic mb-3">No description</p>
                    )}

                    {/* Footer with module count */}
                    <div className="flex items-center justify-end mt-auto pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {capsule.moduleCount && (
                          <span>{capsule.moduleCount} modules</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )})}
            </div>
          )}
        </section>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Capsule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this capsule? This action cannot be undone and all associated content will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCapsuleToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
