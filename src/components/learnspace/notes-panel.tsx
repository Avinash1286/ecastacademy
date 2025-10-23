import { InteractiveNotes } from "@/components/notes/InteractiveNotes"
import { InteractiveNotesProps } from "@/lib/types"

export const NotesPanel = ({ notes }: { notes: InteractiveNotesProps | null | undefined }) => {
  // Check if notes has the required structure
  if (!notes || !notes.topic || !notes.sections || !Array.isArray(notes.sections)) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center text-muted-foreground">
          <p>No notes available for this chapter yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <InteractiveNotes
          topic={notes.topic} 
          sections={notes.sections}
        />
      </div>
    </div>
  )
}