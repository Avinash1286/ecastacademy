'use client';

import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useRef, lazy, Suspense, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { 
  BookOpen, 
  ArrowRight, 
  Play, 
  Youtube,
  Brain,
  FileText,
  Target,
  Award,
  Pill,
  Sparkles,
  CheckCircle2,
  Zap,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import {
  FadeUp,
  StaggerContainer,
  StaggerItem,
  FloatingElement,
  AnimatedBorder,
  PulseButton,
} from '@/components/landing/AnimatedComponents';
import { FeatureShowcase, BrowserMockup } from '@/components/landing/FeatureShowcase';
import { cn } from '@/lib/utils';

// Smooth scroll handler for anchor links
function useSmoothScroll() {
  return useCallback((e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, []);
}

export function LandingPageClient() {
  const heroRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const handleSmoothScroll = useSmoothScroll();
  
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  // Reduced parallax movement and slower fade out
  const heroY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8, 1], [1, 1, prefersReducedMotion ? 1 : 0]);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
      <motion.nav 
        initial={prefersReducedMotion ? { y: 0 } : { y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-xl font-bold">ECAST Academy</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <a 
                href="#features" 
                onClick={(e) => handleSmoothScroll(e, 'features')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Features
              </a>
              <a 
                href="#youtube-learning" 
                onClick={(e) => handleSmoothScroll(e, 'youtube-learning')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                YouTube Learning
              </a>
              <a 
                href="#capsules" 
                onClick={(e) => handleSmoothScroll(e, 'capsules')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Capsules
              </a>
              <a 
                href="#certification" 
                onClick={(e) => handleSmoothScroll(e, 'certification')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Certification
              </a>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/sign-up" className="hidden md:block">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          {!prefersReducedMotion && (
            <>
              <motion.div
                className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
                animate={{
                  scale: [1.2, 1, 1.2],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              />
            </>
          )}
          {prefersReducedMotion && (
            <>
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-30" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-30" />
            </>
          )}
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23888' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <motion.div 
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32"
        >
          <div className="max-w-5xl mx-auto text-center space-y-8">
            {/* Badge */}
            <FadeUp delay={0.1}>
              <motion.div 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-muted/50 text-sm font-medium"
                whileHover={{ scale: 1.05 }}
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span>AI-Assisted Learning is Here</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </FadeUp>
            
            {/* Main headline */}
            <FadeUp delay={0.2}>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.2]">
                Bridge the Gap Between
                <span className="block mt-2 pb-1 bg-gradient-to-r from-primary via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                  Watching and Knowing
                </span>
              </h1>
            </FadeUp>
            
            {/* Subheadline */}
            <FadeUp delay={0.3}>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                AI-powered learning that generates interactive notes, smart quizzes, and provides 
                a 24/7 tutor for any video. Fill knowledge gaps with AI Capsules. Earn certificates 
                that matter.
              </p>
            </FadeUp>

            {/* CTA Buttons */}
            <FadeUp delay={0.4}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link href="/auth/signup">
                  <PulseButton>
                    <Button size="lg" className="w-full sm:w-auto text-base px-8 h-14 rounded-xl">
                      Start Learning Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </PulseButton>
                </Link>
                <Link href="#demo">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-14 rounded-xl gap-2">
                    <Play className="h-5 w-5" />
                    Watch Demo
                  </Button>
                </Link>
              </div>
            </FadeUp>

            {/* Trust indicators */}
            <FadeUp delay={0.5}>
              <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>AI-powered features</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Works with any YouTube video</span>
                </div>
              </div>
            </FadeUp>

            {/* Hero visual - Browser mockup */}
            <FadeUp delay={0.6}>
              <div className="mt-16 relative">
                <BrowserMockup url="app.ecastacademy.com/learnspace">
                  <Image 
                    src="/images/landing/hero-learnspace.png" 
                    alt="ECAST Academy LearnSpace Interface"
                    width={1920}
                    height={1080}
                    className="w-full"
                    quality={85}
                    priority
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAYH/8QAIhAAAgEDAwUBAAAAAAAAAAAAAQIDAAQRBRIhBhMiMUFR/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQACAwEAAAAAAAAAAAAAAAABAgADESH/2gAMAwEAAhEDEQA/AJvpzU7q31C4uGuJZY3kJjV3JAHwKvtN6gvbeBYoriRVUY4Y0pTGwWnZVQhPZ//Z"
                  />
                </BrowserMockup>
                
                {/* Floating decorative elements */}
                <FloatingElement delay={0} y={15} className="absolute -top-8 -left-8 hidden lg:block">
                  <div className="p-3 rounded-xl bg-card border border-border shadow-lg">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                </FloatingElement>
                <FloatingElement delay={0.5} y={12} className="absolute -top-4 -right-4 hidden lg:block">
                  <div className="p-3 rounded-xl bg-card border border-border shadow-lg">
                    <Youtube className="h-6 w-6 text-red-500" />
                  </div>
                </FloatingElement>
                <FloatingElement delay={1} y={10} className="absolute -bottom-6 left-1/4 hidden lg:block">
                  <div className="p-3 rounded-xl bg-card border border-border shadow-lg">
                    <Award className="h-6 w-6 text-amber-500" />
                  </div>
                </FloatingElement>
              </div>
            </FadeUp>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        {!prefersReducedMotion && (
          <motion.div 
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
              <motion.div 
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                animate={{ y: [0, 12, 0], opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </motion.div>
        )}
        {prefersReducedMotion && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
            </div>
          </div>
        )}
      </section>

      {/* Feature 1: YouTube Learning */}
      <section id="youtube-learning" className="py-24 md:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-sm font-medium mb-4">
                <Youtube className="h-4 w-4" />
                YouTube Integration
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                A New Way to Learn from YouTube
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Stop passive watching. Start active learning. Transform any YouTube video into 
                an interactive learning experience with AI-generated content.
              </p>
            </div>
          </FadeUp>

          <FeatureShowcase
            title="Interactive Notes, Automatically Generated"
            description="Our AI watches the video so you can focus on learning. Get structured notes with key concepts, definitions, examples, and code snippets—all organized for easy review."
            features={[
              "Automatic transcript extraction",
              "Section-by-section breakdown",
              "Key terms and definitions highlighted",
              "Code blocks with syntax highlighting",
              "Interactive prompts and reflection questions"
            ]}
            mediaType="image"
            mediaSrc="/images/landing/feature-notes.png"
            mediaAlt="AI-generated interactive notes from video"
            accentColor="primary"
          />
        </div>
      </section>

      {/* Feature 2: AI Tutor */}
      <section id="ai-tutor" className="py-24 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <FeatureShowcase
            title="Your Personal AI Tutor, 24/7"
            description="Stuck on a concept? Ask your AI tutor. It understands the context of what you're learning and provides clear, helpful explanations tailored to your needs."
            features={[
              "Context-aware responses based on video content",
              "LaTeX support for mathematical equations",
              "Code examples and explanations",
              "Quiz mode for practice questions",
              "Friendly, encouraging teaching style"
            ]}
            mediaType="image"
            mediaSrc="/images/landing/feature-ai-tutor.png"
            mediaAlt="AI Tutor chat interface"
            accentColor="primary"
            reversed
          />
        </div>
      </section>

      {/* Feature 3: Interactive Quizzes */}
      <section id="quizzes" className="py-24 md:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <FeatureShowcase
            title="Test Your Knowledge with Smart Quizzes"
            description="AI-generated quizzes that actually test understanding, not just memorization. Get instant feedback with detailed explanations for every question."
            features={[
              "Multiple choice questions from video content",
              "Instant feedback and explanations",
              "Graded assessments for certification",
              "Track your progress over time",
              "Adaptive difficulty based on performance"
            ]}
            mediaType="image"
            mediaSrc="/images/landing/feature-quiz.png"
            mediaAlt="Interactive quiz interface"
            accentColor="purple-500"
          />
        </div>
      </section>

      {/* Feature 4: Capsules */}
      <section id="capsules" className="py-24 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 text-violet-500 text-sm font-medium mb-4">
                <Pill className="h-4 w-4" />
                AI Capsules
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Fill Your Knowledge Gap with Capsules
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Don&apos;t have time for long courses? Capsules are AI-generated micro-courses 
                that teach you exactly what you need to know, fast.
              </p>
            </div>
          </FadeUp>

          <FeatureShowcase
            title="AI-Generated Micro-Courses"
            description="Upload a PDF or describe a topic, and our AI creates a complete mini-course with interactive lessons, visualizations, and practice exercises—in minutes."
            features={[
              "Generate from PDFs or topic descriptions",
              "Interactive simulations and visualizations",
              "Multiple question types: MCQ, fill-blanks, drag-drop",
              "Real-time progress tracking",
              "Share with the community or keep private"
            ]}
            mediaType="image"
            mediaSrc="/images/landing/feature-capsule.png"
            mediaAlt="Capsule learning interface"
            accentColor="violet-500"
            reversed
          />

          {/* Capsule lesson types showcase */}
          <div className="mt-24">
            <FadeUp>
              <h3 className="text-2xl font-bold text-center mb-12">
                Six Interactive Lesson Types
              </h3>
            </FadeUp>
            
            <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" staggerDelay={0.1}>
              {[
                { icon: <BookOpen className="h-5 w-5" />, label: "Concept", color: "text-blue-500" },
                { icon: <Target className="h-5 w-5" />, label: "MCQ", color: "text-green-500" },
                { icon: <FileText className="h-5 w-5" />, label: "Fill Blanks", color: "text-amber-500" },
                { icon: <Zap className="h-5 w-5" />, label: "Drag & Drop", color: "text-purple-500" },
                { icon: <Play className="h-5 w-5" />, label: "Simulation", color: "text-red-500" },
                { icon: <MessageSquare className="h-5 w-5" />, label: "Mixed", color: "text-cyan-500" },
              ].map((item, index) => (
                <StaggerItem key={index}>
                  <motion.div 
                    className="p-4 rounded-xl border border-border bg-card text-center hover:border-primary/50 transition-colors"
                    whileHover={{ y: -5 }}
                  >
                    <div className={cn("mx-auto mb-2", item.color)}>{item.icon}</div>
                    <div className="text-sm font-medium">{item.label}</div>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </div>
      </section>

      {/* Feature 5: Certification */}
      <section id="certification" className="py-24 md:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-sm font-medium mb-4">
                <Award className="h-4 w-4" />
                Certification
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Earn Certificates That Matter
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Complete certification courses, pass graded assessments, and earn 
                verifiable certificates to showcase your achievements.
              </p>
            </div>
          </FadeUp>

          <FeatureShowcase
            title="Verifiable Achievement Certificates"
            description="Each certificate includes a unique verification link, your overall grade, and completion details. Download as SVG or PDF, or share directly."
            features={[
              "Unique certificate ID for verification",
              "Overall grade and completion stats",
              "Download as SVG or PDF",
              "Print-ready design",
              "Public verification links"
            ]}
            mediaType="image"
            mediaSrc="/images/landing/feature-certificate.png"
            mediaAlt="Sample certificate of completion"
            accentColor="amber-500"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <AnimatedBorder className="max-w-4xl mx-auto">
              <div className="p-12 md:p-16 text-center">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
                  Ready to Transform How You Learn?
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                  Join thousands of learners who&apos;ve discovered a smarter way to learn from YouTube. 
                  Start free, no credit card required.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/auth/signup">
                    <PulseButton>
                      <Button size="lg" className="w-full sm:w-auto text-base px-8 h-14 rounded-xl">
                        Get Started Free
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </PulseButton>
                  </Link>
                  <Link href="/sign-in">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-14 rounded-xl">
                      Sign In to Continue
                    </Button>
                  </Link>
                </div>
              </div>
            </AnimatedBorder>
          </FadeUp>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <span className="text-xl font-bold">ECAST Academy</span>
              </Link>
              <p className="text-sm text-muted-foreground max-w-xs">
                Transform any YouTube video into an interactive learning experience with AI-powered notes, quizzes, and tutoring.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" onClick={(e) => handleSmoothScroll(e, 'features')} className="hover:text-foreground transition-colors cursor-pointer">Features</a></li>
                <li><a href="#youtube-learning" onClick={(e) => handleSmoothScroll(e, 'youtube-learning')} className="hover:text-foreground transition-colors cursor-pointer">YouTube Learning</a></li>
                <li><a href="#capsules" onClick={(e) => handleSmoothScroll(e, 'capsules')} className="hover:text-foreground transition-colors cursor-pointer">Capsules</a></li>
                <li><a href="#certification" onClick={(e) => handleSmoothScroll(e, 'certification')} className="hover:text-foreground transition-colors cursor-pointer">Certification</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Careers</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} ECAST Academy. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <span className="sr-only">Twitter</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>
                </Link>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <span className="sr-only">GitHub</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
