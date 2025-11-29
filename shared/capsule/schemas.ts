/**
 * Zod Schemas for Capsule Content Validation
 * 
 * DESIGN PRINCIPLES:
 * 1. Flexible - Accept variations in AI responses
 * 2. Coercible - Use transforms to normalize data
 * 3. Defaults - Provide sensible fallbacks
 * 4. Minimal required fields - Only validate what's truly essential
 * 
 * These schemas align with the prompts in shared/ai/prompts.ts
 */

import { z } from "zod";

// =============================================================================
// UTILITY SCHEMAS (reusable building blocks)
// =============================================================================

/** Flexible string that accepts empty strings but transforms to undefined */
const flexibleString = z.string().optional().transform(s => s?.trim() || undefined);

/** String with minimum length, but graceful fallback */
const safeString = (min = 1) => z.string().min(min).catch("");

/** Safe integer that handles variations */
const safeInt = z.union([z.number(), z.string().transform(Number)]).pipe(z.number().int());

// =============================================================================
// CAPSULE OUTLINE SCHEMA (Stage 1)
// =============================================================================

/**
 * Lesson plan in outline - flexible to handle AI variations
 * AI might return "type" or "lessonType", "name" or "title", etc.
 */
export const outlineLessonSchema = z.object({
  // Title - accept various field names
  id: flexibleString,
  title: safeString(1),
  name: flexibleString,
  description: flexibleString,
  objective: flexibleString,
  learningObjective: flexibleString,
  estimatedMinutes: safeInt.optional(),
  estimatedDuration: safeInt.optional(),
  order: safeInt.optional(),
}).transform(data => ({
  id: data.id || `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: data.title || data.name || "Untitled Lesson",
  description: data.description || data.objective || data.learningObjective || "",
  estimatedMinutes: data.estimatedMinutes || data.estimatedDuration || 10,
  order: data.order || 0,
}));

/**
 * Module in outline - flexible structure
 */
export const outlineModuleSchema = z.object({
  id: flexibleString,
  title: safeString(1),
  name: flexibleString,
  description: flexibleString,
  order: safeInt.optional(),
  lessons: z.array(z.any()).min(1).catch([]), // Accept any array, validate items separately
}).transform(data => {
  // Parse lessons array with fallback
  const parsedLessons = (data.lessons || []).map((lesson: unknown, index: number) => {
    try {
      return outlineLessonSchema.parse(lesson);
    } catch {
      // If a lesson fails to parse, create a minimal valid one
      return {
        id: `lesson-${Date.now()}-${index}`,
        title: typeof lesson === 'object' && lesson !== null && 'title' in lesson 
          ? String((lesson as Record<string, unknown>).title) 
          : `Lesson ${index + 1}`,
        description: "",
        estimatedMinutes: 10,
        order: index,
      };
    }
  });

  return {
    id: data.id || `module-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: data.title || data.name || "Untitled Module",
    description: data.description || "",
    order: data.order || 0,
    lessons: parsedLessons,
  };
});

/**
 * Main capsule outline schema - very flexible to handle AI variations
 */
export const capsuleOutlineSchema = z.object({
  title: safeString(1),
  name: flexibleString,
  description: flexibleString,
  summary: flexibleString,
  estimatedDuration: z.union([safeInt, z.string()]).optional(),
  totalDuration: z.union([safeInt, z.string()]).optional(),
  modules: z.array(z.any()).min(1).catch([]),
}).transform(data => {
  // Parse modules array with fallback
  const parsedModules = (data.modules || []).map((mod: unknown, index: number) => {
    try {
      return outlineModuleSchema.parse(mod);
    } catch {
      return {
        id: `module-${Date.now()}-${index}`,
        title: typeof mod === 'object' && mod !== null && 'title' in mod 
          ? String((mod as Record<string, unknown>).title) 
          : `Module ${index + 1}`,
        description: "",
        order: index,
        lessons: [{
          id: `lesson-fallback-${index}`,
          title: "Lesson 1",
          description: "",
          estimatedMinutes: 10,
          order: 0,
        }],
      };
    }
  });

  // Parse duration - handle various formats
  let duration = 60;
  const durationVal = data.estimatedDuration || data.totalDuration;
  if (typeof durationVal === 'number') {
    duration = durationVal;
  } else if (typeof durationVal === 'string') {
    const parsed = parseInt(durationVal, 10);
    if (!isNaN(parsed)) duration = parsed;
  }

  return {
    title: data.title || data.name || "Untitled Course",
    description: data.description || data.summary || "",
    estimatedDuration: duration,
    modules: parsedModules,
  };
});

export type CapsuleOutline = z.output<typeof capsuleOutlineSchema>;

export const capsuleOutlineSchemaDescription = `Course outline JSON with: title, description, estimatedDuration (minutes), and modules array. Each module has: id, title, description, order, and lessons array. Each lesson has: id, title, description, estimatedMinutes, order. The structure is flexible - use reasonable field names.`;

// =============================================================================
// MODULE CONTENT SCHEMA (Stage 2)
// =============================================================================

/**
 * Code example - flexible structure
 */
export const codeExampleSchema = z.object({
  title: flexibleString,
  code: z.string().optional(),
  language: z.string().optional(),
  explanation: flexibleString,
}).passthrough(); // Allow extra fields

/**
 * Interactive Visualization - HTML/CSS/JS components
 */
export const interactiveVisualizationSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  html: z.string().optional(),
  css: z.string().optional(),
  javascript: z.string().optional(),
  js: z.string().optional(), // Alternative field name
}).passthrough().transform(data => ({
  title: data.title || "Interactive Visualization",
  description: data.description || "",
  type: data.type || "interactive",
  html: data.html || "<div></div>",
  css: data.css || "",
  javascript: data.javascript || data.js || "",
}));

/**
 * Fill-in-blanks question
 */
const fillBlanksQuestionSchema = z.object({
  type: z.literal("fillBlanks").optional(),
  instruction: z.string().optional(),
  text: z.string().optional(),
  sentence: z.string().optional(),
  blanks: z.array(z.object({
    id: z.string().optional(),
    position: z.number().optional(),
    correctAnswer: z.string(),
    alternatives: z.array(z.string()).optional(),
    hint: z.string().optional(),
  })).optional(),
}).passthrough().transform(data => ({
  type: "fillBlanks" as const,
  instruction: data.instruction || "Fill in the blanks",
  text: data.text || data.sentence || "",
  blanks: (data.blanks || []).map((blank, idx) => ({
    id: blank.id || `blank-${idx + 1}`,
    correctAnswer: blank.correctAnswer,
    alternatives: blank.alternatives || [],
    hint: blank.hint,
  })),
}));

/**
 * Drag-and-drop question
 */
const dragDropQuestionSchema = z.object({
  type: z.literal("dragDrop").optional(),
  instruction: z.string().optional(),
  items: z.array(z.object({
    id: z.string(),
    content: z.string(),
    category: z.string().optional(),
  })).optional(),
  targets: z.array(z.object({
    id: z.string(),
    label: z.string(),
    acceptsItems: z.array(z.string()).optional(),
    correctItemIds: z.array(z.string()).optional(),
  })).optional(),
  feedback: z.object({
    correct: z.string().optional(),
    incorrect: z.string().optional(),
  }).optional(),
}).passthrough().transform(data => ({
  type: "dragDrop" as const,
  instruction: data.instruction || "Drag items to their correct targets",
  items: (data.items || []).map((item, idx) => ({
    id: item.id || `item-${idx + 1}`,
    content: item.content || `Item ${idx + 1}`,
    category: item.category,
  })),
  targets: (data.targets || []).map((target, idx) => ({
    id: target.id || `target-${idx + 1}`,
    label: target.label || `Target ${idx + 1}`,
    acceptsItems: target.acceptsItems || target.correctItemIds || [],
  })),
  feedback: {
    correct: data.feedback?.correct || "Great job!",
    incorrect: data.feedback?.incorrect || "Try again!",
  },
}));

/**
 * Practice question - flexible to handle MCQ, fill-blanks, drag-drop variations
 */
const practiceQuestionSchema = z.object({
  type: z.string().optional(),
  question: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctIndex: z.union([safeInt, z.string().transform(Number)]).optional(),
  correct: z.union([safeInt, z.string().transform(Number)]).optional(),
  correctAnswer: z.union([safeInt, z.string()]).optional(),
  explanation: z.string().optional(),
  // Fill-blanks fields
  instruction: z.string().optional(),
  text: z.string().optional(),
  sentence: z.string().optional(),
  blanks: z.array(z.any()).optional(),
  // Drag-drop fields
  items: z.array(z.any()).optional(),
  targets: z.array(z.any()).optional(),
  feedback: z.any().optional(),
}).passthrough().transform(data => {
  // Determine question type
  const questionType = data.type?.toLowerCase() || 
    (data.blanks && data.blanks.length > 0 ? "fillBlanks" : 
     data.items && data.items.length > 0 ? "dragDrop" : "mcq");
  
  if (questionType === "fillblanks" || questionType === "fillBlanks" || questionType === "fill-blanks") {
    return fillBlanksQuestionSchema.parse({ ...data, type: "fillBlanks" });
  }
  
  if (questionType === "dragdrop" || questionType === "dragDrop" || questionType === "drag-drop") {
    return dragDropQuestionSchema.parse({ ...data, type: "dragDrop" });
  }
  
  // Default to MCQ
  let correctIdx = 0;
  if (typeof data.correctIndex === 'number') correctIdx = data.correctIndex;
  else if (typeof data.correct === 'number') correctIdx = data.correct;
  else if (typeof data.correctAnswer === 'number') correctIdx = data.correctAnswer;
  else if (typeof data.correctAnswer === 'string' && data.options) {
    const answerStr = String(data.correctAnswer);
    const idx = data.options.findIndex(o => o.toLowerCase() === answerStr.toLowerCase());
    if (idx >= 0) correctIdx = idx;
  }

  return {
    type: "mcq" as const,
    question: data.question || "Question not generated",
    options: data.options || ["Option A", "Option B", "Option C", "Option D"],
    correctIndex: Math.min(correctIdx, (data.options?.length || 4) - 1),
    explanation: data.explanation || "See the lesson content for explanation.",
  };
});

/**
 * Content section - very flexible
 */
const contentSectionSchema = z.object({
  type: z.string().optional(),
  title: flexibleString,
  content: z.string().optional(),
  text: z.string().optional(),
  keyPoints: z.array(z.string()).optional(),
}).passthrough().transform(data => ({
  type: data.type || "explanation",
  title: data.title || "",
  content: data.content || data.text || "",
  keyPoints: data.keyPoints || [],
}));

/**
 * Lesson content within a module - highly flexible
 */
const lessonContentSchema = z.object({
  lessonId: flexibleString,
  id: flexibleString,
  title: z.string().min(1).catch("Untitled Lesson"),
  content: z.any().optional(),
  sections: z.array(z.any()).optional(),
  explanation: z.string().optional(),
  codeExamples: z.array(z.any()).optional(),
  interactiveVisualizations: z.array(z.any()).optional(),
  visualizations: z.array(z.any()).optional(),
  practiceQuestions: z.array(z.any()).optional(),
  quiz: z.any().optional(),
}).passthrough().transform(data => {
  // Normalize content structure
  let sections: Array<{ type: string; title: string; content: string; keyPoints: string[] }> = [];
  let codeExamples: unknown[] = [];
  let interactiveVisualizations: unknown[] = [];
  let practiceQuestions: unknown[] = [];

  // Handle content object vs direct fields
  const contentObj = data.content && typeof data.content === 'object' ? data.content : null;

  // Extract sections
  if (data.sections && Array.isArray(data.sections)) {
    sections = data.sections.map((s: unknown) => {
      try { return contentSectionSchema.parse(s); } 
      catch { return { type: "text", title: "", content: String(s), keyPoints: [] }; }
    });
  } else if (contentObj?.sections && Array.isArray(contentObj.sections)) {
    sections = contentObj.sections.map((s: unknown) => {
      try { return contentSectionSchema.parse(s); } 
      catch { return { type: "text", title: "", content: String(s), keyPoints: [] }; }
    });
  } else if (data.explanation) {
    sections = [{ type: "explanation", title: "Overview", content: data.explanation, keyPoints: [] }];
  }

  // Extract code examples
  if (data.codeExamples && Array.isArray(data.codeExamples)) {
    codeExamples = data.codeExamples;
  } else if (contentObj?.codeExamples && Array.isArray(contentObj.codeExamples)) {
    codeExamples = contentObj.codeExamples;
  }

  // Extract interactive visualizations
  const vizData = data.interactiveVisualizations || data.visualizations || 
    contentObj?.interactiveVisualizations || contentObj?.visualizations;
  if (vizData && Array.isArray(vizData)) {
    interactiveVisualizations = vizData.map((v: unknown) => {
      try { return interactiveVisualizationSchema.parse(v); }
      catch { return null; }
    }).filter(Boolean);
  }

  // Extract practice questions
  if (data.practiceQuestions && Array.isArray(data.practiceQuestions)) {
    practiceQuestions = data.practiceQuestions.map((q: unknown) => {
      try { return practiceQuestionSchema.parse(q); }
      catch { return null; }
    }).filter(Boolean);
  } else if (contentObj?.practiceQuestions && Array.isArray(contentObj.practiceQuestions)) {
    practiceQuestions = contentObj.practiceQuestions.map((q: unknown) => {
      try { return practiceQuestionSchema.parse(q); }
      catch { return null; }
    }).filter(Boolean);
  } else if (data.quiz) {
    try { practiceQuestions = [practiceQuestionSchema.parse(data.quiz)]; }
    catch { /* ignore */ }
  }

  return {
    lessonId: data.lessonId || data.id || `lesson-${Date.now()}`,
    title: data.title,
    content: {
      sections,
      codeExamples,
      interactiveVisualizations,
      practiceQuestions,
    },
  };
});

/**
 * Full module content schema
 */
export const moduleContentSchema = z.object({
  moduleId: flexibleString,
  id: flexibleString,
  moduleTitle: flexibleString,
  title: z.string().optional(),
  introduction: flexibleString,
  learningObjectives: z.array(z.string()).optional(),
  lessons: z.array(z.any()).min(1).catch([]),
  moduleSummary: flexibleString,
  summary: flexibleString,
}).transform(data => {
  // Parse lessons with fallback
  const parsedLessons = (data.lessons || []).map((lesson: unknown, index: number) => {
    try {
      return lessonContentSchema.parse(lesson);
    } catch {
      return {
        lessonId: `lesson-${index}`,
        title: typeof lesson === 'object' && lesson !== null && 'title' in lesson
          ? String((lesson as Record<string, unknown>).title)
          : `Lesson ${index + 1}`,
        content: {
          sections: [{ type: "explanation", title: "Content", content: "Content could not be parsed.", keyPoints: [] }],
          codeExamples: [],
          interactiveVisualizations: [],
          practiceQuestions: [],
        },
      };
    }
  });

  return {
    moduleId: data.moduleId || data.id || `module-${Date.now()}`,
    title: data.moduleTitle || data.title || "Untitled Module",
    introduction: data.introduction || "",
    learningObjectives: data.learningObjectives || [],
    lessons: parsedLessons,
    moduleSummary: data.moduleSummary || data.summary || "",
  };
});

export type ModuleContent = z.output<typeof moduleContentSchema>;

export const moduleContentSchemaDescription = `Module content JSON with: moduleId (or id), title (or moduleTitle), introduction, learningObjectives array, lessons array, and moduleSummary. Each lesson has: lessonId, title, and content object containing:
- sections: array of {type, title, content, keyPoints[]}
- codeExamples: array of {title, code, language, explanation}
- interactiveVisualizations: array of {title, description, type, html, css, javascript} for interactive HTML/CSS/JS visualizations
- practiceQuestions: array supporting multiple types:
  - MCQ: {type: "mcq", question, options[], correctIndex, explanation}
  - Fill Blanks: {type: "fillBlanks", instruction, text (with {{blankId}} placeholders), blanks[{id, correctAnswer, alternatives[], hint}]}
  - Drag & Drop: {type: "dragDrop", instruction, items[{id, content}], targets[{id, label, acceptsItems[]}], feedback{correct, incorrect}}`;

// =============================================================================
// SINGLE LESSON CONTENT SCHEMA (for regeneration)
// =============================================================================

/**
 * Example in a lesson
 */
const lessonExampleSchema = z.object({
  title: flexibleString,
  scenario: flexibleString,
  demonstration: flexibleString,
  codeSnippet: z.string().optional(),
  language: z.string().optional(),
}).passthrough();

/**
 * Practice exercise
 */
const practiceExerciseSchema = z.object({
  instruction: z.string().optional(),
  instructions: z.string().optional(),
  hints: z.array(z.string()).optional(),
  sampleSolution: z.string().optional(),
  solution: z.string().optional(),
}).transform(data => ({
  instruction: data.instruction || data.instructions || "",
  hints: data.hints || [],
  sampleSolution: data.sampleSolution || data.solution || "",
}));

/**
 * Single lesson content for regeneration
 */
export const singleLessonContentSchema = z.object({
  lessonId: flexibleString,
  id: flexibleString,
  title: z.string().min(1).catch("Untitled Lesson"),
  estimatedMinutes: safeInt.optional(),
  duration: safeInt.optional(),
  content: z.object({
    hook: z.string().optional(),
    introduction: z.string().optional(),
    explanation: z.string().optional(),
    examples: z.array(z.any()).optional(),
    keyTakeaways: z.array(z.string()).optional(),
    keyPoints: z.array(z.string()).optional(),
    practiceExercise: z.any().optional(),
    quiz: z.any().optional(),
  }).passthrough().optional(),
  nextSteps: flexibleString,
  next: flexibleString,
}).transform(data => {
  const content = data.content || {};
  
  // Parse examples
  const examples = (content.examples || []).map((ex: unknown) => {
    try { return lessonExampleSchema.parse(ex); }
    catch { return { title: "", scenario: "", demonstration: String(ex) }; }
  });

  // Parse practice exercise
  let practiceExercise = { instruction: "", hints: [] as string[], sampleSolution: "" };
  if (content.practiceExercise) {
    try { practiceExercise = practiceExerciseSchema.parse(content.practiceExercise); }
    catch { /* use default */ }
  }

  // Parse quiz
  let quiz = null;
  if (content.quiz) {
    try { quiz = practiceQuestionSchema.parse(content.quiz); }
    catch { /* ignore */ }
  }

  return {
    lessonId: data.lessonId || data.id || `lesson-${Date.now()}`,
    title: data.title,
    estimatedMinutes: data.estimatedMinutes || data.duration || 10,
    content: {
      hook: content.hook || content.introduction || "",
      explanation: content.explanation || "",
      examples,
      keyTakeaways: content.keyTakeaways || content.keyPoints || [],
      practiceExercise,
      quiz,
    },
    nextSteps: data.nextSteps || data.next || "",
  };
});

export type SingleLessonContent = z.output<typeof singleLessonContentSchema>;

export const singleLessonContentSchemaDescription = `Lesson content JSON with: lessonId, title, estimatedMinutes, content object (hook, explanation, examples array, keyTakeaways array, practiceExercise, quiz), and nextSteps.`;
