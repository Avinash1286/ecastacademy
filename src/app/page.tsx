import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { 
  ArrowRight, 
  BookOpen, 
  Brain, 
  Trophy, 
  Sparkles, 
  Video, 
  MessageSquare,
  CheckCircle2,
  TrendingUp,
  Users,
  Clock,
  Award
} from 'lucide-react'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'
import { AuthRedirect } from '@/components/auth/AuthRedirect'

export default function LandingPage() {
  return (
    <>
      {/* Client component handles auth redirect */}
      <AuthRedirect />
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
                <BookOpen className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">ECAST Academy</span>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link href="/auth/signin">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] dark:opacity-[0.05]"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-muted/50 text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>AI-Powered Learning Platform</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              Transform Your Learning
              <span className="block mt-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                With AI Intelligence
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience personalized education powered by advanced AI. Master any skill through 
              interactive courses, real-time tutoring, and adaptive learning paths.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/auth/signup">
                <Button size="lg" className="w-full sm:w-auto text-base px-8 h-12">
                  Start Learning Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/auth/signin">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-12">
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto">
              <div className="space-y-2">
                <div className="text-3xl font-bold">1000+</div>
                <div className="text-sm text-muted-foreground">Active Learners</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold">500+</div>
                <div className="text-sm text-muted-foreground">Courses</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold">95%</div>
                <div className="text-sm text-muted-foreground">Satisfaction</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32 border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to accelerate your learning journey
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Feature Card 1 */}
            <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:border-primary/50 hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">AI Tutor</h3>
              </div>
              <p className="text-muted-foreground">
                Get instant help from our intelligent AI tutor. Ask questions, get explanations, and receive personalized guidance 24/7.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:border-primary/50 hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/10">
                  <Video className="h-6 w-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold">Video Courses</h3>
              </div>
              <p className="text-muted-foreground">
                Learn from high-quality video content curated from top educators. Interactive lessons designed for maximum retention.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:border-primary/50 hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/10">
                  <MessageSquare className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold">Interactive Quizzes</h3>
              </div>
              <p className="text-muted-foreground">
                Test your knowledge with AI-generated quizzes. Adaptive questions that match your learning pace and style.
              </p>
            </div>

            {/* Feature Card 4 */}
            <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:border-primary/50 hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-500/10">
                  <Trophy className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold">Track Progress</h3>
              </div>
              <p className="text-muted-foreground">
                Monitor your learning journey with detailed analytics. Visualize your progress and celebrate milestones.
              </p>
            </div>

            {/* Feature Card 5 */}
            <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:border-primary/50 hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-orange-500/10">
                  <TrendingUp className="h-6 w-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-semibold">Adaptive Learning</h3>
              </div>
              <p className="text-muted-foreground">
                AI-powered curriculum that adapts to your strengths and weaknesses. Personalized learning paths just for you.
              </p>
            </div>

            {/* Feature Card 6 */}
            <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:border-primary/50 hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-pink-500/10">
                  <Award className="h-6 w-6 text-pink-500" />
                </div>
                <h3 className="text-xl font-semibold">Certificates</h3>
              </div>
              <p className="text-muted-foreground">
                Earn verified certificates upon course completion. Showcase your achievements and boost your career prospects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-32 border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start your learning journey in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="relative">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                  1
                </div>
                <h3 className="text-xl font-semibold">Choose Your Course</h3>
                <p className="text-muted-foreground">
                  Browse our extensive library and select courses that match your goals and interests.
                </p>
              </div>
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-border"></div>
            </div>

            <div className="relative">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                  2
                </div>
                <h3 className="text-xl font-semibold">Learn with AI</h3>
                <p className="text-muted-foreground">
                  Engage with interactive content and get instant help from your personal AI tutor.
                </p>
              </div>
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-border"></div>
            </div>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold">Achieve Your Goals</h3>
              <p className="text-muted-foreground">
                Complete courses, earn certificates, and advance your career with new skills.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 md:py-32 border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Why Choose ECAST Academy?
              </h2>
              <p className="text-lg text-muted-foreground">
                We combine cutting-edge AI technology with proven educational methods to deliver 
                a learning experience that&apos;s both effective and engaging.
              </p>

              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Personalized Learning</h4>
                    <p className="text-sm text-muted-foreground">
                      AI adapts to your pace and learning style for maximum effectiveness
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Expert-Curated Content</h4>
                    <p className="text-sm text-muted-foreground">
                      Learn from industry professionals and top educators worldwide
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">24/7 AI Support</h4>
                    <p className="text-sm text-muted-foreground">
                      Get instant answers to your questions anytime, anywhere
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Flexible Learning</h4>
                    <p className="text-sm text-muted-foreground">
                      Learn at your own pace, on your schedule, from any device
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-card p-6 space-y-2">
                <Users className="h-8 w-8 text-primary" />
                <div className="text-2xl font-bold">10K+</div>
                <div className="text-sm text-muted-foreground">Students Enrolled</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-6 space-y-2">
                <BookOpen className="h-8 w-8 text-blue-500" />
                <div className="text-2xl font-bold">500+</div>
                <div className="text-sm text-muted-foreground">Courses Available</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-6 space-y-2">
                <Clock className="h-8 w-8 text-purple-500" />
                <div className="text-2xl font-bold">50K+</div>
                <div className="text-sm text-muted-foreground">Hours Learned</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-6 space-y-2">
                <Award className="h-8 w-8 text-green-500" />
                <div className="text-2xl font-bold">5K+</div>
                <div className="text-sm text-muted-foreground">Certificates Issued</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center space-y-8 rounded-2xl border border-border bg-card p-12">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Start Learning?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join thousands of learners already mastering new skills with AI-powered education. 
              Start your free trial today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/auth/signup">
                <Button size="lg" className="w-full sm:w-auto text-base px-8 h-12">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/auth/signin">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-12">
                  Sign In to Continue
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Courses</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Documentation</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Help Center</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Community</Link></li>
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
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
                  <BookOpen className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-semibold">ECAST Academy</span>
              </div>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} ECAST Academy. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </>
  )
}
