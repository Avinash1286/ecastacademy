'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CheckCircle2, XCircle, GripVertical } from 'lucide-react';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { ConfettiCelebration } from '@/components/ui/ConfettiCelebration';
import { cn } from '@/lib/utils';

interface DragDropAnswerData {
  questionText: string;
  placements: Record<string, string>;
  isCorrect: boolean;
  items: Array<{ id: string; content: string }>;
  targets: Array<{ id: string; label: string }>;
}

interface DragDropProps {
  instruction?: string;
  activityType?: 'matching' | 'ordering' | 'categorization';
  items?: Array<{
    id: string;
    content: string;
    category?: string;
  }>;
  targets?: Array<{
    id: string;
    label: string;
    acceptsItems?: string[];
    correctItemIds?: string[];
  }>;
  feedback?: {
    correct: string;
    incorrect: string;
  };
  onComplete?: (correct: boolean) => void;
  onQuizAnswer?: (data: DragDropAnswerData) => void;
  isCompleted?: boolean;
  lastAnswer?: {
    placements?: Record<string, string>;
  };
}

export function DragDropLesson({ instruction, items, targets, feedback, onComplete, onQuizAnswer, isCompleted = false, lastAnswer }: DragDropProps) {
  const normalizedItems = Array.isArray(items)
    ? items.map((item, index) => ({
        id: item.id || `item-${index + 1}`,
        content: item.content || `Item ${index + 1}`,
        category: item.category,
      }))
    : [];
  const normalizedTargets = Array.isArray(targets)
    ? targets.map((target, index) => ({
        id: target.id || `target-${index + 1}`,
        label: target.label || `Target ${index + 1}`,
        acceptsItems:
          (target.acceptsItems && target.acceptsItems.length > 0
            ? target.acceptsItems
            : target.correctItemIds) || [],
      }))
    : [];
  const normalizedFeedback = feedback ?? {
    correct: 'Great job! Everything is matched correctly.',
    incorrect: 'Some matches need review. Try again!',
  };
  const promptInstruction = instruction?.trim().length
    ? instruction
    : 'Drag each item to the matching target.';

  const [placements, setPlacements] = useState<Record<string, string>>(lastAnswer?.placements || {});
  const [checked, setChecked] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [animateResult, setAnimateResult] = useState(false);
  
  const { playCorrectSound, playIncorrectSound } = useSoundEffects();

  // Sync state with props when lesson changes
  useEffect(() => {
    setChecked(isCompleted);
    setPlacements(lastAnswer?.placements || {});
    setAnimateResult(false);
  }, [isCompleted, lastAnswer?.placements, instruction]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over) {
      setPlacements({
        ...placements,
        [active.id as string]: over.id as string,
      });
      setChecked(false);
    }
  };

  const handleCheck = () => {
    setChecked(true);
    setAnimateResult(true);
    
    const allCorrect = normalizedItems.every((item) => {
      const target = normalizedTargets.find((t) => t.id === placements[item.id]);
      const acceptList = target?.acceptsItems ?? [];
      return acceptList.includes(item.id);
    });

    // Play sound effect and show confetti
    if (allCorrect) {
      playCorrectSound();
      setShowConfetti(true);
    } else {
      playIncorrectSound();
    }
    
    // Reset animation state after animation completes
    setTimeout(() => setAnimateResult(false), 500);

    // Log quiz answer data
    if (onQuizAnswer) {
      onQuizAnswer({
        questionText: promptInstruction,
        placements,
        isCorrect: allCorrect,
        items: normalizedItems.map(item => ({ id: item.id, content: item.content })),
        targets: normalizedTargets.map(target => ({ id: target.id, label: target.label })),
      });
    }

    if (onComplete) {
      onComplete(allCorrect);
    }
  };

  const getItemsInTarget = (targetId: string) => {
    return normalizedItems.filter((item) => placements[item.id] === targetId);
  };

  const unplacedItems = normalizedItems.filter((item) => !placements[item.id]);

  const activeItem = normalizedItems.find((item) => item.id === activeId);
  
  // Calculate if all answers are correct for styling
  const allCorrect = checked && normalizedItems.every((item) => {
    const target = normalizedTargets.find((t) => t.id === placements[item.id]);
    const acceptList = target?.acceptsItems ?? [];
    return acceptList.includes(item.id);
  });

  return (
    <>
      {/* Confetti celebration for correct answers */}
      <ConfettiCelebration 
        show={showConfetti} 
        onComplete={() => setShowConfetti(false)}
        duration={3000}
      />
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Drag and Drop</CardTitle>
          <p className="text-sm text-muted-foreground">{promptInstruction}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* Drop Targets */}
            <div className="space-y-4">
              {normalizedTargets.map((target) => (
                <DropZone
                  key={target.id}
                  id={target.id}
                  label={target.label}
                  checked={checked}
                  items={getItemsInTarget(target.id)}
                  acceptsItems={target.acceptsItems ?? []}
                />
              ))}
            </div>

            {/* Unplaced Items */}
            {unplacedItems.length > 0 && (
              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-3">Available items:</p>
                <div className="flex flex-wrap gap-2">
                  {unplacedItems.map((item) => (
                    <DraggableItem key={item.id} id={item.id} content={item.content} />
                  ))}
                </div>
              </div>
            )}

            <DragOverlay>
              {activeItem ? (
                <div className="px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg cursor-grabbing">
                  {activeItem.content}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {!checked && normalizedItems.length > 0 && normalizedItems.every((item) => placements[item.id]) && (
            <Button onClick={handleCheck} className="w-full">
              Check Answers
            </Button>
          )}

          {checked && (
            <div
              className={cn(
                'p-4 rounded-lg border-2',
                allCorrect
                  ? 'bg-green-50 dark:bg-green-950 border-green-500'
                  : 'bg-red-50 dark:bg-red-950 border-red-500',
                animateResult && allCorrect && 'animate-correct-pulse',
                animateResult && !allCorrect && 'animate-incorrect-shake'
              )}
            >
              <div className="flex items-start gap-2">
                {allCorrect ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <p className="font-semibold text-green-700 dark:text-green-300">🎉 {normalizedFeedback.correct}</p>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <p className="font-semibold text-red-700 dark:text-red-300">{normalizedFeedback.incorrect}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function DraggableItem({ id, content }: { id: string; content: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`px-4 py-2 bg-primary/10 border border-primary rounded-lg cursor-grab active:cursor-grabbing flex items-center gap-2 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      {content}
    </div>
  );
}

function DropZone({
  id,
  label,
  items,
  acceptsItems,
  checked,
}: {
  id: string;
  label: string;
  items: Array<{ id: string; content: string }>;
  acceptsItems: string[];
  checked: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const isCorrect = checked && items.every(item => acceptsItems.includes(item.id));
  const hasIncorrect = checked && items.some(item => !acceptsItems.includes(item.id));

  return (
    <div
      ref={setNodeRef}
      className={`border-2 rounded-lg p-4 min-h-[100px] transition-colors ${
        isOver
          ? 'border-primary bg-primary/5'
          : checked
          ? isCorrect && items.length > 0
            ? 'border-green-500 bg-green-50 dark:bg-green-950'
            : hasIncorrect
            ? 'border-red-500 bg-red-50 dark:bg-red-950'
            : 'border-border'
          : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium">{label}</p>
        {checked && items.length > 0 && (
          isCorrect ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : hasIncorrect ? (
            <XCircle className="h-5 w-5 text-red-500" />
          ) : null
        )}
      </div>
      
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <DraggableItem key={item.id} id={item.id} content={item.content} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">Drop items here</p>
      )}
    </div>
  );
}
