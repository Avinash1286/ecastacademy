import { z } from "zod";

/**
 * Shared artifact schema definitions for the revamped capsule pipeline.
 * These schemas are imported by Convex (backend) and React (frontend)
 * to guarantee that every artifact renders without ad-hoc coercion.
 */

export const artifactStatusSchema = z.enum(["pending", "valid", "degraded", "failed"]);
export type ArtifactStatus = z.infer<typeof artifactStatusSchema>;

const metadataSchema = z.object({
  artifactId: z.string().min(1),
  status: artifactStatusSchema.default("pending"),
  validatorVersion: z.string().optional(),
  validatedAt: z.number().optional(),
  sourceChunkIds: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const diagnosticQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(5),
  correctIndex: z.number().int().min(0),
  rationale: z.string().optional(),
});

export const contextCardSchema = z.object({
  kind: z.literal("contextCard"),
  title: z.string().min(1),
  hook: z.string().min(1),
  outcomes: z.array(z.string().min(1)).min(1),
  diagnosticQuestion: diagnosticQuestionSchema.optional(),
});
export type ContextCard = z.infer<typeof contextCardSchema>;

const mermaidVisualSchema = z.object({
  kind: z.literal("mermaid"),
  code: z.string().min(1),
  svg: z.string().optional(),
  description: z.string().optional(),
});

const htmlSnippetVisualSchema = z.object({
  kind: z.literal("htmlSnippet"),
  html: z.string().min(1),
  css: z.string().optional(),
  javascript: z.string().optional(),
  description: z.string().optional(),
});

const imagePromptVisualSchema = z.object({
  kind: z.literal("imagePrompt"),
  prompt: z.string().min(1),
  alt: z.string().optional(),
});

const visualUnionSchema = z.discriminatedUnion("kind", [
  mermaidVisualSchema,
  htmlSnippetVisualSchema,
  imagePromptVisualSchema,
]);

export const conceptExplainerSchema = z.object({
  kind: z.literal("conceptExplainer"),
  title: z.string().min(1),
  narrative: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(2),
  visual: visualUnionSchema.optional(),
  realWorldExample: z.string().optional(),
});
export type ConceptExplainer = z.infer<typeof conceptExplainerSchema>;

const mcqPracticeSchema = z.object({
  variant: z.literal("mcq"),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(3).max(5),
  correctIndex: z.number().int().min(0),
  explanation: z.string().min(1),
  hint: z.string().optional(),
});

const fillBlankPracticeSchema = z.object({
  variant: z.literal("fillBlanks"),
  instruction: z.string().min(1),
  text: z.string().min(1),
  blanks: z
    .array(
      z.object({
        id: z.string().min(1),
        correctAnswer: z.string().min(1),
        alternatives: z.array(z.string().min(1)).optional(),
        hint: z.string().optional(),
      })
    )
    .min(1),
});

const dragDropPracticeSchema = z.object({
  variant: z.literal("dragDrop"),
  instruction: z.string().min(1),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
      })
    )
    .min(1),
  targets: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        accepts: z.array(z.string().min(1)).min(1),
      })
    )
    .min(1),
  feedback: z
    .object({
      correct: z.string().default("Great job!"),
      incorrect: z.string().default("Try matching again."),
    })
    .optional(),
});

const guidedPracticeVariantSchema = z.discriminatedUnion("variant", [
  mcqPracticeSchema,
  fillBlankPracticeSchema,
  dragDropPracticeSchema,
]);

export const guidedPracticeSchema = z.object({
  kind: z.literal("guidedPractice"),
  title: z.string().min(1),
  prompt: z.string().optional(),
  practice: guidedPracticeVariantSchema,
  scoring: z
    .object({
      maxPoints: z.number().int().positive().default(10),
      masteryThreshold: z.number().min(0).max(1).default(0.8),
    })
    .default({ maxPoints: 10, masteryThreshold: 0.8 }),
});
export type GuidedPractice = z.infer<typeof guidedPracticeSchema>;

export const simulationRuntimeSchema = z.enum(["p5", "vanilla", "threejs-lite"]);

export const appliedSimulationSchema = z.object({
  kind: z.literal("appliedSimulation"),
  title: z.string().min(1),
  description: z.string().min(1),
  runtime: simulationRuntimeSchema,
  instructions: z.array(z.string().min(1)).min(1),
  code: z.object({
    html: z.string().optional(),
    css: z.string().optional(),
    javascript: z.string().min(1),
  }),
  resources: z.array(z.string().url()).optional(),
  observationPrompts: z.array(z.string().min(1)).optional(),
});
export type AppliedSimulation = z.infer<typeof appliedSimulationSchema>;

export const reflectionCardSchema = z.object({
  kind: z.literal("reflectionCard"),
  title: z.string().min(1),
  prompt: z.string().min(1),
  checklist: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
        required: z.boolean().default(false),
      })
    )
    .optional(),
  journalingSuggestions: z.array(z.string().min(1)).optional(),
});
export type ReflectionCard = z.infer<typeof reflectionCardSchema>;

export const artifactUnionSchema = z.discriminatedUnion("kind", [
  contextCardSchema,
  conceptExplainerSchema,
  guidedPracticeSchema,
  appliedSimulationSchema,
  reflectionCardSchema,
]);
export type CapsuleArtifact = z.infer<typeof artifactUnionSchema>;

export const artifactEnvelopeSchema = z.object({
  meta: metadataSchema,
  data: artifactUnionSchema,
});
export type CapsuleArtifactEnvelope = z.infer<typeof artifactEnvelopeSchema>;

export const capsuleModuleSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  artifacts: z.array(artifactEnvelopeSchema).min(1),
});
export type CapsuleModule = z.infer<typeof capsuleModuleSchema>;

export const capsuleSchema = z.object({
  capsuleId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  estimatedDuration: z.number().int().positive(),
  modules: z.array(capsuleModuleSchema).min(1),
});
export type CapsulePayload = z.infer<typeof capsuleSchema>;

export const lessonKinds = [
  "contextCard",
  "conceptExplainer",
  "guidedPractice",
  "appliedSimulation",
  "reflectionCard",
] as const;
export type LessonKind = (typeof lessonKinds)[number];
