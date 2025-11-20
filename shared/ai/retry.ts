export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  retries = 5,
  initialDelay = 1000
): Promise<T> {
  let delay = initialDelay;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const errorMessage =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "";
      const isRateLimitError =
        errorMessage.includes("503") ||
        errorMessage.includes("UNAVAILABLE") ||
        errorMessage.includes("overloaded") ||
        errorMessage.includes("429");

      if (isRateLimitError && attempt < retries - 1) {
        console.warn(
          `Attempt ${attempt + 1} failed due to API overload. Retrying in ${delay}ms...`
        );
        await new Promise((res) => setTimeout(res, delay));
        delay = delay * 2 + Math.random() * 1000;
        continue;
      }

      throw error;
    }
  }

  throw new Error("Function failed after all retries.");
}
