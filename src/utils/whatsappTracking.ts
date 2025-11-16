import { supabase } from "@/integrations/supabase/client";
import { monitoring } from '@/lib/monitoring';

export type WhatsAppInteractionType = 'contact_agent' | 'share_property';

interface TrackWhatsAppParams {
  agentId: string;
  propertyId?: string;
  interactionType: WhatsAppInteractionType;
}

// Declare global tracking functions
declare global {
  interface Window {
    fbq?: (
      command: string,
      eventName: string,
      parameters?: Record<string, any>
    ) => void;
    gtag?: (
      command: string,
      ...args: any[]
    ) => void;
  }
}

export const trackWhatsAppInteraction = async ({
  agentId,
  propertyId,
  interactionType,
}: TrackWhatsAppParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      monitoring.debug('Usuario no autenticado, no se registra interacción', { util: 'whatsappTracking' });
      return;
    }

    const eventParams = {
      content_name: interactionType === 'contact_agent' ? 'Contacto WhatsApp Agente' : 'Compartir Propiedad WhatsApp',
      content_category: 'whatsapp_interaction',
      content_ids: propertyId ? [propertyId] : [],
    };

    // Track Facebook Pixel: Contact via WhatsApp
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'Contact', eventParams);
    }

    // Track Google Analytics 4: generate_lead
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'generate_lead', {
        event_category: eventParams.content_category,
        event_label: eventParams.content_name,
      });
    }

    const { error } = await supabase
      .from('whatsapp_interactions')
      .insert({
        user_id: user.id,
        agent_id: agentId,
        property_id: propertyId || null,
        interaction_type: interactionType,
      });

    if (error) {
      monitoring.error('Error tracking WhatsApp interaction', { util: 'whatsappTracking', error });
    }
  } catch (error) {
    monitoring.captureException(error as Error, { util: 'whatsappTracking' });
  }
};
