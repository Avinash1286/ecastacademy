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
}


export interface Course {
  id: string;
  name: string;
  description: string | "";
  thumbnailUrl: string | "";
  createdAt: string;
}

export type ChapterWithVideo = {
  id: string;
  name: string;
  order: number;
  course: {
    id: string;
    name: string;
    description: string | null;
  },
  video: {
    videoId: string;
    title: string;
    url: string;
    thumbnailUrl: string | null;
    durationInSeconds: number | null;
    notes: InteractiveNotesProps;
    quiz: Quiz;
  };
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


export interface NoteSection {
  title: string;
  content: string;
  keyPoints?: string[];
  examples?: string[];
  callouts?: CalloutSection[];
  codeBlocks?: CodeBlock[];
  highlights?: HighlightBox[];
  definitions?: DefinitionCard[];
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
  sections: NoteSection[];
}

export interface DefinitionCardProps {
  term: string;
  definition: string;
  example?: string;
}


export interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

export interface Quiz {
  topic: string;
  questions: Question[];
}

export interface QuizInterfaceProps {
  quiz: Quiz;
  onQuizComplete: (answers: number[], score: number) => void;
}


export interface QuizResultsProps {
  quiz: Quiz;
  userAnswers: number[];
  score: number;
  onRestart: () => void;
}
