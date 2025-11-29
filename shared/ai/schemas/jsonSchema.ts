/**
 * JSON Schema generation from Zod schemas.
 * Used for AI structured output (Gemini's responseSchema, OpenAI's json_schema).
 * 
 * These are auto-generated from Zod to ensure consistency.
 */

import { SchemaType } from "@google/generative-ai";

// =============================================================================
// JSON Schema Type Definitions
// =============================================================================

export interface JsonSchemaProperty {
  type: SchemaType | string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
}

export interface JsonSchema {
  type: SchemaType | string;
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: JsonSchemaProperty;
}

// =============================================================================
// Lesson Content Schemas (for AI)
// =============================================================================

export const MCQ_CONTENT_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "Multiple choice question content",
  properties: {
    question: {
      type: SchemaType.STRING,
      description: "The question text (minimum 10 characters)",
      minLength: 10,
    },
    options: {
      type: SchemaType.ARRAY,
      description: "Answer options (2-6 unique, specific choices - NOT generic like 'Option A')",
      items: {
        type: SchemaType.STRING,
        description: "A specific, meaningful answer option",
        minLength: 1,
      },
      minItems: 2,
      maxItems: 6,
    },
    correctAnswer: {
      type: SchemaType.NUMBER,
      description: "Zero-based index of the correct option",
      minimum: 0,
    },
    explanation: {
      type: SchemaType.STRING,
      description: "Detailed explanation of why the answer is correct (minimum 20 characters)",
      minLength: 20,
    },
    hint: {
      type: SchemaType.STRING,
      description: "Optional hint for the learner",
    },
  },
  required: ["question", "options", "correctAnswer", "explanation"],
};

export const CONCEPT_CONTENT_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "Concept explanation content",
  properties: {
    conceptTitle: {
      type: SchemaType.STRING,
      description: "Title of the concept being explained",
      minLength: 3,
    },
    explanation: {
      type: SchemaType.STRING,
      description: "Detailed explanation of the concept (minimum 100 characters)",
      minLength: 100,
    },
    visualAid: {
      type: SchemaType.OBJECT,
      description: "Optional interactive visualization",
      properties: {
        type: {
          type: SchemaType.STRING,
          enum: ["diagram", "flowchart", "animation", "visualization"],
          description: "Type of visual aid",
        },
        description: {
          type: SchemaType.STRING,
          description: "Description of what the visual shows",
          minLength: 10,
        },
        code: {
          type: SchemaType.OBJECT,
          description: "Code for the visualization",
          properties: {
            html: { type: SchemaType.STRING, description: "HTML structure" },
            css: { type: SchemaType.STRING, description: "CSS styles" },
            javascript: { 
              type: SchemaType.STRING, 
              description: "JavaScript code (required, minimum 10 characters)",
              minLength: 10,
            },
          },
          required: ["javascript"],
        },
      },
      required: ["type", "description"],
    },
    keyPoints: {
      type: SchemaType.ARRAY,
      description: "Key takeaways (2-10 points)",
      items: {
        type: SchemaType.STRING,
        description: "A key point (minimum 10 characters)",
        minLength: 10,
      },
      minItems: 2,
      maxItems: 10,
    },
    realWorldExample: {
      type: SchemaType.STRING,
      description: "Optional real-world application example",
    },
  },
  required: ["conceptTitle", "explanation", "keyPoints"],
};

export const FILL_BLANKS_CONTENT_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "Fill in the blanks content",
  properties: {
    instruction: {
      type: SchemaType.STRING,
      description: "Instructions for the activity",
      minLength: 5,
    },
    text: {
      type: SchemaType.STRING,
      description: "Text with {{id}} placeholders where blanks should appear (e.g., 'The {{blank-1}} is a {{blank-2}}')",
      minLength: 20,
    },
    blanks: {
      type: SchemaType.ARRAY,
      description: "Array of blank definitions",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: {
            type: SchemaType.STRING,
            description: "Unique identifier matching a {{id}} placeholder in text (e.g., 'blank-1')",
            minLength: 1,
          },
          correctAnswer: {
            type: SchemaType.STRING,
            description: "The correct word/phrase for this blank (NOT generic like 'answer')",
            minLength: 1,
          },
          alternatives: {
            type: SchemaType.ARRAY,
            description: "Alternative correct answers",
            items: { type: SchemaType.STRING },
          },
          hint: {
            type: SchemaType.STRING,
            description: "Hint for this blank",
          },
        },
        required: ["id", "correctAnswer"],
      },
      minItems: 1,
      maxItems: 10,
    },
  },
  required: ["instruction", "text", "blanks"],
};

export const DRAG_DROP_CONTENT_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "Drag and drop activity content",
  properties: {
    instruction: {
      type: SchemaType.STRING,
      description: "Instructions for the drag-drop activity",
      minLength: 10,
    },
    activityType: {
      type: SchemaType.STRING,
      enum: ["matching", "ordering", "categorization"],
      description: "Type of drag-drop activity",
    },
    items: {
      type: SchemaType.ARRAY,
      description: "Draggable items (2-12)",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: {
            type: SchemaType.STRING,
            description: "Unique identifier (e.g., 'item-1')",
            minLength: 1,
          },
          content: {
            type: SchemaType.STRING,
            description: "The content/label of the draggable item (NOT generic like 'Item 1')",
            minLength: 1,
          },
          category: {
            type: SchemaType.STRING,
            description: "Optional category for categorization activities",
          },
        },
        required: ["id", "content"],
      },
      minItems: 2,
      maxItems: 12,
    },
    targets: {
      type: SchemaType.ARRAY,
      description: "Drop targets (1-8)",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: {
            type: SchemaType.STRING,
            description: "Unique identifier (e.g., 'target-1')",
            minLength: 1,
          },
          label: {
            type: SchemaType.STRING,
            description: "Label shown on the drop target (NOT generic like 'Target 1')",
            minLength: 1,
          },
          acceptsItems: {
            type: SchemaType.ARRAY,
            description: "Array of item IDs that can be dropped here",
            items: { type: SchemaType.STRING },
            minItems: 1,
          },
        },
        required: ["id", "label", "acceptsItems"],
      },
      minItems: 1,
      maxItems: 8,
    },
    feedback: {
      type: SchemaType.OBJECT,
      description: "Optional feedback messages",
      properties: {
        correct: { type: SchemaType.STRING, description: "Message on correct placement" },
        incorrect: { type: SchemaType.STRING, description: "Message on incorrect placement" },
      },
    },
  },
  required: ["instruction", "items", "targets"],
};

export const SIMULATION_CONTENT_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "Interactive simulation content",
  properties: {
    title: {
      type: SchemaType.STRING,
      description: "Title of the simulation",
      minLength: 3,
    },
    description: {
      type: SchemaType.STRING,
      description: "Description of what the simulation demonstrates",
      minLength: 20,
    },
    simulationType: {
      type: SchemaType.STRING,
      enum: ["html-css-js"],
      description: "Type of simulation runtime",
    },
    code: {
      type: SchemaType.OBJECT,
      description: "Code for the simulation",
      properties: {
        html: { type: SchemaType.STRING, description: "HTML structure" },
        css: { type: SchemaType.STRING, description: "CSS styles" },
        javascript: { 
          type: SchemaType.STRING, 
          description: "JavaScript code (required, minimum 20 characters)",
          minLength: 20,
        },
      },
      required: ["javascript"],
    },
    instructions: {
      type: SchemaType.STRING,
      description: "Instructions for interacting with the simulation",
      minLength: 20,
    },
    observationPrompts: {
      type: SchemaType.ARRAY,
      description: "Questions to guide observation",
      items: { type: SchemaType.STRING, minLength: 5 },
    },
    learningGoals: {
      type: SchemaType.ARRAY,
      description: "Learning objectives",
      items: { type: SchemaType.STRING, minLength: 5 },
    },
  },
  required: ["title", "description", "simulationType", "code", "instructions"],
};

// =============================================================================
// Lesson Schema (with discriminator)
// =============================================================================

export const LESSON_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "A single lesson with title, type, and content",
  properties: {
    title: {
      type: SchemaType.STRING,
      description: "Lesson title",
      minLength: 3,
    },
    lessonType: {
      type: SchemaType.STRING,
      enum: ["mcq", "concept", "fillBlanks", "dragDrop", "simulation"],
      description: "Type of lesson - determines content structure",
    },
    content: {
      type: SchemaType.OBJECT,
      description: "Lesson content - structure depends on lessonType",
      // This is a union - AI must match the correct structure based on lessonType
    },
  },
  required: ["title", "lessonType", "content"],
};

// =============================================================================
// Module Schema
// =============================================================================

export const MODULE_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "A module containing multiple lessons",
  properties: {
    title: {
      type: SchemaType.STRING,
      description: "Module title",
      minLength: 3,
    },
    description: {
      type: SchemaType.STRING,
      description: "Module description",
      minLength: 10,
    },
    lessons: {
      type: SchemaType.ARRAY,
      description: "Lessons in this module (1-20)",
      items: LESSON_JSON_SCHEMA as JsonSchemaProperty,
      minItems: 1,
      maxItems: 20,
    },
  },
  required: ["title", "description", "lessons"],
};

// =============================================================================
// Full Capsule Schema
// =============================================================================

export const CAPSULE_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "Complete capsule with modules and lessons",
  properties: {
    title: {
      type: SchemaType.STRING,
      description: "Capsule title",
      minLength: 3,
    },
    description: {
      type: SchemaType.STRING,
      description: "Capsule description",
      minLength: 20,
    },
    estimatedDuration: {
      type: SchemaType.NUMBER,
      description: "Estimated duration in minutes (5-300)",
      minimum: 5,
      maximum: 300,
    },
    modules: {
      type: SchemaType.ARRAY,
      description: "Modules in the capsule (1-10)",
      items: MODULE_JSON_SCHEMA as JsonSchemaProperty,
      minItems: 1,
      maxItems: 10,
    },
  },
  required: ["title", "description", "estimatedDuration", "modules"],
};

// =============================================================================
// Stage 1: Outline Schema (Simple, reliable)
// =============================================================================

export const OUTLINE_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "Capsule outline - just structure, no detailed content",
  properties: {
    title: {
      type: SchemaType.STRING,
      description: "Capsule title",
      minLength: 3,
    },
    description: {
      type: SchemaType.STRING,
      description: "Capsule description",
      minLength: 20,
    },
    estimatedDuration: {
      type: SchemaType.NUMBER,
      description: "Estimated total duration in minutes",
      minimum: 5,
      maximum: 300,
    },
    modules: {
      type: SchemaType.ARRAY,
      description: "Module outlines",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: {
            type: SchemaType.STRING,
            description: "Module title",
            minLength: 3,
          },
          description: {
            type: SchemaType.STRING,
            description: "Brief module description",
            minLength: 10,
          },
          lessonCount: {
            type: SchemaType.NUMBER,
            description: "Number of lessons planned (1-10)",
            minimum: 1,
            maximum: 10,
          },
        },
        required: ["title", "description", "lessonCount"],
      },
      minItems: 1,
      maxItems: 10,
    },
  },
  required: ["title", "description", "estimatedDuration", "modules"],
};

// =============================================================================
// Stage 2: Module Lesson Plan Schema
// =============================================================================

export const LESSON_PLAN_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "Lesson plan for a single module",
  properties: {
    moduleTitle: {
      type: SchemaType.STRING,
      description: "Title of the module",
      minLength: 3,
    },
    lessons: {
      type: SchemaType.ARRAY,
      description: "Planned lessons",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: {
            type: SchemaType.STRING,
            description: "Lesson title",
            minLength: 3,
          },
          lessonType: {
            type: SchemaType.STRING,
            enum: ["mcq", "concept", "fillBlanks", "dragDrop", "simulation"],
            description: "Type of lesson",
          },
          objective: {
            type: SchemaType.STRING,
            description: "Learning objective for this lesson",
            minLength: 10,
          },
        },
        required: ["title", "lessonType", "objective"],
      },
      minItems: 1,
      maxItems: 10,
    },
  },
  required: ["moduleTitle", "lessons"],
};

// =============================================================================
// Stage 3: Individual Lesson Content Schema
// =============================================================================

export const LESSON_CONTENT_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "Content for a single lesson",
  properties: {
    lessonTitle: {
      type: SchemaType.STRING,
      description: "Title of the lesson",
      minLength: 3,
    },
    lessonType: {
      type: SchemaType.STRING,
      enum: ["mcq", "concept", "fillBlanks", "dragDrop", "simulation"],
      description: "Type of lesson",
    },
    content: {
      type: SchemaType.OBJECT,
      description: "The lesson content - structure must match lessonType",
    },
  },
  required: ["lessonTitle", "lessonType", "content"],
};

// =============================================================================
// Helper: Get content schema by lesson type
// =============================================================================

export function getContentSchemaForType(lessonType: string): JsonSchema {
  switch (lessonType) {
    case "mcq":
      return MCQ_CONTENT_JSON_SCHEMA;
    case "concept":
      return CONCEPT_CONTENT_JSON_SCHEMA;
    case "fillBlanks":
      return FILL_BLANKS_CONTENT_JSON_SCHEMA;
    case "dragDrop":
      return DRAG_DROP_CONTENT_JSON_SCHEMA;
    case "simulation":
      return SIMULATION_CONTENT_JSON_SCHEMA;
    default:
      throw new Error(`Unknown lesson type: ${lessonType}`);
  }
}

// =============================================================================
// OPTIMIZED: Combined Outline + Lesson Plans Schema (Stage 1 Optimized)
// Single API call returns outline WITH full lesson plans
// =============================================================================

export const COMBINED_OUTLINE_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "Combined capsule outline with lesson plans - returns full structure in one call",
  properties: {
    title: {
      type: SchemaType.STRING,
      description: "Capsule title",
      minLength: 3,
    },
    description: {
      type: SchemaType.STRING,
      description: "Capsule description",
      minLength: 20,
    },
    estimatedDuration: {
      type: SchemaType.NUMBER,
      description: "Estimated total duration in minutes",
      minimum: 5,
      maximum: 300,
    },
    modules: {
      type: SchemaType.ARRAY,
      description: "Modules with full lesson plans",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: {
            type: SchemaType.STRING,
            description: "Module title",
            minLength: 3,
          },
          description: {
            type: SchemaType.STRING,
            description: "Brief module description",
            minLength: 10,
          },
          lessons: {
            type: SchemaType.ARRAY,
            description: "Lesson plans for this module (1-10)",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                title: {
                  type: SchemaType.STRING,
                  description: "Lesson title",
                  minLength: 3,
                },
                lessonType: {
                  type: SchemaType.STRING,
                  enum: ["mcq", "concept", "fillBlanks", "dragDrop", "simulation"],
                  description: "Type of lesson",
                },
                objective: {
                  type: SchemaType.STRING,
                  description: "Learning objective for this lesson",
                  minLength: 10,
                },
              },
              required: ["title", "lessonType", "objective"],
            },
            minItems: 1,
            maxItems: 10,
          },
        },
        required: ["title", "description", "lessons"],
      },
      minItems: 1,
      maxItems: 10,
    },
  },
  required: ["title", "description", "estimatedDuration", "modules"],
};

// =============================================================================
// OPTIMIZED: Module Content Schema (Stage 2 Optimized)
// Single API call generates ALL lessons for a module
// =============================================================================

export const MODULE_CONTENT_JSON_SCHEMA: JsonSchema = {
  type: SchemaType.OBJECT,
  description: "All generated lessons for a module in one call",
  properties: {
    moduleTitle: {
      type: SchemaType.STRING,
      description: "Title of the module",
      minLength: 3,
    },
    lessons: {
      type: SchemaType.ARRAY,
      description: "All generated lessons for this module",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: {
            type: SchemaType.STRING,
            description: "Lesson title",
            minLength: 3,
          },
          lessonType: {
            type: SchemaType.STRING,
            enum: ["mcq", "concept", "fillBlanks", "dragDrop", "simulation"],
            description: "Type of lesson",
          },
          content: {
            type: SchemaType.OBJECT,
            description: "The lesson content - structure depends on lessonType. MCQ: question/options/correctAnswer/explanation. Concept: conceptTitle/explanation/keyPoints. FillBlanks: instruction/text/blanks. DragDrop: instruction/items/targets. Simulation: title/description/code/instructions.",
          },
        },
        required: ["title", "lessonType", "content"],
      },
      minItems: 1,
      maxItems: 10,
    },
  },
  required: ["moduleTitle", "lessons"],
};
