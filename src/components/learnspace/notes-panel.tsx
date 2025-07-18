import { InteractiveNotes } from "@/components/notes/InteractiveNotes"

export const NotesPanel = ({notes}:any) => {
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