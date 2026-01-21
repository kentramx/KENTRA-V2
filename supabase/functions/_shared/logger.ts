/**
 * Structured logging for Edge Functions
 * Outputs JSON for easy parsing by log aggregators
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  functionName: string;
  requestId?: string;
  userId?: string;
  subscriptionId?: string;
  stripeEventId?: string;
  stripeCustomerId?: string;
  action?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  function: string;
  message: string;
  context?: Partial<LogContext>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export function createLogger(functionName: string, baseContext: Partial<LogContext> = {}) {
  const requestId = crypto.randomUUID().slice(0, 8);
  
  const formatEntry = (
    level: LogLevel,
    message: string,
    context?: Partial<LogContext>,
    error?: Error
  ): LogEntry => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      function: functionName,
      message,
    };

    const mergedContext = { ...baseContext, ...context, requestId };
    if (Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  };

  const log = (level: LogLevel, message: string, context?: Partial<LogContext>, error?: Error) => {
    const entry = formatEntry(level, message, context, error);
    const json = JSON.stringify(entry);

    switch (level) {
      case 'ERROR':
        console.error(json);
        break;
      case 'WARN':
        console.warn(json);
        break;
      default:
        console.log(json);
    }
  };

  return {
    debug: (message: string, context?: Partial<LogContext>) => 
      log('DEBUG', message, context),
    
    info: (message: string, context?: Partial<LogContext>) => 
      log('INFO', message, context),
    
    warn: (message: string, context?: Partial<LogContext>, error?: Error) => 
      log('WARN', message, context, error),
    
    error: (message: string, context?: Partial<LogContext>, error?: Error) => 
      log('ERROR', message, context, error),
    
    // Convenience method for timing operations
    time: async <T>(
      operation: string,
      fn: () => Promise<T>,
      context?: Partial<LogContext>
    ): Promise<T> => {
      const start = performance.now();
      try {
        const result = await fn();
        const duration = Math.round(performance.now() - start);
        log('INFO', `${operation} completed`, { ...context, duration });
        return result;
      } catch (error) {
        const duration = Math.round(performance.now() - start);
        log('ERROR', `${operation} failed`, { ...context, duration }, error as Error);
        throw error;
      }
    },

    // Child logger with additional context
    child: (additionalContext: Partial<LogContext>) => 
      createLogger(functionName, { ...baseContext, ...additionalContext }),
  };
}
