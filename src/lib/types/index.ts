export interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    publishedAt: string;
    channelTitle: string;
    thumbnails: {
      [key: string]: { url: string };
    };
  };
  contentDetails: {
    duration: string;
  };
}

export interface VideoInfo {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration: string;
  durationInSeconds: number;
  publishedAt: string;
  transcript?: string;
  skipTranscript?: boolean;
}


export interface Course {
  id: string;
  name: string;
  description: string | "";
  thumbnailUrl: string | "";
  createdAt: string;
  isCertification?: boolean;
  passingGrade?: number;
}

export type ContentItem = {
  id: string;
  type: 'video' | 'text' | 'quiz' | 'assignment' | 'resource';
  title: string;
  order: number;
  // Grading fields
  isGraded?: boolean;
  maxPoints?: number;
  passingScore?: number;
  allowRetakes?: boolean;
  // Content fields
  textContent?: string;
  textQuiz?: Quiz;
  textQuizStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  textQuizError?: string;
  videoId?: string;
  videoDetails?: {
    youtubeVideoId: string;
    url: string;
    thumbnailUrl: string | null;
    durationInSeconds: number | null;
    notes: InteractiveNotesProps;
    quiz: Quiz;
    transcript: string | null;
    hasTranscript?: boolean;
  } | null;
  resourceUrl?: string;
  resourceTitle?: string;
};

export type ChapterWithVideo = {
  id: string;
  name: string;
  order: number;
  course: {
    id: string;
    name: string;
    description: string | null;
  },
  contentItems?: ContentItem[];
  video: {
    videoId: string;
    title: string;
    url: string;
    thumbnailUrl: string | null;
    durationInSeconds: number | null;
    notes: InteractiveNotesProps;
    quiz: Quiz;
    hasTranscript?: boolean; // Flag indicating transcript is available (loaded on demand by AI tutor)
  } | null;
  isContentLoaded?: boolean; // Flag to indicate if full content (notes/quiz) is loaded
};

export interface CalloutSection {
  type: 'tip' | 'example' | 'note' | 'common-mistake';
  title?: string;
  content: string;
  bullets?: string[];
}

export interface CodeBlock {
  code: string;
  language: string;
  title?: string;
}

export interface HighlightBox {
  type: 'insight' | 'important' | 'warning';
  title?: string;
  content: string;
}

export interface DefinitionCard {
  term: string;
  definition: string;
  example?: string;
}

export interface InteractivePrompt {
  type: 'thought-experiment' | 'hands-on' | 'self-check';
  title: string;
  prompt: string;
  steps?: string[];
}


export interface NoteSection {
  title: string;
  introHook?: string;
  content: string;
  microSummary?: string;
  keyPoints?: string[];
  examples?: string[];
  callouts?: CalloutSection[];
  codeBlocks?: CodeBlock[];
  highlights?: HighlightBox[];
  definitions?: DefinitionCard[];
  interactivePrompts?: InteractivePrompt[];
  reflectionQuestions?: string[];
  quiz?: {
    type: 'mcq' | 'true-false' | 'fill-blank';
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
  }[];
}

export interface InteractiveNotesProps {
  topic: string;
  learningObjectives?: string[];
  summary?: {
    recap: string;
    nextSteps?: string[];
    keyTakeaway?: string;
  };
  sections: NoteSection[];
}

export interface DefinitionCardProps {
  term: string;
  definition: string;
  example?: string;
}

// Full question with correct answer (used server-side only)
export interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

// Secure question without correct answer (used client-side during quiz)
export interface SecureQuestion {
  question: string;
  options: string[];
}

// Quiz with full questions (server-side)
export interface Quiz {
  topic: string;
  questions: Question[];
}

// Quiz with secure questions (client-side during quiz taking)
export interface SecureQuiz {
  topic: string;
  questions: SecureQuestion[];
}

// Result of validating a single question
export interface QuizQuestionResult {
  questionIndex: number;
  isCorrect: boolean;
  correctAnswer: number;
  userAnswer: number;
  explanation?: string;
}

// Full quiz validation result from server
export interface QuizValidationResult {
  success: boolean;
  score: number;
  maxScore: number;
  percentage: number;
  results: QuizQuestionResult[];
}

export interface QuizInterfaceProps {
  quiz: SecureQuiz;
  onQuizComplete: (answers: number[]) => void;
  contentItem?: ContentItem | null;
  isSubmitting?: boolean;
}


export interface QuizResultsProps {
  quiz: SecureQuiz;
  userAnswers: number[];
  score: number;
  validationResults?: QuizQuestionResult[];
  onRestart: () => void;
  contentItem?: ContentItem | null;
  attemptHistory?: Array<{
    _id: string;
    attemptNumber: number;
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    completedAt: number;
  }>;
}
