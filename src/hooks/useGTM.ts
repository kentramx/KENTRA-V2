import { useCallback } from 'react';
import { monitoring } from '@/lib/monitoring';

// Extend Window interface for GTM dataLayer
declare global {
  interface Window {
    dataLayer?: any[];
  }
}

// Inicializar dataLayer si no existe
if (typeof window !== 'undefined' && !window.dataLayer) {
  window.dataLayer = [];
}

export type GTMEvent = 
  // Facebook Pixel events
  | 'CompleteRegistration'
  | 'Contact'
  | 'Lead'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'ViewContent'
  // Google Analytics 4 events
  | 'sign_up'
  | 'generate_lead'
  | 'begin_checkout'
  | 'purchase'
  | 'view_item'
  | 'view_item_list'
  | 'select_item'
  | 'add_to_wishlist'
  | 'remove_from_wishlist'
  | 'search'
  | 'view_promotion'
  // Custom events
  | 'page_view';

interface GTMEventData {
  event: GTMEvent;
  [key: string]: any;
}

export const useGTM = () => {
  // Push evento a dataLayer de GTM
  const pushToDataLayer = useCallback((eventData: GTMEventData) => {
    if (typeof window !== 'undefined' && window.dataLayer) {
      try {
        window.dataLayer.push(eventData);
        console.log('GTM dataLayer push:', eventData);
      } catch (error) {
        monitoring.debug('Error pushing to GTM dataLayer', { eventData, error });
      }
    } else {
      console.warn('GTM dataLayer no está disponible');
    }
  }, []);

  // Trackear evento genérico
  const trackEvent = useCallback(
    (eventName: GTMEvent, parameters?: Record<string, any>) => {
      pushToDataLayer({
        event: eventName,
        ...parameters,
        timestamp: new Date().toISOString(),
      });
    },
    [pushToDataLayer]
  );

  // Trackear pageview
  const trackPageView = useCallback(
    (page_path: string, page_title?: string) => {
      pushToDataLayer({
        event: 'page_view',
        page_path,
        page_title: page_title || (typeof document !== 'undefined' ? document.title : ''),
        page_location: typeof window !== 'undefined' ? window.location.href : '',
      });
    },
    [pushToDataLayer]
  );

  // Trackear evento de comercio electrónico
  const trackEcommerceEvent = useCallback(
    (eventName: GTMEvent, ecommerce: Record<string, any>) => {
      pushToDataLayer({
        event: eventName,
        ecommerce,
        timestamp: new Date().toISOString(),
      });
    },
    [pushToDataLayer]
  );

  return {
    trackEvent,
    trackPageView,
    trackEcommerceEvent,
    pushToDataLayer,
  };
};
