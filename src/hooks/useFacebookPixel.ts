import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { monitoring } from '@/lib/monitoring';

declare global {
  interface Window {
    fbq?: (
      command: string,
      eventName: string,
      parameters?: Record<string, any>
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
  [key: string]: any;
}

// Generar o recuperar session_id
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
};

// Guardar evento en la base de datos
const saveEventToDatabase = async (
  eventName: FacebookPixelEvent,
  parameters?: EventParameters
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Obtener rol del usuario si está autenticado
    let userRole = null;
    if (user) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      userRole = roleData?.role || null;
    }

    await supabase.from('conversion_events').insert({
      event_type: eventName,
      event_source: 'facebook_pixel',
      user_id: user?.id || null,
      user_email: user?.email || null,
      user_role: userRole,
      content_name: parameters?.content_name || null,
      content_category: parameters?.content_category || null,
      value: parameters?.value || null,
      currency: parameters?.currency || 'MXN',
      metadata: parameters || {},
      session_id: getSessionId(),
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch (error) {
    monitoring.warn('Error saving Facebook Pixel event to database', {
      eventName,
      error,
    });
  }
};

export const useFacebookPixel = () => {
  const trackEvent = useCallback(
    async (eventName: FacebookPixelEvent, parameters?: EventParameters) => {
      // 1. Trackear en Facebook Pixel
      if (typeof window !== 'undefined' && window.fbq) {
        try {
          window.fbq('track', eventName, parameters);
          console.log(`Facebook Pixel: ${eventName}`, parameters);
        } catch (error) {
          console.error('Error tracking Facebook Pixel event:', error);
        }
      } else {
        console.warn('Facebook Pixel no está disponible');
      }

      // 2. Guardar en la base de datos local
      await saveEventToDatabase(eventName, parameters);
    },
    []
  );

  const trackCustomEvent = useCallback(
    (eventName: string, parameters?: EventParameters) => {
      if (typeof window !== 'undefined' && window.fbq) {
        try {
          window.fbq('trackCustom', eventName, parameters);
          console.log(`Facebook Pixel Custom: ${eventName}`, parameters);
        } catch (error) {
          console.error('Error tracking Facebook Pixel custom event:', error);
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
