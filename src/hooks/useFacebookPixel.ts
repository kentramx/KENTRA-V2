import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { monitoring } from '@/lib/monitoring';

declare global {
  interface Window {
    fbq?: (
      command: string,
      eventName: string,
      parameters?: Record<string, unknown>
    ) => void;
  }
}

export type FacebookPixelEvent =
  | 'CompleteRegistration'
  | 'Contact'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'Lead'
  | 'ViewContent';

interface EventParameters {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
  [key: string]: unknown;
}

interface QueuedEvent {
  event_type: string;
  event_source: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  content_name: string | null;
  content_category: string | null;
  value: number | null;
  currency: string;
  metadata: Record<string, unknown>;
  session_id: string;
  referrer: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================================================
// EVENT BATCHING SYSTEM
// ============================================================================

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;

let eventQueue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
let cachedUser: { id: string; email: string | null; role: string | null } | null = null;

// Generar o recuperar session_id usando UUID
const getSessionId = (): string => {
  if (typeof window === 'undefined') return 'server';

  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    sessionId = `${timestamp}-${random}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

// Cache user data to avoid repeated queries
const getCachedUser = async () => {
  if (cachedUser !== null) return cachedUser;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      cachedUser = { id: '', email: null, role: null };
      return cachedUser;
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    cachedUser = {
      id: user.id,
      email: user.email || null,
      role: roleData?.role || null,
    };

    return cachedUser;
  } catch {
    cachedUser = { id: '', email: null, role: null };
    return cachedUser;
  }
};

// Clear user cache on auth change
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange(() => {
    cachedUser = null;
  });
}

// Flush events to database
const flushEvents = async (sync = false): Promise<void> => {
  if (isFlushing || eventQueue.length === 0) return;

  isFlushing = true;
  const eventsToFlush = [...eventQueue];
  eventQueue = [];

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  try {
    if (sync && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      // Use sendBeacon for page unload (non-blocking)
      const payload = JSON.stringify(eventsToFlush);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/conversion_events`;
      const headers = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal',
      };

      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      const { error } = await supabase.from('conversion_events').insert(eventsToFlush as QueuedEvent[]);

      if (error) {
        eventQueue = [...eventsToFlush, ...eventQueue];
        monitoring.warn('Failed to flush analytics events', { count: eventsToFlush.length, error });
      }
    }
  } catch (error) {
    eventQueue = [...eventsToFlush, ...eventQueue];
    monitoring.warn('Error flushing analytics events', { error });
  } finally {
    isFlushing = false;
  }
};

// Register flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushEvents(true));
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushEvents(true);
    }
  });
}

// Queue event for batching
const queueEvent = async (
  eventName: FacebookPixelEvent,
  parameters?: EventParameters
): Promise<void> => {
  const user = await getCachedUser();

  const event: QueuedEvent = {
    event_type: eventName,
    event_source: 'facebook_pixel',
    user_id: user.id || null,
    user_email: user.email,
    user_role: user.role,
    content_name: parameters?.content_name || null,
    content_category: parameters?.content_category || null,
    value: parameters?.value || null,
    currency: parameters?.currency || 'MXN',
    metadata: parameters || {},
    session_id: getSessionId(),
    referrer: typeof document !== 'undefined' ? document.referrer : null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    created_at: new Date().toISOString(),
  };

  eventQueue.push(event);

  // Flush if batch size reached
  if (eventQueue.length >= BATCH_SIZE) {
    flushEvents();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushEvents();
    }, FLUSH_INTERVAL_MS);
  }
};

export const useFacebookPixel = () => {
  // Flush pending events on unmount
  useEffect(() => {
    return () => {
      if (eventQueue.length > 0) {
        flushEvents();
      }
    };
  }, []);

  const trackEvent = useCallback(
    async (eventName: FacebookPixelEvent, parameters?: EventParameters) => {
      // 1. Trackear en Facebook Pixel (immediate)
      if (typeof window !== 'undefined' && window.fbq) {
        try {
          window.fbq('track', eventName, parameters);
        } catch (error) {
          monitoring.warn('Error tracking Facebook Pixel event', { eventName, error });
        }
      }

      // 2. Queue event for batched database insert
      queueEvent(eventName, parameters);
    },
    []
  );

  const trackCustomEvent = useCallback(
    (eventName: string, parameters?: EventParameters) => {
      if (typeof window !== 'undefined' && window.fbq) {
        try {
          window.fbq('trackCustom', eventName, parameters);
        } catch (error) {
          monitoring.warn('Error tracking Facebook Pixel custom event', { eventName, error });
        }
      }
    },
    []
  );

  return {
    trackEvent,
    trackCustomEvent,
  };
};
