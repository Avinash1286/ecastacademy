# ECAST Academy - Feature Documentation

> **AI-Powered Learning Platform** | Next.js 15 + Convex + AI Integration

---

## 🎯 Executive Summary

ECAST Academy is a comprehensive AI-powered learning management system (LMS) that combines modern web technologies with artificial intelligence to deliver personalized, interactive educational experiences. The platform supports multiple learning modalities including video courses, AI-generated micro-courses (Capsules), interactive quizzes, and real-time AI tutoring.

---

## 🏗️ Technology Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | Next.js 15, React 19, TailwindCSS 4, Radix UI |
| **Backend** | Convex (Real-time Database & Functions) |
| **AI Services** | Google Gemini, OpenAI GPT-4 |
| **Authentication** | NextAuth.js v5 (Google, GitHub OAuth + Email/Password) |
| **Rich Text** | TipTap Editor |
| **Data Viz** | Recharts |
| **Styling** | Tailwind CSS, Class Variance Authority |

---

## 🌟 Core Features

### 1. 📚 Course Management System

#### Video Courses
- **YouTube Integration**: Import videos directly from YouTube with automatic metadata extraction
- **Transcript Extraction**: Automatic transcription for video content
- **Structured Chapters**: Organize courses into chapters with multiple content items
- **Content Types**: 
  - Video lessons
  - Text/Reading materials
  - Interactive quizzes
  - Assignments
  - External resources

#### Course Creation & Management
- **Admin Dashboard**: Full CRUD operations for courses
- **Drag-and-Drop Ordering**: Reorder chapters and content items
- **Thumbnail Management**: Custom thumbnails from video frames
- **Status Workflow**: Draft → Generating → Ready → Published

#### Certification Courses
- **Graded Assessments**: Mark content items as graded
- **Passing Grade Requirements**: Configurable passing scores (default 70%)
- **Progress Tracking**: Per-item and overall course progress
- **Certificate Generation**: Automated certificate issuance upon completion

---

### 2. 🧠 AI-Powered Capsules (Micro-Learning Courses)

#### What are Capsules?
AI-generated mini-courses created from PDFs or topic descriptions, designed for focused, bite-sized learning.

#### Generation Pipeline
```
Input (PDF/Topic) → Outline Generation → Module Content Generation → Interactive Lessons
```

- **Module-wise Pipeline**: Efficient generation (1 AI call for outline + 1 call per module)
- **Progress Tracking**: Real-time generation status with percentages
- **Error Recovery**: Automatic retry mechanisms and dead-letter queue for failures

#### Content Sources
- **PDF Upload**: Upload educational PDFs (up to 10MB) for AI analysis
- **Topic-Based**: Enter a topic and let AI generate comprehensive curriculum
- **Smart Processing**: Base64 encoding with memory optimization for large PDFs

#### Lesson Types
1. **Concept Lessons**: Clear explanations with key points and visual aids
2. **MCQ Lessons**: Multiple choice questions with immediate feedback
3. **Fill-in-the-Blanks**: Interactive sentence completion exercises
4. **Drag-and-Drop**: Matching and categorization activities
5. **Simulation Lessons**: Interactive HTML/CSS/JS visualizations (sandboxed iframes)
6. **Mixed Lessons**: Combination of multiple question types in sequence

#### Interactive Visualizations
- **Self-Contained Code**: Complete HTML/CSS/JavaScript in sandboxed iframes
- **Dark Theme Support**: Pre-built templates with proper color contrast
- **Algorithm Animations**: Visual step-by-step algorithm demonstrations
- **Security**: CSP headers and sandboxing prevent malicious code execution

#### Community Capsules
- **Public/Private Toggle**: Make capsules public for community sharing
- **Browse Community Content**: Discover capsules created by other users
- **Author Attribution**: View creator information for community capsules

---

### 3. 🤖 AI Tutor System

#### Real-Time Chat Interface
- **Context-Aware Responses**: AI uses video transcripts and course content for accurate answers
- **Markdown Formatting**: Rich text responses with proper formatting
- **LaTeX Math Support**: Mathematical equations rendered with KaTeX
- **Code Highlighting**: Syntax-highlighted code blocks

#### Features
- **24/7 Availability**: Instant help at any time
- **Persistent Chat Sessions**: Chat history saved per chapter/content item
- **Quiz Mode**: Request practice questions from the tutor
- **Friendly Teaching Style**: Encouraging, patient, and beginner-friendly

#### Technical Implementation
- **Flexible AI Provider**: Configurable to use Gemini or OpenAI
- **Circuit Breaker Pattern**: Graceful degradation on AI service failures
- **Structured Output Validation**: JSON repair for malformed AI responses

---

### 4. 📊 Progress Tracking & Analytics

#### User Progress
- **Granular Tracking**: Track progress at course, chapter, and content item levels
- **Completion Percentages**: Visual progress indicators throughout the UI
- **Quiz Attempts**: Full history of quiz attempts with scores
- **Time Tracking**: Time spent on lessons and quizzes

#### Grading System
- **Score Calculation**: Server-side score validation (not client-trusted)
- **Best Score Retention**: Track best scores across multiple attempts
- **Pass/Fail Determination**: Based on configurable thresholds
- **Optimistic Locking**: Version field prevents race conditions in progress updates

#### Quiz Answer Storage
- **Typed Answer Schemas**: Type-safe storage for MCQ, Fill-in-Blanks, and Drag-Drop answers
- **Attempt History**: Full history with timestamps for each attempt
- **Mixed Lesson Progress**: Per-question tracking for multi-question lessons

---

### 5. 🏆 Certification System

#### Certificate Features
- **Unique Certificate IDs**: Cryptographically unique identifiers
- **Verification System**: Public verification links for certificates
- **Course Completion Stats**: Overall grade, passed items, completion date
- **Download Options**: SVG/PDF download and print functionality

#### Certificate Generation
- **Automatic Issuance**: Generated when passing grade is achieved
- **Custom Templates**: Branded certificate design
- **Metadata Storage**: Full audit trail of certificate issuance

---

### 6. 🔐 Authentication & Authorization

#### Authentication Methods
- **OAuth Providers**: 
  - Google Sign-In
  - GitHub Sign-In
- **Credentials**: Email/Password with secure hashing (bcrypt)
- **Email Verification**: Token-based email verification system
- **Password Reset**: Secure password reset flow with expiring tokens

#### Authorization Levels
- **User Role**: Standard learner access
- **Admin Role**: Full platform management capabilities
- **Course Creator**: Ownership-based access to created courses

#### Session Management
- **Secure Sessions**: NextAuth.js managed sessions
- **Session Persistence**: Convex-backed session storage
- **Account Linking**: Link multiple OAuth providers to one account

---

### 7. 🔒 Security Features

#### API Security
- **Rate Limiting**: 
  - In-memory store (development)
  - Redis/Upstash (production multi-instance)
  - Per-endpoint configuration
- **CSRF Protection**: Token-based CSRF prevention for state-changing routes
- **Body Size Limits**: Request size validation per endpoint type

#### Security Headers
```
Content-Security-Policy: Comprehensive CSP with frame restrictions
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: HSTS in production
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: Restricted browser features
```

#### Data Protection
- **Input Validation**: Zod schemas and custom validators
- **URL Validation**: Strict URL format checking
- **String Length Limits**: Maximum lengths for all text inputs
- **Server-Side Score Calculation**: Never trust client-submitted scores

#### Audit Logging
- **Action Tracking**: Log user actions for compliance
- **Resource Tracking**: Track resource access and modifications
- **Error Logging**: Structured error logging for debugging

---

### 8. 🎨 User Interface

#### Design System
- **Dark/Light Theme**: Full theme support with next-themes
- **Radix UI Components**: Accessible, composable UI primitives
- **Tailwind CSS 4**: Modern utility-first styling
- **Responsive Design**: Mobile-first responsive layouts

#### Component Library
- Accordion, Alert Dialog, Avatar
- Button, Badge, Card
- Checkbox, Collapsible, Command Palette
- Dialog, Dropdown Menu
- Forms with validation (react-hook-form + Zod)
- Progress bars, Sliders, Switches
- Tabs, Tooltips, Toasts (Sonner)
- Resizable panels

#### Interactive Elements
- **Drag-and-Drop**: @dnd-kit for sortable interfaces
- **Carousel**: Embla carousel for content sliders
- **Video Player**: Custom YouTube player with progress tracking
- **Rich Text Editor**: TipTap with images, links, and placeholders

---

### 9. 🎓 Learning Experience (LearnSpace)

#### Learnspace Interface
- **Resizable Panels**: Adjustable left/right panel layout
- **Video Player Panel**: YouTube integration with timestamp tracking
- **AI Tutor Panel**: Chat interface with context awareness
- **Notes Panel**: AI-generated study notes from transcripts
- **Quizzes Panel**: Interactive quiz interface
- **Resources Panel**: External resource links

#### Content Rendering
- **Text Content**: Rich HTML rendering with DOMPurify sanitization
- **Video Content**: Embedded YouTube with auto-generated notes/quizzes
- **Quiz Interface**: MCQ with graded/non-graded modes
- **Progress Indicators**: Visual completion status

---

### 10. 📝 Notes & Quiz Generation

#### AI-Generated Notes
- **Learning Objectives**: Clear outcomes for each section
- **Sectioned Content**: Organized into digestible sections
- **Key Points**: Highlighted important concepts
- **Examples**: Practical, real-world applications
- **Callouts**: Tips, warnings, and important notes
- **Code Blocks**: Syntax-highlighted code examples
- **Reflection Questions**: Self-assessment prompts
- **Interactive Prompts**: Hands-on activities

#### AI-Generated Quizzes
- **MCQ Questions**: 4-option multiple choice
- **Correct Answer Validation**: Server-side validation
- **Explanations**: Why each answer is correct
- **Topic Alignment**: Questions derived from transcript content

---

### 11. 🔄 Real-Time Features

#### Convex Real-Time Database
- **Live Updates**: Instant UI updates on data changes
- **Optimistic Updates**: Immediate UI feedback with background sync
- **Subscription Management**: Efficient WebSocket connections

#### Progress Synchronization
- **Multi-Device Sync**: Progress syncs across all devices
- **Conflict Resolution**: Optimistic locking prevents lost updates
- **Offline Resilience**: Graceful handling of connectivity issues

---

### 12. 🛠️ Admin Features

#### User Management
- **User List**: Paginated user listing with search
- **Role Management**: Assign user/admin roles
- **Account Overview**: View linked OAuth providers

#### Course Administration
- **Course CRUD**: Create, read, update, delete courses
- **Video Management**: Add/remove videos from library
- **Content Moderation**: Review and manage user content

#### AI Model Configuration
- **Provider Selection**: Choose between Gemini and OpenAI
- **Feature Mapping**: Assign specific models to features
- **API Key Management**: Environment-based API key storage

#### Monitoring
- **Generation Jobs**: Track capsule generation status
- **Failed Generations**: Dead-letter queue for debugging
- **Health Endpoints**: System status monitoring

---

### 13. 📱 Sound & Gamification

#### Sound Effects
- **Achievement Sounds**: Audio feedback for correct answers
- **Completion Celebration**: Sound effects on lesson completion
- **Configurable**: Sound context for user preferences

#### Visual Celebrations
- **Confetti Animation**: Celebration effect on achievements
- **Progress Animations**: Smooth progress bar transitions
- **Badge Animations**: Visual feedback for earned badges

---

### 14. 🔧 Developer Experience

#### Development Setup
- **Hot Reload**: Fast development with Turbopack
- **Parallel Dev**: Simultaneous Next.js and Convex development
- **TypeScript**: Full type safety throughout the codebase

#### Code Quality
- **ESLint**: Comprehensive linting rules
- **Type Safety**: Strict TypeScript configuration
- **Component Architecture**: Modular, reusable components

#### Testing
- **Playwright**: End-to-end testing capability
- **Schema Validation**: Zod-based runtime validation

---

## 📁 Project Structure

```
ecastacademy/
├── convex/                    # Backend functions & schema
│   ├── schema.ts             # Database schema definition
│   ├── auth.ts               # Authentication helpers
│   ├── courses.ts            # Course management
│   ├── capsules.ts           # Capsule CRUD operations
│   ├── capsuleGeneration.ts  # AI generation pipeline
│   ├── progress.ts           # Progress tracking
│   ├── certificates.ts       # Certificate management
│   └── utils/                # Shared utilities
│
├── shared/                    # Shared code (frontend & backend)
│   ├── ai/                   # AI client & prompts
│   │   ├── client/           # AI provider adapters
│   │   ├── prompts.ts        # AI prompt templates
│   │   └── modelResolver.ts  # Dynamic model selection
│   └── quiz/                 # Quiz type definitions
│
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/              # API routes
│   │   ├── dashboard/        # Dashboard pages
│   │   ├── learnspace/       # Learning interface
│   │   ├── capsule/          # Capsule learning
│   │   └── admin/            # Admin interface
│   │
│   ├── components/           # React components
│   │   ├── ui/               # Shadcn/ui components
│   │   ├── capsule/          # Capsule-specific components
│   │   ├── learnspace/       # Learnspace components
│   │   ├── quiz/             # Quiz components
│   │   └── certificates/     # Certificate components
│   │
│   ├── lib/                  # Utilities & configurations
│   │   ├── security/         # Security utilities
│   │   ├── api/              # API helpers
│   │   └── types/            # TypeScript types
│   │
│   ├── hooks/                # Custom React hooks
│   └── context/              # React context providers
│
└── middleware.ts             # Security middleware
```

---

## 🚀 Key Differentiators

1. **AI-First Design**: AI is integrated at every level, from content generation to personalized tutoring
2. **Real-Time Everything**: Convex provides instant updates without manual refresh
3. **Flexible Content**: Support for videos, text, quizzes, and interactive simulations
4. **Production Security**: Comprehensive security with rate limiting, CSRF, CSP, and audit logging
5. **Modern Stack**: Latest versions of Next.js, React, and Tailwind CSS
6. **Type Safety**: Full TypeScript with strict mode and runtime validation
7. **Scalable Architecture**: Designed for multi-instance production deployments

---

## 📈 Performance Optimizations

- **Turbopack**: Blazing fast development builds
- **Cursor-Based Pagination**: Efficient large dataset handling
- **Lazy Loading**: Components and routes loaded on demand
- **Memory-Optimized PDF Processing**: Chunked base64 encoding
- **Efficient AI Calls**: Module-wise generation reduces API calls by ~75%

---

## 🎯 Future Considerations

Based on the codebase structure, the platform is designed to support:
- Additional AI providers
- More interactive lesson types
- Advanced analytics dashboards
- Collaborative learning features
- Mobile application support

---

*Documentation generated on November 29, 2025*
*ECAST Academy v0.1.0*
