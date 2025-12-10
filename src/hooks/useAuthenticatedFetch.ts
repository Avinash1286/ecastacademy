import { useAuth as useClerkAuth } from "@clerk/nextjs";

/**
 * Authenticated Fetch Hook for Clerk
 * 
 * Provides utilities to make authenticated requests with Clerk session tokens.
 * Implements security best practices from Clerk documentation.
 * 
 * @see https://clerk.com/docs/guides/development/making-requests
 */

/**
 * Hook to create an authenticated fetch function
 * 
 * For same-origin requests, the session token is automatically passed in cookies.
 * For cross-origin requests or when a tab loses focus, the session token must be
 * explicitly passed as a Bearer token in the Authorization header.
 * 
 * @returns An authenticated fetch function that includes the session token
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const authenticatedFetch = useAuthenticatedFetch();
 *   
 *   const fetchData = async () => {
 *     const data = await authenticatedFetch('/api/foo');
 *     return data;
 *   };
 * }
 * ```
 */
function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function useAuthenticatedFetch() {
  const { getToken } = useClerkAuth();

  const authenticatedFetch = async <T = unknown>(
    url: string | URL | Request,
    options?: RequestInit
  ): Promise<T> => {
    // Get the session token (Convex expects the "convex" Clerk JWT template)
    const token = await getToken({ template: "convex" });

    // Merge headers with Authorization Bearer token and CSRF token (for POST/PUT/PATCH/DELETE)
    const headers = new Headers(options?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // Add CSRF header when we have the cookie; avoid overriding if caller set it
    const csrf = headers.get("x-csrf-token") || readCsrfToken();
    if (csrf) {
      headers.set("x-csrf-token", csrf);
    }

    // Make the request with the token
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  };

  return authenticatedFetch;
}

/**
 * Hook for authenticated requests with full response control
 * 
 * Returns the raw Response object instead of automatically parsing JSON.
 * Useful when you need to handle different response types or custom error handling.
 * 
 * @returns An authenticated fetch function that returns the raw Response
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const authenticatedFetch = useAuthenticatedFetchRaw();
 *   
 *   const downloadFile = async () => {
 *     const response = await authenticatedFetch('/api/download');
 *     const blob = await response.blob();
 *     // Handle blob...
 *   };
 * }
 * ```
 */
export function useAuthenticatedFetchRaw() {
  const { getToken } = useClerkAuth();

  const authenticatedFetch = async (
    url: string | URL | Request,
    options?: RequestInit
  ): Promise<Response> => {
    // Get the session token (Convex expects the "convex" Clerk JWT template)
    const token = await getToken({ template: "convex" });

    // Merge headers with Authorization Bearer token and CSRF token
    const headers = new Headers(options?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const csrf = headers.get("x-csrf-token") || readCsrfToken();
    if (csrf) {
      headers.set("x-csrf-token", csrf);
    }

    // Make the request with the token
    return fetch(url, {
      ...options,
      headers,
    });
  };

  return authenticatedFetch;
}

/**
 * Hook for creating an authenticated fetcher for SWR
 * 
 * @returns A fetcher function compatible with SWR
 * 
 * @example
 * ```tsx
 * import useSWR from 'swr';
 * 
 * function MyComponent() {
 *   const fetcher = useAuthenticatedSWRFetcher();
 *   const { data, error } = useSWR('/api/foo', fetcher);
 *   
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!data) return <div>Loading...</div>;
 *   return <div>{data.name}</div>;
 * }
 * ```
 */
export function useAuthenticatedSWRFetcher<T = unknown>() {
  const { getToken } = useClerkAuth();

  const fetcher = async (url: string): Promise<T> => {
    // Get the session token
    const token = await getToken();

    // Make the request with the token
    const response = await fetch(url, {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  };

  return fetcher;
}
