import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AtSign, Mic, Search, Sparkles } from 'lucide-react';

export function TutorInput() {
  return (
    <div className="shrink-0 space-y-3 border-t border-border p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-grow">
          <Input placeholder="Ask anything" />
        </div>
        <Button type="button" variant="secondary">
          <Mic className="mr-2 h-5 w-5" /><span className="hidden sm:inline">Voice</span>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Select defaultValue="default">
          <SelectTrigger className="h-8 w-auto text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="expert">Expert</SelectItem>
          </SelectContent>
        </Select>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="h-8 border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
        >
          <Sparkles className="mr-1 h-3 w-3" /> Learn+
        </Button>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Mention User">
          <AtSign className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}