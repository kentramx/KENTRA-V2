import { useFacebookPixel, FacebookPixelEvent } from './useFacebookPixel';
import { useGoogleAnalytics } from './useGoogleAnalytics';

interface TrackingParameters {
  content_name?: string;
  content_category?: string;
  event_label?: string;
  event_category?: string;
  value?: number;
  currency?: string;
  [key: string]: any;
}

export const useTracking = () => {
  const { trackEvent: trackFBEvent } = useFacebookPixel();
  const { trackEvent: trackGAEvent, trackPageView } = useGoogleAnalytics();

  const trackEvent = async (
    eventName: FacebookPixelEvent,
    parameters?: TrackingParameters
  ) => {
    // Trackear en ambas plataformas
    await Promise.all([
      trackFBEvent(eventName, parameters),
      trackGAEvent(eventName, parameters),
    ]);
  };

  return {
    trackEvent,
    trackPageView,
  };
};
