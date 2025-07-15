import { MessageCircle } from 'lucide-react';


export function TutorWorkspace() {
  return (
    <div className="flex flex-grow flex-col items-center justify-center gap-4 p-4 text-center">
      <MessageCircle className="h-16 w-16 text-zinc-600" strokeWidth={1} />
      <h2 className="text-xl font-medium text-zinc-400">Learn with the AI Tutor</h2>
    </div>
  );
}