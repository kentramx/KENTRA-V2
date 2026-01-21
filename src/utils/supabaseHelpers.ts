/**
 * Supabase helper utilities for enhanced functionality
 */
import { supabase } from '@/integrations/supabase/client';
import type { FunctionsResponse } from '@supabase/supabase-js';

export interface InvokeFunctionOptions {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number; // Default: 30000ms (30 seconds)
}

/**
 * SECURITY: Invoke a Supabase Edge Function with timeout protection
 * Prevents indefinite hanging if function doesn't respond
 */
export async function invokeWithTimeout<T = unknown>(
  functionName: string,
  options: InvokeFunctionOptions = {}
): Promise<FunctionsResponse<T>> {
  const { timeout = 30000, ...invokeOptions } = options;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const result = await Promise.race([
      supabase.functions.invoke<T>(functionName, {
        ...invokeOptions,
      }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(`Function "${functionName}" timed out after ${timeout}ms`));
        });
      }),
    ]);

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Invoke function with automatic retry for transient failures
 */
export async function invokeWithRetry<T = unknown>(
  functionName: string,
  options: InvokeFunctionOptions & { maxRetries?: number } = {}
): Promise<FunctionsResponse<T>> {
  const { maxRetries = 2, ...invokeOptions } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await invokeWithTimeout<T>(functionName, invokeOptions);

      // If there's an error in the response but not a network error, don't retry
      if (result.error && result.error.message?.includes('timed out')) {
        throw new Error(result.error.message);
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      // Only retry on timeout or network errors
      if (attempt < maxRetries && error instanceof Error) {
        const isRetryable =
          error.message.includes('timed out') ||
          error.message.includes('network') ||
          error.message.includes('fetch');

        if (isRetryable) {
          // Exponential backoff: 1s, 2s, 4s...
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError;
}
