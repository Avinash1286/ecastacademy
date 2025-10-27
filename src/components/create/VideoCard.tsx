"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ExternalLink, Trash2, FileText, User, Save, X, Edit } from 'lucide-react';
import type { VideoInfo } from '@/lib/types';
import Image from 'next/image';

interface VideoCardProps {
  video: VideoInfo;
  onRemove: (id: string) => void;
  onTranscriptUpdate: (id: string, newTranscript: string) => void; 
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onRemove, onTranscriptUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(video.transcript || '');

    const handleSave = () => {
      onTranscriptUpdate(video.id, editText);
      setIsEditing(false);
      toast.success("Transcript has been saved.");
    };

    const handleCancel = () => {
      setEditText(video.transcript || '');
      setIsEditing(false);
    };

    const handleEditClick = () => {
      setEditText(video.transcript || '');
      setIsEditing(true);
    };
    
    return (
      <div className="bg-card border border-border rounded-lg flex flex-col overflow-hidden transition-all duration-200 hover:border-primary/50 shadow-sm">
        <div className="relative">
          <div className="aspect-video w-full bg-muted">
            <Image
              src={video.thumbnail}
              alt={video.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              style={{ objectFit: 'cover' }}
              className="w-full h-full object-cover"
            />
          </div>
          {video.skipTranscript && (
            <Badge variant="secondary" className="absolute top-2 left-2 bg-amber-500/80 text-black">
              AI Skipped
            </Badge>
          )}
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="bg-black/60 text-white">
              {video.duration}
            </Badge>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div>
            <h3 className="text-base font-semibold line-clamp-2 leading-snug text-card-foreground">{video.title}</h3>
            <div className="mt-1.5 flex items-center text-xs text-muted-foreground">
              <User className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{video.channelTitle}</span>
            </div>
          </div>

          {/* DYNAMIC TRANSCRIPT SECTION */}
          <div className="mt-4 flex flex-grow flex-col">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium text-card-foreground">Transcript</h4>
              {!isEditing && (
                <Button variant="ghost" size="sm" onClick={handleEditClick} className="h-7 gap-1">
                  {video.transcript ? <Edit className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  {video.transcript ? 'Edit' : 'Add'}
                </Button>
              )}
            </div>

            {isEditing ? (
              // EDITING VIEW
              <div className="flex flex-grow flex-col gap-2">
                <ScrollArea className="h-24 w-full rounded-md border">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Paste or write the transcript here..."
                  className="flex-grow text-sm overflow-hidden"
                  rows={24}
                  />
                  </ScrollArea>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-1"/>Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={editText === (video.transcript || '')}>
                    <Save className="h-4 w-4 mr-1"/>Save
                  </Button>
                </div>
              </div>
            ) : (
              // VIEWING VIEW
              <div className="flex-grow rounded-md border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground pr-4 line-clamp-3">
                  {video.transcript || (
                    <span className="italic">
                      {video.skipTranscript
                        ? 'Transcript import skipped for this video.'
                        : 'No transcript available. Click Add to create one.'}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between  border-border pt-3">
            <p className="truncate pr-2 text-xs text-muted-foreground">ID: {video.id}</p>
            <div className="flex items-center gap-2">
                <Button asChild variant="secondary" size="icon" className="h-8 w-8">
                    <a href={video.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </Button>
                <TooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                        <Button onClick={() => onRemove(video.id)} variant="destructive" size="icon" className="h-8 w-8">
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">Remove video</span>
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Remove Video</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    );
};