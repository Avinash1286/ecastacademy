import { InteractiveNotes } from "@/components/notes/InteractiveNotes"
import { InteractiveNotesProps } from "@/lib/types"
import { interactiveNotesSchema } from "@/lib/validators/generatedContentSchemas"

const buildValidationState = (notes: InteractiveNotesProps | null | undefined) => {
  if (!notes) {
    return { valid: false as const, reason: "missing" as const };
  }

  const parsed = interactiveNotesSchema.safeParse(notes);
  if (!parsed.success) {
    console.warn("Invalid interactive notes payload", parsed.error.flatten());
    return { valid: false as const, reason: "invalid" as const };
  }

  return { valid: true as const, data: parsed.data };
};

export const NotesPanel = ({ notes }: { notes: InteractiveNotesProps | null | undefined }) => {
  const validation = buildValidationState(notes);

  if (!validation.valid) {
    const message =
      validation.reason === "missing"
        ? "AI notes haven’t been generated for this chapter yet."
        : "We detected formatting issues in the generated notes. Please retry generation from the admin panel.";

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground">
          <p className="font-medium">Notes unavailable</p>
          <p className="mt-2 text-sm">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <InteractiveNotes
          topic={validation.data.topic} 
          sections={validation.data.sections}
          learningObjectives={validation.data.learningObjectives}
          summary={validation.data.summary}
        />
      </div>
    </div>
  )
}