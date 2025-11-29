/**
 * Standardized API Response Utilities
 * 
 * Provides consistent response formats across all API endpoints.
 * Makes it easier to handle responses on the client and enables
 * better error tracking and debugging.
 */

import { NextResponse } from 'next/server';
import { generateRequestId } from '../logging/logger';

/**
 * Standard API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta: ApiMeta;
}

/**
 * Standard error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Response metadata
 */
export interface ApiMeta {
  requestId: string;
  timestamp: number;
  duration?: number;
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Rate Limiting
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  
  // Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Request Errors
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INVALID_CONTENT_TYPE: 'INVALID_CONTENT_TYPE',
  
  // CSRF
  CSRF_INVALID: 'CSRF_INVALID',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * HTTP status code mapping for error codes
 */
const errorStatusMap: Record<ErrorCode, number> = {
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.SESSION_EXPIRED]: 401,
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.INVALID_INPUT]: 400,
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.ALREADY_EXISTS]: 409,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.QUOTA_EXCEEDED]: 429,
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCodes.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCodes.INVALID_CONTENT_TYPE]: 415,
  [ErrorCodes.CSRF_INVALID]: 403,
};

/**
 * Context for building responses
 */
interface ResponseContext {
  requestId?: string;
  startTime?: number;
}

/**
 * Create a successful API response
 */
export function apiSuccess<T>(
  data: T,
  context: ResponseContext = {},
  status: number = 200
): NextResponse<ApiResponse<T>> {
  const requestId = context.requestId || generateRequestId();
  const timestamp = Date.now();
  const duration = context.startTime ? timestamp - context.startTime : undefined;
  
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      requestId,
      timestamp,
      duration,
    },
  };
  
  return NextResponse.json(response, {
    status,
    headers: {
      'X-Request-ID': requestId,
    },
  });
}

/**
 * Create an error API response
 */
export function apiError(
  code: ErrorCode,
  message: string,
  details?: unknown,
  context: ResponseContext = {}
): NextResponse<ApiResponse<never>> {
  const requestId = context.requestId || generateRequestId();
  const timestamp = Date.now();
  const duration = context.startTime ? timestamp - context.startTime : undefined;
  const status = errorStatusMap[code] || 500;
  
  const response: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      requestId,
      timestamp,
      duration,
    },
  };
  
  return NextResponse.json(response, {
    status,
    headers: {
      'X-Request-ID': requestId,
    },
  });
}

/**
 * Create common error responses
 */
export const errors = {
  unauthorized: (message = 'Authentication required', context?: ResponseContext) =>
    apiError(ErrorCodes.UNAUTHORIZED, message, undefined, context),
  
  forbidden: (message = 'You do not have permission to perform this action', context?: ResponseContext) =>
    apiError(ErrorCodes.FORBIDDEN, message, undefined, context),
  
  notFound: (resource = 'Resource', context?: ResponseContext) =>
    apiError(ErrorCodes.NOT_FOUND, `${resource} not found`, undefined, context),
  
  validationError: (message: string, details?: unknown, context?: ResponseContext) =>
    apiError(ErrorCodes.VALIDATION_ERROR, message, details, context),
  
  rateLimited: (retryAfter?: number, context?: ResponseContext) => {
    const response = apiError(
      ErrorCodes.RATE_LIMITED,
      'Too many requests. Please try again later.',
      { retryAfter },
      context
    );
    if (retryAfter) {
      response.headers.set('Retry-After', retryAfter.toString());
    }
    return response;
  },
  
  internalError: (message = 'An unexpected error occurred', context?: ResponseContext) =>
    apiError(ErrorCodes.INTERNAL_ERROR, message, undefined, context),
  
  serviceUnavailable: (message = 'Service temporarily unavailable', context?: ResponseContext) =>
    apiError(ErrorCodes.SERVICE_UNAVAILABLE, message, undefined, context),
};

/**
 * Wrap an async handler with standardized error handling
 */
export function withErrorHandling<T>(
  handler: (context: ResponseContext) => Promise<NextResponse<ApiResponse<T>>>
): () => Promise<NextResponse<ApiResponse<T | never>>> {
  return async () => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const context: ResponseContext = { requestId, startTime };
    
    try {
      return await handler(context);
    } catch (error) {
      console.error(`[API_ERROR] RequestID: ${requestId}`, error);
      
      if (error instanceof Error) {
        // Handle known error types
        if (error.message.includes('not found')) {
          return errors.notFound(undefined, context);
        }
        if (error.message.includes('Unauthorized') || error.message.includes('unauthorized')) {
          return errors.unauthorized(error.message, context);
        }
        if (error.message.includes('Forbidden') || error.message.includes('forbidden')) {
          return errors.forbidden(error.message, context);
        }
      }
      
      return errors.internalError(undefined, context);
    }
  };
}

/**
 * Extract request ID from headers or generate new one
 */
export function getRequestId(headers: Headers): string {
  return headers.get('X-Request-ID') || generateRequestId();
}
