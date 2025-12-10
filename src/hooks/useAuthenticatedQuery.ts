/**
 * Tanstack Query (React Query) Integration with Clerk Authentication
 * 
 * Provides hooks for authenticated queries using Tanstack Query.
 * Implements Clerk security best practices for request authentication.
 * 
 * SECURITY NOTE: These helpers are intended ONLY for same-origin backend routes
 * (e.g., /api/...). Do NOT use with absolute third-party URLs as this would
 * leak authentication tokens to external services.
 * 
 * NOTE: These hooks require @tanstack/react-query to be installed.
 * Install with: npm install @tanstack/react-query
 * 
 * @see https://clerk.com/docs/guides/development/making-requests
 * @see https://tanstack.com/query/latest/docs/react/overview
 */

import { useAuth as useClerkAuth } from "@clerk/nextjs";

/**
 * Create an authenticated query function for Tanstack Query
 * 
 * The native Fetch API doesn't throw errors for non-200 responses,
 * so this includes explicit error handling required by Tanstack Query.
 * 
 * @param url - The API endpoint URL (must be a same-origin relative path like /api/...)
 * @param options - Additional fetch options
 * @returns Query function compatible with Tanstack Query
 * 
 * @example
 * ```tsx
 * interface FooResponse {
 *   id: string;
 *   name: string;
 * }
 * 
 * function MyComponent() {
 *   const queryFn = useAuthenticatedQueryFn<FooResponse>('/api/foo');
 *   const { data, isLoading, error } = useQuery({
 *     queryKey: ['foo'],
 *     queryFn,
 *   });
 * }
 * ```
 */
export function useAuthenticatedQueryFn<T>(
  url: string,
  options?: Omit<RequestInit, "method">
) {
  const { getToken } = useClerkAuth();

  return async (): Promise<T> => {
    // Get the session token
    const token = await getToken();

    // Build headers - only include Authorization if token exists
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options?.headers,
    };
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    // Make the request with the token
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Include status code and status text in error message
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    // Handle empty responses (e.g., 204 No Content) and non-JSON responses
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {} as T;
    }

    const data = await response.json();
    return data as T;
  };
}

/**
 * Hook for authenticated queries with Tanstack Query
 * 
 * Combines query function creation with useQuery for a simplified API.
 * 
 * IMPORTANT: This hook requires @tanstack/react-query to be installed.
 * This is a helper function that creates the query function.
 * Use it with your own useQuery from @tanstack/react-query.
 * 
 * @param url - The API endpoint URL
 * @param options - Additional fetch options
 * @returns Query function to use with useQuery
 * 
 * @example
 * ```tsx
 * import { useQuery } from '@tanstack/react-query';
 * 
 * interface User {
 *   id: string;
 *   name: string;
 * }
 * 
 * function UserProfile() {
 *   const queryFn = useAuthenticatedQueryFn<User>('/api/user/profile');
 *   
 *   const { data, isLoading, error } = useQuery({
 *     queryKey: ['user', 'profile'],
 *     queryFn,
 *     staleTime: 5 * 60 * 1000, // 5 minutes
 *     retry: 2,
 *   });
 * 
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   return <div>Hello, {data.name}!</div>;
 * }
 * ```
 */
// Note: useAuthenticatedQueryFn above provides the query function.
// Import useQuery from @tanstack/react-query and use it with the query function.

/**
 * Create an authenticated mutation function for Tanstack Query
 * 
 * @param url - The API endpoint URL
 * @param method - HTTP method (POST, PUT, PATCH, DELETE)
 * @param options - Additional fetch options
 * @returns Mutation function compatible with Tanstack Query
 * 
 * @example
 * ```tsx
 * import { useMutation } from '@tanstack/react-query';
 * 
 * interface CreateUserInput {
 *   name: string;
 *   email: string;
 * }
 * 
 * interface User {
 *   id: string;
 *   name: string;
 *   email: string;
 * }
 * 
 * function CreateUserForm() {
 *   const mutationFn = useAuthenticatedMutationFn<User, CreateUserInput>(
 *     '/api/users',
 *     'POST'
 *   );
 * 
 *   const mutation = useMutation({
 *     mutationFn,
 *     onSuccess: (data) => {
 *       console.log('User created:', data);
 *     },
 *   });
 * 
 *   const handleSubmit = (input: CreateUserInput) => {
 *     mutation.mutate(input);
 *   };
 * }
 * ```
 */
export function useAuthenticatedMutationFn<TData, TVariables = unknown>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST",
  options?: Omit<RequestInit, "method" | "body">
) {
  const { getToken } = useClerkAuth();

  return async (variables: TVariables): Promise<TData> => {
    // Get the session token
    const token = await getToken();

    // Make the request with the token
    const response = await fetch(url, {
      ...options,
      method,
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: JSON.stringify(variables),
    });

    if (!response.ok) {
      // Include status code and status text in error message
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Handle empty responses (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {} as TData;
    }

    const data = await response.json();
    return data as TData;
  };
}
