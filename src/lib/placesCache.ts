const CACHE_KEY = 'google_places_cache';
const CACHE_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutos

interface CacheEntry {
  query: string;
  result: any;
  timestamp: number;
}

interface PlacesCache {
  [key: string]: CacheEntry;
}

export const placesCache = {
  get(query: string): any | null {
    try {
      const cache = this.getCache();
      const normalizedQuery = query.toLowerCase().trim();
      const entry = cache[normalizedQuery];

      if (!entry) return null;

      // Verificar si expiró
      if (Date.now() - entry.timestamp > CACHE_EXPIRATION_MS) {
        delete cache[normalizedQuery];
        this.saveCache(cache);
        return null;
      }

      return entry.result;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  },

  set(query: string, result: any): void {
    try {
      const cache = this.getCache();
      const normalizedQuery = query.toLowerCase().trim();
      
      cache[normalizedQuery] = {
        query: normalizedQuery,
        result,
        timestamp: Date.now()
      };

      this.saveCache(cache);
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  },

  getCache(): PlacesCache {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return {};
      
      const cache = JSON.parse(cached) as PlacesCache;
      
      // Limpiar entradas expiradas automáticamente
      const now = Date.now();
      let hasExpired = false;
      
      Object.keys(cache).forEach(key => {
        if (now - cache[key].timestamp > CACHE_EXPIRATION_MS) {
          delete cache[key];
          hasExpired = true;
        }
      });

      if (hasExpired) {
        this.saveCache(cache);
      }

      return cache;
    } catch (error) {
      console.error('Error reading cache:', error);
      return {};
    }
  },

  saveCache(cache: PlacesCache): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving cache:', error);
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
};
