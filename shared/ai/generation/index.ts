import { generateText, FilePart } from "ai";
import { 
  NOTES_PROMPT, 
  QUIZ_PROMPT, 
  STRUCTURED_REPAIR_PROMPT, 
  TUTOR_CHAT_PROMPT,
  CAPSULE_OUTLINE_PROMPT,
  CAPSULE_MODULE_CONTENT_PROMPT,
  CAPSULE_LESSON_CONTENT_PROMPT,
  CAPSULE_SCHEMA_DESCRIPTIONS 
} from "@shared/ai/prompts";
import { cleanTranscript } from "@shared/ai/transcript";
import { getAIClient, type AIModelConfig } from "@shared/ai/core";

export type TutorChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Helper to validate that modelConfig is provided
 * All AI features must use admin-configured models - no fallbacks allowed
 */
function requireModelConfig(modelConfig: AIModelConfig | undefined, featureName: string): AIModelConfig {
  if (!modelConfig) {
    throw new Error(
      `AI model configuration is required for ${featureName}. ` +
      `Please configure the model in the admin panel.`
    );
  }
  return modelConfig;
}

export const generateNotes = async (
  rawTranscript: string,
  options: { videoTitle?: string; modelConfig: AIModelConfig }
): Promise<string> => {
  const transcript = cleanTranscript(rawTranscript);
  if (!transcript) {
    throw new Error("Transcript is empty. Cannot generate notes.");
  }

  const validatedConfig = requireModelConfig(options.modelConfig, "notes generation");
  const model = getAIClient(validatedConfig);

  const prompt = `Video Title: ${options.videoTitle ?? "Untitled Lesson"}\n\nTranscript:\n${transcript}`;

  const { text } = await generateText({
    model,
    system: NOTES_PROMPT,
    prompt,
  });

  return text;
};

export const generateQuiz = async (
  input: string,
  modelConfig: AIModelConfig
): Promise<string> => {
  const validatedConfig = requireModelConfig(modelConfig, "quiz generation");
  const model = getAIClient(validatedConfig);

  const { text } = await generateText({
    model,
    system: QUIZ_PROMPT,
    prompt: input,
  });

  return text;
};

export const generateTutorResponse = async (params: {
  transcript: string;
  messages: TutorChatMessage[];
  videoTitle?: string;
  courseTitle?: string;
  chapterTitle?: string;
  modelConfig: AIModelConfig;
}): Promise<string> => {
  const transcript = cleanTranscript(params.transcript).slice(0, 4_000_000);

  if (!transcript) {
    throw new Error("Transcript is empty. Cannot answer questions yet.");
  }

  const conversation = params.messages
    .filter((message) => message.content?.trim().length)
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  if (conversation.length === 0) {
    throw new Error("No user question was provided.");
  }

  const contextBlock = [
    params.courseTitle ? `Course: ${params.courseTitle}` : null,
    params.chapterTitle ? `Chapter: ${params.chapterTitle}` : null,
    params.videoTitle ? `Lesson: ${params.videoTitle}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const validatedConfig = requireModelConfig(params.modelConfig, "tutor chat");
  const model = getAIClient(validatedConfig);

  const system = `${TUTOR_CHAT_PROMPT}
${contextBlock ? `\n${contextBlock}` : ""}
\nTranscript:\n${transcript}`;

  const { text } = await generateText({
    model,
    system,
    messages: conversation,
  });

  return text;
};

export type StructuredRepairRequest = {
  format: string;
  schemaName: string;
  schemaDescription: string;
  previousOutput: string;
  errorMessage: string;
  originalInput?: string;
  attempt: number;
};

export const repairStructuredJson = async (
  payload: StructuredRepairRequest,
  modelConfig: AIModelConfig
): Promise<string> => {
  const validatedConfig = requireModelConfig(modelConfig, "structured JSON repair");
  const model = getAIClient(validatedConfig);

  const { text } = await generateText({
    model,
    system: STRUCTURED_REPAIR_PROMPT,
    prompt: JSON.stringify(payload, null, 2),
  });

  return text;
};

// =========================================================================
// CAPSULE COURSE GENERATION FUNCTIONS
// =========================================================================

export type CapsuleGenerationInput = {
  sourceType: "pdf" | "topic";
  pdfBuffer?: ArrayBuffer;
  topic?: string;
  guidance?: string;
  documentTitle?: string;
};

export type ModuleGenerationInput = {
  sourceType: "pdf" | "topic";
  pdfBuffer?: ArrayBuffer;
  topic?: string;
  capsuleTitle: string;
  capsuleDescription: string;
  moduleTitle: string;
  moduleDescription: string;
  moduleIndex: number;
  lessons: Array<{
    title: string;
    description: string;
  }>;
};

export type LessonGenerationInput = {
  sourceType: "pdf" | "topic";
  pdfBuffer?: ArrayBuffer;
  topic?: string;
  capsuleTitle: string;
  moduleTitle: string;
  moduleIndex: number;
  lessonTitle: string;
  lessonDescription: string;
  lessonIndex: number;
};

/**
 * Create a FilePart from a PDF buffer for use with Vercel AI SDK
 */
function createPdfFilePart(pdfBuffer: ArrayBuffer): FilePart {
  const base64Data = Buffer.from(pdfBuffer).toString("base64");
  return {
    type: "file",
    data: base64Data,
    mediaType: "application/pdf",
  };
}

/**
 * Generate a course outline from a PDF document or topic
 * Uses native PDF support via Vercel AI SDK FilePart
 */
export const generateCapsuleOutline = async (
  input: CapsuleGenerationInput,
  options: { modelConfig: AIModelConfig }
): Promise<string> => {
  const validatedConfig = requireModelConfig(options.modelConfig, "capsule outline generation");
  const model = getAIClient(validatedConfig);

  let contextPrompt: string;
  
  if (input.sourceType === "pdf") {
    if (!input.pdfBuffer) {
      throw new Error("PDF buffer is required for PDF-based generation");
    }
    contextPrompt = input.documentTitle 
      ? `Document: ${input.documentTitle}\n\nAnalyze the attached PDF and create a comprehensive course outline.`
      : "Analyze the attached PDF and create a comprehensive course outline.";
    
    if (input.guidance) {
      contextPrompt += `\n\nAdditional guidance: ${input.guidance}`;
    }
    
    const pdfPart = createPdfFilePart(input.pdfBuffer);
    
    const { text } = await generateText({
      model,
      system: CAPSULE_OUTLINE_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            pdfPart,
            { type: "text", text: contextPrompt },
          ],
        },
      ],
    });
    
    return text;
  } else {
    // Topic-based generation
    if (!input.topic) {
      throw new Error("Topic is required for topic-based generation");
    }
    
    contextPrompt = `Create a comprehensive course outline for the topic: "${input.topic}"`;
    
    if (input.guidance) {
      contextPrompt += `\n\nAdditional guidance: ${input.guidance}`;
    }
    
    const { text } = await generateText({
      model,
      system: CAPSULE_OUTLINE_PROMPT,
      prompt: contextPrompt,
    });
    
    return text;
  }
};

/**
 * Generate detailed content for all lessons in a module
 * Uses native PDF support via Vercel AI SDK FilePart
 */
export const generateModuleContent = async (
  input: ModuleGenerationInput,
  options: { modelConfig: AIModelConfig }
): Promise<string> => {
  const validatedConfig = requireModelConfig(options.modelConfig, "capsule module content generation");
  const model = getAIClient(validatedConfig);

  const moduleContext = `Course: ${input.capsuleTitle}
Course Description: ${input.capsuleDescription}

Generate content for Module ${input.moduleIndex + 1}: "${input.moduleTitle}"
Module Description: ${input.moduleDescription}

Lessons to generate content for:
${input.lessons.map((l, i) => `${i + 1}. ${l.title}: ${l.description}`).join("\n")}

Generate engaging content for EACH lesson listed above.`;

  if (input.sourceType === "pdf" && input.pdfBuffer) {
    const pdfPart = createPdfFilePart(input.pdfBuffer);
    
    const { text } = await generateText({
      model,
      system: CAPSULE_MODULE_CONTENT_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            pdfPart,
            { type: "text", text: moduleContext + "\n\nUse the attached PDF as the source material." },
          ],
        },
      ],
    });
    
    return text;
  } else {
    const { text } = await generateText({
      model,
      system: CAPSULE_MODULE_CONTENT_PROMPT,
      prompt: moduleContext + `\n\nBase the content on the topic: "${input.topic}"`,
    });
    
    return text;
  }
};

/**
 * Generate focused content for a single lesson (for regeneration)
 * Uses native PDF support via Vercel AI SDK FilePart
 */
export const generateLessonContent = async (
  input: LessonGenerationInput,
  options: { modelConfig: AIModelConfig }
): Promise<string> => {
  const validatedConfig = requireModelConfig(options.modelConfig, "capsule lesson content generation");
  const model = getAIClient(validatedConfig);

  const lessonContext = `Course: ${input.capsuleTitle}
Module ${input.moduleIndex + 1}: ${input.moduleTitle}

Generate content for Lesson ${input.lessonIndex + 1}: "${input.lessonTitle}"
Description: ${input.lessonDescription}

Create focused, engaging content for this lesson.`;

  if (input.sourceType === "pdf" && input.pdfBuffer) {
    const pdfPart = createPdfFilePart(input.pdfBuffer);
    
    const { text } = await generateText({
      model,
      system: CAPSULE_LESSON_CONTENT_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            pdfPart,
            { type: "text", text: lessonContext + "\n\nUse the attached PDF as the source material." },
          ],
        },
      ],
    });
    
    return text;
  } else {
    const { text } = await generateText({
      model,
      system: CAPSULE_LESSON_CONTENT_PROMPT,
      prompt: lessonContext + `\n\nBase the content on the topic: "${input.topic}"`,
    });
    
    return text;
  }
};

/**
 * Get schema descriptions for capsule content types
 * Used for validation repair context
 */
export const getCapsuleSchemaDescription = (type: "outline" | "moduleContent" | "lessonContent"): string => {
  return CAPSULE_SCHEMA_DESCRIPTIONS[type];
};

// =============================================================================
// Visualization Regeneration
// =============================================================================

interface VisualizationRegenerationInput {
  currentVisualization: {
    title?: string;
    description?: string;
    html?: string;
    css?: string;
    javascript?: string;
  };
  userFeedback: string;
  lessonContext: {
    lessonTitle: string;
    moduleTitle: string;
    capsuleTitle: string;
  };
}

/**
 * Regenerate an interactive visualization based on user feedback
 * Uses the current visualization and user's description of what's wrong or what they want
 */
export const regenerateVisualization = async (
  input: VisualizationRegenerationInput,
  options: { modelConfig: AIModelConfig }
): Promise<string> => {
  const { VISUALIZATION_REGENERATION_PROMPT } = await import("@shared/ai/prompts");
  const validatedConfig = requireModelConfig(options.modelConfig, "visualization regeneration");
  const model = getAIClient(validatedConfig);

  const contextPrompt = `
LESSON CONTEXT:
- Course: ${input.lessonContext.capsuleTitle}
- Module: ${input.lessonContext.moduleTitle}
- Lesson: ${input.lessonContext.lessonTitle}

CURRENT VISUALIZATION:
Title: ${input.currentVisualization.title || "Untitled"}
Description: ${input.currentVisualization.description || "No description"}

Current HTML:
\`\`\`html
${input.currentVisualization.html || "<div></div>"}
\`\`\`

Current CSS:
\`\`\`css
${input.currentVisualization.css || "/* No CSS */"}
\`\`\`

Current JavaScript:
\`\`\`javascript
${input.currentVisualization.javascript || "// No JavaScript"}
\`\`\`

USER FEEDBACK:
"${input.userFeedback}"

Based on the user's feedback, regenerate this visualization. Make it functional, visually appealing, and educational.
If the user says it's broken, focus on fixing the code.
If the user wants specific changes, implement those changes.
If the current code is completely unusable, create a fresh visualization that serves the same educational purpose.

Output ONLY the JSON object with title, description, type, html, css, and javascript fields.`;

  const { text } = await generateText({
    model,
    system: VISUALIZATION_REGENERATION_PROMPT,
    prompt: contextPrompt,
  });

  return text;
};
