/**
 * Rate Limiter simple en memoria para edge functions
 * Para producción, usar Redis (Upstash)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpiar entradas expiradas cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Verificar si una petición está dentro del rate limit
   * @param key - Identificador único (IP, user ID, etc)
   * @param maxRequests - Número máximo de requests
   * @param windowMs - Ventana de tiempo en milisegundos
   * @returns {allowed: boolean, remaining: number, resetTime: number}
   */
  check(key: string, maxRequests: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const entry = this.limits.get(key);

    // Si no existe o expiró, crear nueva entrada
    if (!entry || now > entry.resetTime) {
      const resetTime = now + windowMs;
      this.limits.set(key, { count: 1, resetTime });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime,
      };
    }

    // Si está dentro del límite
    if (entry.count < maxRequests) {
      entry.count++;
      this.limits.set(key, entry);
      return {
        allowed: true,
        remaining: maxRequests - entry.count,
        resetTime: entry.resetTime,
      };
    }

    // Límite excedido
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Limpiar entradas expiradas
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Resetear límite para una key específica
   */
  reset(key: string) {
    this.limits.delete(key);
  }

  /**
   * Limpiar todo
   */
  clear() {
    this.limits.clear();
  }

  /**
   * Destruir el rate limiter
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Instancia singleton
export const rateLimiter = new RateLimiter();

/**
 * Configuraciones predefinidas de rate limiting
 */
export const rateLimitConfigs = {
  // Para búsquedas y queries (100 req/min)
  search: { maxRequests: 100, windowMs: 60 * 1000 },
  
  // Para crear propiedades (10 req/min)
  createProperty: { maxRequests: 10, windowMs: 60 * 1000 },
  
  // Para enviar mensajes (30 req/min)
  sendMessage: { maxRequests: 30, windowMs: 60 * 1000 },
  
  // Para autenticación (5 intentos/min)
  auth: { maxRequests: 5, windowMs: 60 * 1000 },
  
  // Para verificación de teléfono (3 req/hora)
  phoneVerification: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  
  // Para checkout (10 req/hora)
  checkout: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
  
  // Para operaciones generales (60 req/min)
  general: { maxRequests: 60, windowMs: 60 * 1000 },
};

/**
 * Helper para extraer IP del request
 */
export const getClientIdentifier = (req: Request): string => {
  // Intentar obtener IP real
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  
  return cfConnectingIp || realIp || forwarded?.split(',')[0] || 'unknown';
};

/**
 * Middleware helper para edge functions
 */
export const withRateLimit = (
  config: { maxRequests: number; windowMs: number },
  getKey?: (req: Request) => string
) => {
  return async (req: Request): Promise<Response | null> => {
    const key = getKey ? getKey(req) : getClientIdentifier(req);
    const result = rateLimiter.check(key, config.maxRequests, config.windowMs);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetTime.toString(),
          },
        }
      );
    }

    // Agregar headers informativos
    return null; // Continuar con la request
  };
};
