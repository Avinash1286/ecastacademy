"use client";

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Doc, Id } from '../../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Sparkles, FileText, Loader2, CheckCircle2, AlertTriangle, Clock, Trash2, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

type CapsuleStatus = 'pending' | 'processing' | 'completed' | 'failed';

export default function CapsulePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = session?.user?.id as Id<'users'> | undefined;
  const isAuthenticated = !!userId;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [ideaText, setIdeaText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  type CapsuleDoc = Doc<'capsules'>;

  const capsules = useQuery(
    api.capsules.getUserCapsules,
    userId ? { userId } : 'skip'
  );

  const deleteCapsule = useMutation(api.capsules.deleteCapsule);
  const generateCapsule = useAction(api.capsules.generateCapsuleContent);

  // Get generation jobs for progress tracking
  const generationJobs = useQuery(
    api.capsulesV2.getActiveGenerationJobs,
    userId ? { userId } : 'skip'
  );

  const capsuleList: CapsuleDoc[] = capsules ?? [];
  const isCapsulesLoading = capsules === undefined;
  const canSubmit = !!pdfFile || ideaText.trim().length > 0;

  // Helper to get generation progress for a capsule
  const getGenerationProgress = (capsuleId: Id<'capsules'>) => {
    if (!generationJobs) return null;
    const job = generationJobs.find(j => j.capsuleId === capsuleId);
    if (!job) return null;
    
    // Calculate progress percentage based on state and lessons generated
    const { state, lessonsGenerated, totalLessons, lessonPlansGenerated, totalModules } = job;
    
    if (state === 'completed') return { percentage: 100, message: 'Complete!' };
    if (state === 'failed') return null;
    if (state === 'idle') return { percentage: 0, message: 'Starting...' };
    if (state === 'generating_outline') return { percentage: 5, message: 'Generating outline...' };
    if (state === 'outline_complete') return { percentage: 10, message: 'Outline ready' };
    if (state === 'generating_lesson_plans') {
      const planProgress = totalModules > 0 ? (lessonPlansGenerated / totalModules) * 15 : 0;
      return { percentage: 10 + planProgress, message: `Planning modules (${lessonPlansGenerated}/${totalModules})...` };
    }
    if (state === 'lesson_plans_complete') return { percentage: 25, message: 'Lesson plans ready' };
    if (state === 'generating_content') {
      const contentProgress = totalLessons > 0 ? (lessonsGenerated / totalLessons) * 70 : 0;
      return { percentage: 25 + contentProgress, message: `Generating lessons (${lessonsGenerated}/${totalLessons})...` };
    }
    if (state === 'content_complete') return { percentage: 95, message: 'Finalizing...' };
    
    return { percentage: 0, message: 'Processing...' };
  };

  const formatErrorMessage = (error: string) => {
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

        const uploadResponse = await fetch('/api/capsule/upload-pdf', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
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

      const response = await fetch('/api/capsule/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create capsule');
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

  const handleDelete = async (capsuleId: Id<'capsules'>) => {
    if (!confirm('Are you sure you want to delete this capsule? This action cannot be undone.')) return;
    try {
      await deleteCapsule({ capsuleId });
      toast.success('Capsule deleted');
    } catch (error) {
      console.error('Error deleting capsule:', error);
      toast.error('Failed to delete capsule');
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
      <div className="container mx-auto max-w-5xl py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Capsule Studio</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Drop a PDF or describe what you want to learn. Our AI will detect the best source and build an interactive learning capsule for you.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Made & powered by <span className="font-semibold">together.ai</span>
          </p>
        </div>

        {!isAuthenticated && status !== 'loading' && (
          <div className="mb-10 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            Please{' '}
            <Link href="/auth/signin" className="underline font-semibold">
              sign in
            </Link>{' '}
            to generate personalized capsules.
          </div>
        )}

        <Card className="border-2 border-border/50 bg-gradient-to-br from-background via-muted/10 to-background">
          <CardContent className="p-8 space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Describe your capsule
              </label>
              <Textarea
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                placeholder={'e.g. Upload a syllabus or write "Teach me MERN stack basics with quizzes and drag-drop exercises."'}
                className="min-h-[140px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Paste a topic, outline, or extra guidance. When a PDF is attached, this text becomes AI instructions.
              </p>
            </div>

            <div
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${dragActive ? 'border-primary bg-primary/5' : 'border-border/70'
                } ${pdfFile ? 'bg-muted/30' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {pdfFile ? (
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-3 rounded-full bg-background px-4 py-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    {pdfFile.name}
                    <span className="text-muted-foreground">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      Replace file
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPdfFile(null)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-medium">Drop a PDF syllabus or course material</p>
                    <p className="text-sm text-muted-foreground">We will auto-detect the best source. PDF is optional if you only need a topic-based capsule.</p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                      <Upload className="h-4 w-4" />
                      Upload PDF
                    </Button>
                    <Button variant="outline" onClick={() => setIdeaText((prev) => prev || 'Teach me ...')}>
                      Need inspiration?
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
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {pdfFile ? 'PDF detected. Guidance text will steer AI tone and difficulty.' : 'No file uploaded yet. We will generate from your description.'}
              </div>
              <Button
                onClick={handleGenerate}
                disabled={isUploading || !canSubmit}
                size="lg"
                className="gap-2 px-8"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    {isAuthenticated ? 'Generate Capsule' : 'Sign in to Generate'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="mt-14">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm uppercase font-semibold tracking-wide text-muted-foreground">Library preview</p>
              <h2 className="text-2xl font-bold">Recent capsules</h2>
            </div>
            <Button variant="ghost" onClick={() => router.push('/dashboard/capsule/library')}>
              View all
            </Button>
          </div>

          {!isAuthenticated && status !== 'loading' ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Sign in to see your generated capsules.
              </CardContent>
            </Card>
          ) : isCapsulesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, idx) => (
                <Card key={idx} className="h-32 animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : capsuleList.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No capsules yet. Generate one above to see it here.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capsuleList.slice(0, 4).map((capsule) => (
                <Card
                  key={capsule._id}
                  className="cursor-pointer transition hover:border-primary/70 group relative"
                  onClick={() => handleCapsuleClick(capsule._id, capsule.status as CapsuleStatus)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-semibold line-clamp-1">{capsule.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={`gap-1 border ${statusBadgeClasses(capsule.status as CapsuleStatus)}`}>
                        {statusIcon(capsule.status as CapsuleStatus)}
                        <span className="capitalize">{capsule.status}</span>
                      </Badge>
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
                            handleDelete(capsule._id);
                          }}
                          title="Delete Capsule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {capsule.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{capsule.description}</p>
                    )}
                    
                    {/* Progress bar for generating capsules */}
                    {capsule.status === 'processing' && (() => {
                      const progress = getGenerationProgress(capsule._id);
                      if (!progress) return null;
                      return (
                        <div className="space-y-1">
                          <Progress value={progress.percentage} className="h-2" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{progress.message}</span>
                            <span className="font-medium">{Math.round(progress.percentage)}%</span>
                          </div>
                        </div>
                      );
                    })()}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Created {capsule.createdAt ? new Date(capsule.createdAt).toLocaleDateString() : '-'}
                      </span>
                      <span className="font-medium">
                        {capsule.status === 'failed'
                          ? 'Failed'
                          : capsule.status === 'processing'
                            ? ''
                            : capsule.moduleCount
                              ? `${capsule.moduleCount} modules`
                              : 'Generating…'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="p-6">
            <div className="text-4xl mb-2">📚</div>
            <h3 className="font-semibold mb-1">Interactive Learning</h3>
            <p className="text-sm text-muted-foreground">Engage with quizzes, drag-and-drop, and simulations</p>
          </div>
          <div className="p-6">
            <div className="text-4xl mb-2">⚡</div>
            <h3 className="font-semibold mb-1">Quick Generation</h3>
            <p className="text-sm text-muted-foreground">AI-powered course creation in minutes</p>
          </div>
          <div className="p-6">
            <div className="text-4xl mb-2">🎯</div>
            <h3 className="font-semibold mb-1">Personalized</h3>
            <p className="text-sm text-muted-foreground">Tailored to your materials and learning style</p>
          </div>
        </div>
      </div>
    </main>
  );
}
