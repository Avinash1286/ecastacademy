import { generateText } from "ai";
import { NOTES_PROMPT, QUIZ_PROMPT, STRUCTURED_REPAIR_PROMPT, TUTOR_CHAT_PROMPT } from "@shared/ai/prompts";
import { cleanTranscript } from "@shared/ai/transcript";
import { getAIClient, AIModelConfig } from "@shared/ai/centralized";

export type TutorChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_CONFIG: AIModelConfig = {
  provider: "google",
  modelId: "gemini-2.5-pro",
};

export const generateNotes = async (
  rawTranscript: string,
  options: { videoTitle?: string; modelConfig?: AIModelConfig } = {}
): Promise<string> => {
  const transcript = cleanTranscript(rawTranscript);
  if (!transcript) {
    throw new Error("Transcript is empty. Cannot generate notes.");
  }

  const model = getAIClient(options.modelConfig || DEFAULT_CONFIG);

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
  modelConfig?: AIModelConfig
): Promise<string> => {
  const model = getAIClient(modelConfig || DEFAULT_CONFIG);

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
  modelConfig?: AIModelConfig;
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

  const model = getAIClient(params.modelConfig || DEFAULT_CONFIG);

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
  modelConfig?: AIModelConfig
): Promise<string> => {
  const model = getAIClient(modelConfig || DEFAULT_CONFIG);

  const { text } = await generateText({
    model,
    system: STRUCTURED_REPAIR_PROMPT,
    prompt: JSON.stringify(payload, null, 2),
  });

  return text;
};
