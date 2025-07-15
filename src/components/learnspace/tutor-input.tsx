import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AtSign, Mic, Search, Sparkles } from 'lucide-react';

export function TutorInput() {
  return (
    <div className="shrink-0 space-y-3 border-t border-zinc-800 p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-grow">
          <Input placeholder="Ask anything" className="w-full bg-zinc-800 border-zinc-700 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:ring-offset-0" />
        </div>
        <Button type="button" className="bg-zinc-700 text-white hover:bg-zinc-600">
          <Mic className="mr-2 h-5 w-5" /><span className="hidden sm:inline">Voice</span>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Select defaultValue="default"><SelectTrigger className="w-auto h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-300"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Default</SelectItem><SelectItem value="expert">Expert</SelectItem></SelectContent></Select>
        <Button type="button" size="sm" className="h-8 text-xs bg-teal-900/50 text-teal-300 border border-teal-700 hover:bg-teal-900/70"><Sparkles className="mr-1 h-3 w-3" /> Learn+</Button>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 bg-zinc-800 border-zinc-700 hover:bg-zinc-700" aria-label="Search"><Search className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 bg-zinc-800 border-zinc-700 hover:bg-zinc-700" aria-label="Mention User"><AtSign className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}