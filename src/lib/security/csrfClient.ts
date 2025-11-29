/**
 * CSRF Client Utilities
 * 
 * Provides client-side helpers for reading CSRF tokens and adding them to requests.
 */

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Get CSRF token from cookies
 */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Create headers object with CSRF token
 */
export function getCsrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  if (!token) {
    return {};
  }
  return { [CSRF_HEADER_NAME]: token };
}

/**
 * Enhanced fetch that automatically includes CSRF token
 */
export async function csrfFetch(
  url: string | URL,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || "GET";
  
  // Only add CSRF token for state-changing requests
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      options.headers = {
        ...options.headers,
        [CSRF_HEADER_NAME]: csrfToken,
      };
    }
  }

  return fetch(url, options);
}

/**
 * Create a fetch wrapper for a specific base URL
 */
export function createCsrfFetch(baseUrl: string = "") {
  return async (
    path: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const url = baseUrl + path;
    return csrfFetch(url, options);
  };
}

/**
 * Helper to make JSON POST requests with CSRF protection
 */
export async function csrfPost<T = unknown>(
  url: string,
  data: unknown
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const response = await csrfFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: json.error || json.message || "Request failed",
      };
    }

    return {
      ok: true,
      status: response.status,
      data: json as T,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
