import { useCallback } from 'react';

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

export const useFacebookPixel = () => {
  const trackEvent = useCallback(
    (eventName: FacebookPixelEvent, parameters?: EventParameters) => {
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
