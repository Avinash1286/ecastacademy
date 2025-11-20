export const interactiveNotesResponseSchema = {
  type: "object",
  properties: {
    topic: { type: "string" },
    learningObjectives: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 5,
      nullable: true,
    },
    sections: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          introHook: { type: "string", nullable: true },
          content: { type: "string" },
          microSummary: { type: "string", nullable: true },
          keyPoints: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            nullable: true,
          },
          examples: {
            type: "array",
            items: { type: "string" },
            nullable: true,
          },
          callouts: {
            type: "array",
            maxItems: 4,
            nullable: true,
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["tip", "example", "note", "common-mistake"] },
                title: { type: "string", nullable: true },
                content: { type: "string" },
                bullets: {
                  type: "array",
                  items: { type: "string" },
                  nullable: true,
                },
              },
              required: ["type", "content"],
              additionalProperties: false,
            },
          },
          codeBlocks: {
            type: "array",
            maxItems: 3,
            nullable: true,
            items: {
              type: "object",
              properties: {
                code: { type: "string" },
                language: { type: "string" },
                title: { type: "string", nullable: true },
              },
              required: ["code", "language"],
              additionalProperties: false,
            },
          },
          highlights: {
            type: "array",
            maxItems: 3,
            nullable: true,
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["insight", "important", "warning"] },
                title: { type: "string", nullable: true },
                content: { type: "string" },
              },
              required: ["type", "content"],
              additionalProperties: false,
            },
          },
          definitions: {
            type: "array",
            maxItems: 5,
            nullable: true,
            items: {
              type: "object",
              properties: {
                term: { type: "string" },
                definition: { type: "string" },
                example: { type: "string", nullable: true },
              },
              required: ["term", "definition"],
              additionalProperties: false,
            },
          },
          interactivePrompts: {
            type: "array",
            maxItems: 2,
            nullable: true,
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["thought-experiment", "hands-on", "self-check"] },
                title: { type: "string" },
                prompt: { type: "string" },
                steps: {
                  type: "array",
                  items: { type: "string" },
                  nullable: true,
                  maxItems: 5,
                },
              },
              required: ["type", "title", "prompt"],
              additionalProperties: false,
            },
          },
          reflectionQuestions: {
            type: "array",
            maxItems: 3,
            nullable: true,
            items: { type: "string" },
          },
          quiz: {
            type: "array",
            maxItems: 3,
            nullable: true,
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["mcq", "true-false", "fill-blank"] },
                question: { type: "string" },
                options: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 0,
                  maxItems: 4,
                  nullable: true,
                },
                correctAnswer: { type: "string" },
                explanation: { type: "string" },
              },
              required: ["type", "question", "correctAnswer", "explanation"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "content"],
        additionalProperties: false,
      },
    },
    summary: {
      type: "object",
      nullable: true,
      properties: {
        recap: { type: "string" },
        nextSteps: {
          type: "array",
          items: { type: "string" },
          nullable: true,
        },
        keyTakeaway: { type: "string", nullable: true },
      },
      required: ["recap"],
      additionalProperties: false,
    },
  },
  required: ["topic", "sections"],
  additionalProperties: false,
} as const;

export const quizResponseSchema = {
  type: "object",
  properties: {
    topic: { type: "string" },
    questions: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
            minItems: 4,
            maxItems: 4,
          },
          correct: {
            type: "integer",
            minimum: 0,
            maximum: 3,
          },
          explanation: { type: "string" },
        },
        required: ["question", "options", "correct", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["topic", "questions"],
  additionalProperties: false,
} as const;
