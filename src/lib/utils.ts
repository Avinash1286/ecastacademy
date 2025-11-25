import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeStringToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 2) { // MM:SS
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) { // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

export { validateAndCorrectJson } from "@shared/ai/structuredValidation";