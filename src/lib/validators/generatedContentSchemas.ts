import { z } from "zod";

const calloutTypes = ["tip", "example", "note", "common-mistake"] as const;
const highlightTypes = ["insight", "important", "warning"] as const;
const interactivePromptTypes = ["thought-experiment", "hands-on", "self-check"] as const;
const quizQuestionTypes = ["mcq", "true-false", "fill-blank"] as const;

export const interactivePromptSchema = z.object({
  type: z.enum(interactivePromptTypes),
  title: z.string().min(1, "Interactive prompt title is required"),
  prompt: z.string().min(1, "Interactive prompt text is required"),
  steps: z
    .array(z.string().min(1))
    .min(1)
    .max(5)
    .optional(),
});

export const sectionQuizSchema = z
  .object({
    type: z.enum(quizQuestionTypes),
    question: z.string().min(1, "Quiz question cannot be empty"),
    options: z.array(z.string().min(1)).optional(),
    correctAnswer: z.string().min(1, "Quiz answer cannot be empty"),
    explanation: z.string().min(1, "Quiz explanation cannot be empty"),
  })
  .superRefine((value, ctx) => {
    if (value.type === "mcq") {
      if (!value.options || value.options.length !== 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multiple choice questions require exactly 4 options",
          path: ["options"],
        });
      } else if (!value.options.includes(value.correctAnswer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Correct answer must be one of the provided options",
          path: ["correctAnswer"],
        });
      }
    }

    if (value.type !== "mcq" && value.options && value.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only multiple choice questions can include options",
        path: ["options"],
      });
    }
  });

export const calloutSchema = z.object({
  type: z.enum(calloutTypes),
  title: z.string().optional(),
  content: z.string().min(1, "Callout content is required"),
  bullets: z.array(z.string().min(1)).min(1).optional(),
});

export const codeBlockSchema = z.object({
  code: z.string().min(1, "Code sample cannot be empty"),
  language: z.string().min(1, "Language is required"),
  title: z.string().optional(),
});

export const highlightSchema = z.object({
  type: z.enum(highlightTypes),
  title: z.string().optional(),
  content: z.string().min(1, "Highlight content is required"),
});

export const definitionSchema = z.object({
  term: z.string().min(1, "Definition term is required"),
  definition: z.string().min(1, "Definition text is required"),
  example: z.string().optional(),
});

export const noteSectionSchema = z.object({
  title: z.string().min(1, "Section title is required"),
  introHook: z.string().min(1).optional(),
  content: z.string().min(1, "Section content cannot be empty"),
  microSummary: z.string().min(1).optional(),
  keyPoints: z.array(z.string().min(1)).min(2).optional(),
  examples: z.array(z.string().min(1)).min(1).optional(),
  callouts: z.array(calloutSchema).max(4).optional(),
  codeBlocks: z.array(codeBlockSchema).max(3).optional(),
  highlights: z.array(highlightSchema).max(3).optional(),
  definitions: z.array(definitionSchema).max(5).optional(),
  interactivePrompts: z.array(interactivePromptSchema).max(2).optional(),
  reflectionQuestions: z.array(z.string().min(1)).max(3).optional(),
  quiz: z.array(sectionQuizSchema).max(3).optional(),
});

export const interactiveNotesSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  learningObjectives: z.array(z.string().min(1)).min(2).max(5).optional(),
  sections: z.array(noteSectionSchema).min(1, "At least one section is required"),
  summary: z
    .object({
      recap: z.string().min(1, "Summary recap is required"),
      nextSteps: z.array(z.string().min(1)).min(1).optional(),
      keyTakeaway: z.string().min(1).optional(),
    })
    .optional(),
});

export const generatedQuizSchema = z.object({
  topic: z.string().min(1, "Quiz topic is required"),
  questions: z
    .array(
      z
        .object({
          question: z.string().min(1, "Question text is required"),
          options: z.array(z.string().min(1)).length(4, "Each question requires four options"),
          correct: z.number().int().min(0).max(3),
          explanation: z.string().min(1, "Question explanation is required"),
        })
        .superRefine((value, ctx) => {
          if (value.correct < 0 || value.correct >= value.options.length) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Correct answer index must reference one of the options",
              path: ["correct"],
            });
          }
        })
    )
    .min(3, "Quiz should include at least three questions"),
});

export const interactiveNotesSchemaDescription = `Interactive notes JSON must include a topic string, optional learningObjectives array (2-5 short bullet points), and a sections array. Each section requires a title and content string and can optionally include: introHook, microSummary, keyPoints (>=2), examples, callouts (max 4), codeBlocks (max 3), highlights (max 3), definitions (max 5), interactivePrompts (max 2) with type thought-experiment|hands-on|self-check, reflectionQuestions (max 3), and quiz items (max 3) whose type is mcq|true-false|fill-blank. Quiz items must include question, correctAnswer, explanation, and four options only when the type is mcq. The root may include a summary object with recap text plus optional nextSteps array and keyTakeaway string.`;

export const generatedQuizSchemaDescription = `Quiz JSON must have a topic string and questions array. Each question needs the fields question (string), options (array of exactly four non-empty strings), correct (number index 0-3), and explanation (string). The quiz should include at least three questions.`;
