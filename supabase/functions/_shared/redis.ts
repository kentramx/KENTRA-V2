/**
 * Cliente de Upstash Redis
 * Cache distribuido y rate limiting
 */

interface RedisResponse<T = unknown> {
  result: T;
  error?: string;
}

class RedisClient {
  private url: string;
  private token: string;

  constructor() {
    const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
    const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

    if (!url || !token) {
      throw new Error('UPSTASH_REDIS credentials not configured');
    }

    this.url = url;
    this.token = token;
  }

  /**
   * Ejecutar comando Redis
   */
  private async execute<T = unknown>(command: string[]): Promise<T | null> {
    try {
      const response = await fetch(`${this.url}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        console.error('[Redis] Error:', await response.text());
        return null;
      }

      const data: RedisResponse<T> = await response.json();
      
      if (data.error) {
        console.error('[Redis] Command error:', data.error);
        return null;
      }

      return data.result;
    } catch (error) {
      console.error('[Redis] Network error:', error);
      return null;
    }
  }

  /**
   * GET - Obtener valor
   */
  async get<T = string>(key: string): Promise<T | null> {
    const result = await this.execute<string>(['GET', key]);
    
    if (!result) return null;

    // Intentar parsear JSON
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as T;
    }
  }

  /**
   * SET - Guardar valor
   */
  async set(key: string, value: unknown, expirationSeconds?: number): Promise<boolean> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    const command = expirationSeconds
      ? ['SET', key, stringValue, 'EX', expirationSeconds.toString()]
      : ['SET', key, stringValue];

    const result = await this.execute<string>(command);
    return result === 'OK';
  }

  /**
   * SETEX - Guardar con expiración
   */
  async setex(key: string, seconds: number, value: unknown): Promise<boolean> {
    return this.set(key, value, seconds);
  }

  /**
   * DEL - Eliminar clave(s)
   */
  async del(...keys: string[]): Promise<number> {
    const result = await this.execute<number>(['DEL', ...keys]);
    return result ?? 0;
  }

  /**
   * EXISTS - Verificar existencia
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.execute<number>(['EXISTS', key]);
    return result === 1;
  }

  /**
   * INCR - Incrementar contador
   */
  async incr(key: string): Promise<number> {
    const result = await this.execute<number>(['INCR', key]);
    return result ?? 0;
  }

  /**
   * EXPIRE - Establecer expiración
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.execute<number>(['EXPIRE', key, seconds.toString()]);
    return result === 1;
  }

  /**
   * TTL - Tiempo restante de expiración
   */
  async ttl(key: string): Promise<number> {
    const result = await this.execute<number>(['TTL', key]);
    return result ?? -1;
  }

  /**
   * HSET - Hash set
   */
  async hset(key: string, field: string, value: unknown): Promise<boolean> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const result = await this.execute<number>(['HSET', key, field, stringValue]);
    return result === 1;
  }

  /**
   * HGET - Hash get
   */
  async hget<T = string>(key: string, field: string): Promise<T | null> {
    const result = await this.execute<string>(['HGET', key, field]);
    
    if (!result) return null;

    try {
      return JSON.parse(result) as T;
    } catch {
      return result as T;
    }
  }

  /**
   * HINCRBY - Incrementar hash field
   */
  async hincrby(key: string, field: string, increment: number): Promise<number> {
    const result = await this.execute<number>(['HINCRBY', key, field, increment.toString()]);
    return result ?? 0;
  }

  /**
   * HGETALL - Obtener todo el hash
   */
  async hgetall<T = Record<string, string>>(key: string): Promise<T | null> {
    const result = await this.execute<string[]>(['HGETALL', key]);
    
    if (!result || result.length === 0) return null;

    // Convertir array [key, value, key, value] a objeto
    const obj: Record<string, string> = {};
    for (let i = 0; i < result.length; i += 2) {
      obj[result[i]] = result[i + 1];
    }

    return obj as T;
  }

  /**
   * ZADD - Agregar a sorted set
   */
  async zadd(key: string, score: number, member: string): Promise<boolean> {
    const result = await this.execute<number>(['ZADD', key, score.toString(), member]);
    return result !== null;
  }

  /**
   * ZRANGE - Obtener rango de sorted set
   */
  async zrange(key: string, start: number, stop: number, withScores = false): Promise<string[]> {
    const command = withScores
      ? ['ZRANGE', key, start.toString(), stop.toString(), 'WITHSCORES']
      : ['ZRANGE', key, start.toString(), stop.toString()];
    
    const result = await this.execute<string[]>(command);
    return result ?? [];
  }

  /**
   * ZREVRANGE - Obtener rango inverso (mayor a menor)
   */
  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    const result = await this.execute<string[]>(['ZREVRANGE', key, start.toString(), stop.toString()]);
    return result ?? [];
  }
}

// Singleton
let redisInstance: RedisClient | null = null;

export const getRedis = (): RedisClient => {
  if (!redisInstance) {
    redisInstance = new RedisClient();
  }
  return redisInstance;
};

/**
 * Helper para cache con fallback
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const redis = getRedis();

  // Intentar obtener de cache
  const cached = await redis.get<T>(key);
  if (cached !== null) {
    console.log(`[Cache HIT] ${key}`);
    return cached;
  }

  console.log(`[Cache MISS] ${key}`);

  // Ejecutar función y cachear resultado
  const result = await fetchFn();
  await redis.setex(key, ttlSeconds, result);

  return result;
}

/**
 * Rate limiting con sliding window
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedis();
  const key = `ratelimit:${identifier}`;

  try {
    const count = await redis.incr(key);

    // Primera request, establecer TTL
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);
    const resetAt = Date.now() + (ttl * 1000);

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  } catch (error) {
    console.error('[Rate Limit] Error:', error);
    // Fallar abierto: permitir request si Redis falla
    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + (windowSeconds * 1000),
    };
  }
}
