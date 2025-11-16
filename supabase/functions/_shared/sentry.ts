/**
 * Sentry para Edge Functions
 * Monitoreo de errores en backend
 */

interface SentryEvent {
  message?: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: any[];
      };
    }>;
  };
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  timestamp: number;
  platform: string;
  environment: string;
  server_name: string;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: {
    id?: string;
    email?: string;
  };
}

const SENTRY_DSN = Deno.env.get('SENTRY_DSN');
const ENVIRONMENT = Deno.env.get('DENO_REGION') ? 'production' : 'development';

/**
 * Capturar excepción en Sentry
 */
export async function captureException(
  error: Error,
  context?: {
    user?: { id: string; email?: string };
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
) {
  if (!SENTRY_DSN) {
    console.error('[Sentry] DSN no configurado, error no enviado:', error);
    return;
  }

  const event: SentryEvent = {
    exception: {
      values: [
        {
          type: error.name,
          value: error.message,
          stacktrace: error.stack
            ? {
                frames: parseStackTrace(error.stack),
              }
            : undefined,
        },
      ],
    },
    level: 'error',
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    environment: ENVIRONMENT,
    server_name: 'edge-function',
    tags: context?.tags,
    extra: context?.extra,
    user: context?.user,
  };

  await sendToSentry(event);
}

/**
 * Capturar mensaje en Sentry
 */
export async function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
) {
  if (!SENTRY_DSN) {
    console.log('[Sentry] DSN no configurado, mensaje no enviado:', message);
    return;
  }

  const event: SentryEvent = {
    message,
    level,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    environment: ENVIRONMENT,
    server_name: 'edge-function',
    tags: context?.tags,
    extra: context?.extra,
  };

  await sendToSentry(event);
}

/**
 * Enviar evento a Sentry
 */
async function sendToSentry(event: SentryEvent) {
  try {
    const projectId = extractProjectId(SENTRY_DSN!);
    const publicKey = extractPublicKey(SENTRY_DSN!);

    const url = `https://sentry.io/api/${projectId}/store/`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=kentra-edge/1.0`,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error('[Sentry] Error enviando evento:', await response.text());
    }
  } catch (err) {
    console.error('[Sentry] Error en sendToSentry:', err);
  }
}

/**
 * Extraer project ID del DSN
 */
function extractProjectId(dsn: string): string {
  const match = dsn.match(/\/\/([^@]+)@[^/]+\/(\d+)/);
  return match ? match[2] : '';
}

/**
 * Extraer public key del DSN
 */
function extractPublicKey(dsn: string): string {
  const match = dsn.match(/\/\/([^@]+)@/);
  return match ? match[1] : '';
}

/**
 * Parsear stack trace
 */
function parseStackTrace(stack: string): any[] {
  return stack
    .split('\n')
    .slice(1)
    .map((line) => {
      const match = line.match(/at (.+) \((.+):(\d+):(\d+)\)/);
      if (match) {
        return {
          function: match[1],
          filename: match[2],
          lineno: parseInt(match[3]),
          colno: parseInt(match[4]),
        };
      }
      return { function: line.trim() };
    });
}

/**
 * Wrapper para funciones edge con manejo de errores automático
 */
export function withSentry<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('[Edge Function Error]', error);
      
      await captureException(error as Error, {
        tags: {
          function: 'edge-function',
        },
        extra: {
          args: JSON.stringify(args).slice(0, 1000), // Limitar tamaño
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: (error as Error).message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }) as T;
}
