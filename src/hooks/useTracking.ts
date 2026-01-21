import { useFacebookPixel, FacebookPixelEvent } from './useFacebookPixel';
import { useGoogleAnalytics, GoogleAnalyticsEvent } from './useGoogleAnalytics';
import { useGTM, GTMEvent } from './useGTM';
import { monitoring } from '@/lib/monitoring';

interface TrackingParameters {
  content_name?: string;
  content_category?: string;
  event_label?: string;
  event_category?: string;
  value?: number;
  currency?: string;
  item_id?: string;
  item_name?: string;
  items?: Record<string, unknown>[];
  search_term?: string;
  promotion_id?: string;
  promotion_name?: string;
  [key: string]: unknown;
}

export const useTracking = () => {
  const { trackEvent: trackFBEvent } = useFacebookPixel();
  const { trackEvent: trackGAEvent, trackPageView, trackGA4Only } = useGoogleAnalytics();
  const { trackEvent: trackGTMEvent, trackPageView: trackGTMPageView } = useGTM();

  const trackEvent = async (
    eventName: FacebookPixelEvent,
    parameters?: TrackingParameters
  ) => {
    // Trackear mediante GTM (centralizado)
    trackGTMEvent(eventName as GTMEvent, parameters);

    // SECURITY: Use Promise.allSettled to prevent single tracker failure from breaking others
    // Each tracker logs its own errors independently
    const results = await Promise.allSettled([
      trackFBEvent(eventName, parameters),
      trackGAEvent(eventName, parameters),
    ]);

    // Log any failures for debugging (non-blocking)
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const tracker = index === 0 ? 'Facebook Pixel' : 'Google Analytics';
        monitoring.warn(`${tracker} tracking failed`, {
          hook: 'useTracking',
          eventName,
          error: result.reason,
        });
      }
    });
  };

  // Trackear pageview mediante GTM
  const trackPageViewUnified = (page_path: string, page_title?: string) => {
    trackGTMPageView(page_path, page_title);
    trackPageView(page_path, page_title);
  };

  // Trackear solo en GA4 (eventos específicos de GA4)
  const trackGA4Event = (
    eventName: GoogleAnalyticsEvent,
    parameters?: TrackingParameters
  ) => {
    // Enviar a GTM primero
    trackGTMEvent(eventName as GTMEvent, parameters);
    // También trackear directamente
    trackGA4Only(eventName, parameters);
  };

  return {
    trackEvent,
    trackPageView: trackPageViewUnified,
    trackGA4Event,
  };
};
