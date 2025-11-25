'use client';

import { useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  color: string;
  size: number;
  rotation: number;
  duration: number;
}

interface ConfettiCelebrationProps {
  /** Whether to show the celebration animation */
  show: boolean;
  /** Duration in milliseconds before auto-hiding. Default: 3000 */
  duration?: number;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Number of confetti pieces. Default: 50 */
  pieceCount?: number;
  /** Custom class name for the container */
  className?: string;
}

// Celebration colors - festive ribbons/confetti
const CONFETTI_COLORS = [
  '#ff6b6b', // Red
  '#4ecdc4', // Teal
  '#ffe66d', // Yellow
  '#95e1d3', // Mint
  '#f38181', // Coral
  '#aa96da', // Purple
  '#fcbad3', // Pink
  '#a8d8ea', // Light Blue
  '#ffd93d', // Gold
  '#6bcb77', // Green
];

/**
 * Confetti/Ribbon celebration animation component
 * Shows a shower of colorful confetti pieces falling from the top
 * 
 * @example
 * ```tsx
 * <ConfettiCelebration show={isCorrect} onComplete={() => setShowConfetti(false)} />
 * ```
 */
export function ConfettiCelebration({
  show,
  duration = 3000,
  onComplete,
  pieceCount = 50,
  className,
}: ConfettiCelebrationProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const generatePieces = useCallback(() => {
    const newPieces: ConfettiPiece[] = [];
    
    for (let i = 0; i < pieceCount; i++) {
      newPieces.push({
        id: i,
        x: Math.random() * 100, // Random horizontal position (0-100%)
        delay: Math.random() * 0.5, // Random delay (0-0.5s)
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: Math.random() * 8 + 6, // Random size (6-14px)
        rotation: Math.random() * 360, // Random initial rotation
        duration: Math.random() * 1 + 2, // Random fall duration (2-3s)
      });
    }
    
    return newPieces;
  }, [pieceCount]);

  useEffect(() => {
    if (show) {
      setPieces(generatePieces());
      setIsVisible(true);

      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, duration, onComplete, generatePieces]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 pointer-events-none z-50 overflow-hidden',
        className
      )}
      aria-hidden="true"
    >
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.x}%`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        >
          {/* Confetti piece - alternating between squares and ribbons */}
          {piece.id % 3 === 0 ? (
            // Ribbon shape
            <div
              className="animate-confetti-spin"
              style={{
                width: piece.size * 0.4,
                height: piece.size * 2,
                backgroundColor: piece.color,
                borderRadius: '2px',
                transform: `rotate(${piece.rotation}deg)`,
                animationDuration: `${piece.duration * 0.5}s`,
              }}
            />
          ) : piece.id % 3 === 1 ? (
            // Square shape
            <div
              className="animate-confetti-spin"
              style={{
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
                borderRadius: '2px',
                transform: `rotate(${piece.rotation}deg)`,
                animationDuration: `${piece.duration * 0.4}s`,
              }}
            />
          ) : (
            // Circle shape
            <div
              className="animate-confetti-spin"
              style={{
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
                borderRadius: '50%',
                transform: `rotate(${piece.rotation}deg)`,
                animationDuration: `${piece.duration * 0.6}s`,
              }}
            />
          )}
        </div>
      ))}
      
      {/* Celebratory burst effect in the center */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="animate-celebration-burst">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-burst-particle"
              style={{
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                transform: `rotate(${i * 45}deg) translateY(-30px)`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Success checkmark animation component
 * Shows an animated checkmark with a circular background
 */
export function SuccessAnimation({
  show,
  className,
}: {
  show: boolean;
  className?: string;
}) {
  if (!show) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center',
        className
      )}
    >
      <div className="relative">
        {/* Circle background */}
        <div className="w-16 h-16 rounded-full bg-green-500 animate-success-circle flex items-center justify-center">
          {/* Checkmark */}
          <svg
            className="w-8 h-8 text-white animate-success-check"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
              className="animate-draw-check"
            />
          </svg>
        </div>
        
        {/* Ring pulse effect */}
        <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping" />
      </div>
    </div>
  );
}
