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

import { generateValidJson } from "@/lib/services/aimodel";
export const validateAndCorrectJson = async (jsonString: string): Promise<string> => {
  let currentJson = jsonString;
  for (let i = 0; i < 3; i++) {
    try {
      JSON.parse(currentJson);
      return currentJson;
    } catch (_e) {
      console.warn(`Attempt ${i + 1}: Invalid JSON detected. Attempting to correct...`);
      currentJson = await generateValidJson(currentJson);
    }
  }

  try {
    JSON.parse(currentJson);
    return currentJson;
  } catch (_e) {
    console.error("Failed to generate valid JSON after multiple attempts.", _e);
    throw new Error("Failed to process content due to invalid data format after multiple retries.");
  }
};


export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  retries = 5,
  initialDelay = 1000
): Promise<T> {
  let delay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn(); // Attempt the function
    } catch (error: unknown) {
      // Check if it's a rate limit or overload error (503 or 429)
      const errorMessage = typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
      const isRateLimitError = 
        errorMessage.includes('503') || 
        errorMessage.includes('UNAVAILABLE') || 
        errorMessage.includes('overloaded') ||
        errorMessage.includes('429');

      if (isRateLimitError && i < retries - 1) {
        console.warn(`Attempt ${i + 1} failed due to API overload. Retrying in ${delay}ms...`);
        // Wait for the delay
        await new Promise(res => setTimeout(res, delay));
        // Increase delay for next attempt (exponential backoff) with jitter
        delay = delay * 2 + Math.random() * 1000;
      } else {
        // If it's another type of error or the last retry, rethrow it
        throw error;
      }
    }
  }
  // This line should not be reachable if retries > 0, but is a safeguard.
  throw new Error("Function failed after all retries.");
}