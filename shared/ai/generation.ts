import { GoogleGenAI } from "@google/genai";
import { NOTES_PROMPT, QUIZ_PROMPT, STRUCTURED_REPAIR_PROMPT, TUTOR_CHAT_PROMPT } from "@shared/ai/prompts";
import { interactiveNotesResponseSchema, quizResponseSchema } from "@shared/ai/responseSchemas";
import { cleanTranscript } from "@shared/ai/transcript";
import { retryWithExponentialBackoff } from "@shared/ai/retry";

const GEMINI_MODEL = "gemini-2.5-pro";

let ai: GoogleGenAI | null = null;

const getClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
};

const defaultConfig = {
  thinkingConfig: {
    thinkingBudget: -1,
  },
  generationConfig: {
    maxOutputTokens: 65536,
  },
};

export type TutorChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const generateNotes = async (
  rawTranscript: string,
  options: { videoTitle?: string } = {}
): Promise<string> => {
  const transcript = cleanTranscript(rawTranscript);
  if (!transcript) {
    throw new Error("Transcript is empty. Cannot generate notes.");
  }

  const contents = [
    {
      role: "user" as const,
      parts: [
        {
          text: `Video Title: ${options.videoTitle ?? "Untitled Lesson"}\n\nTranscript:\n${transcript}`,
        },
      ],
    },
  ];

  const response = await retryWithExponentialBackoff(() =>
    getClient().models.generateContent({
      model: GEMINI_MODEL,
      config: {
        ...defaultConfig,
        responseMimeType: "application/json",
        responseSchema: interactiveNotesResponseSchema,
        systemInstruction: [{ text: NOTES_PROMPT }],
      },
      contents,
    })
  );

  return response.text ?? "";
};

export const generateQuiz = async (input: string): Promise<string> => {
  const contents = [
    {
      role: "user" as const,
      parts: [
        {
          text: input,
        },
      ],
    },
  ];

  const response = await retryWithExponentialBackoff(() =>
    getClient().models.generateContent({
      model: GEMINI_MODEL,
      config: {
        ...defaultConfig,
        responseMimeType: "application/json",
        responseSchema: quizResponseSchema,
        systemInstruction: [{ text: QUIZ_PROMPT }],
      },
      contents,
    })
  );

  return response.text ?? "";
};

export const generateTutorResponse = async (params: {
  transcript: string;
  messages: TutorChatMessage[];
  videoTitle?: string;
  courseTitle?: string;
  chapterTitle?: string;
}): Promise<string> => {
  const transcript = cleanTranscript(params.transcript).slice(0, 4_000_000);

  if (!transcript) {
    throw new Error("Transcript is empty. Cannot answer questions yet.");
  }

  const conversation = params.messages
    .filter((message) => message.content?.trim().length)
    .slice(-8)
    .map((message) => ({
      role: message.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: message.content }],
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

  const response = await retryWithExponentialBackoff(() =>
    getClient().models.generateContent({
      model: GEMINI_MODEL,
      config: {
        ...defaultConfig,
        systemInstruction: [
          {
            text: `${TUTOR_CHAT_PROMPT}
${contextBlock ? `\n${contextBlock}` : ""}
\nTranscript:\n${transcript}`,
          },
        ],
      },
      contents: conversation,
    })
  );

  return response.text ?? "";
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
  payload: StructuredRepairRequest
): Promise<string> => {
  const contents = [
    {
      role: "user" as const,
      parts: [
        {
          text: JSON.stringify(payload, null, 2),
        },
      ],
    },
  ];

  const response = await retryWithExponentialBackoff(() =>
    getClient().models.generateContent({
      model: GEMINI_MODEL,
      config: {
        ...defaultConfig,
        responseMimeType: "application/json",
        systemInstruction: [{ text: STRUCTURED_REPAIR_PROMPT }],
      },
      contents,
    })
  );

  return response.text ?? "";
};
