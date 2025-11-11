import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    gtag?: (
      command: string,
      ...args: any[]
    ) => void;
    dataLayer?: any[];
  }
}

export type GoogleAnalyticsEvent = 
  | 'sign_up'           // Reemplazo de CompleteRegistration
  | 'generate_lead'     // Reemplazo de Contact/Lead
  | 'begin_checkout'    // Reemplazo de InitiateCheckout
  | 'purchase'          // Purchase
  | 'view_item';        // ViewContent

interface EventParameters {
  event_category?: string;
  event_label?: string;
  value?: number;
  currency?: string;
  transaction_id?: string;
  items?: any[];
  [key: string]: any;
}

// Mapeo de eventos de Facebook Pixel a GA4
const EVENT_MAPPING: Record<string, GoogleAnalyticsEvent> = {
  CompleteRegistration: 'sign_up',
  Contact: 'generate_lead',
  Lead: 'generate_lead',
  InitiateCheckout: 'begin_checkout',
  Purchase: 'purchase',
  ViewContent: 'view_item',
};

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
  eventName: GoogleAnalyticsEvent,
  originalEventName: string,
  parameters?: EventParameters
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
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
      event_type: originalEventName, // Guardar el nombre original (ej: CompleteRegistration)
      event_source: 'google_analytics',
      user_id: user?.id || null,
      user_email: user?.email || null,
      user_role: userRole,
      content_name: parameters?.event_label || null,
      content_category: parameters?.event_category || null,
      value: parameters?.value || null,
      currency: parameters?.currency || 'MXN',
      metadata: parameters || {},
      session_id: getSessionId(),
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch (error) {
    console.error('Error saving GA4 event to database:', error);
  }
};

export const useGoogleAnalytics = () => {
  // Trackear evento usando el nombre original de Facebook Pixel
  const trackEvent = useCallback(
    async (fbEventName: string, parameters?: EventParameters) => {
      const ga4EventName = EVENT_MAPPING[fbEventName as keyof typeof EVENT_MAPPING];
      
      if (!ga4EventName) {
        console.warn(`No GA4 mapping found for event: ${fbEventName}`);
        return;
      }

      // 1. Trackear en Google Analytics 4
      if (typeof window !== 'undefined' && window.gtag) {
        try {
          window.gtag('event', ga4EventName, parameters);
          console.log(`Google Analytics 4: ${ga4EventName} (original: ${fbEventName})`, parameters);
        } catch (error) {
          console.error('Error tracking GA4 event:', error);
        }
      } else {
        console.warn('Google Analytics 4 no está disponible');
      }

      // 2. Guardar en la base de datos local
      await saveEventToDatabase(ga4EventName, fbEventName, parameters);
    },
    []
  );

  // Trackear pageview
  const trackPageView = useCallback((page_path: string, page_title?: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_path,
        page_title: page_title || document.title,
      });
      console.log(`Google Analytics 4: page_view`, { page_path, page_title });
    }
  }, []);

  return {
    trackEvent,
    trackPageView,
  };
};
