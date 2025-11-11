import { supabase } from "@/integrations/supabase/client";

export type WhatsAppInteractionType = 'contact_agent' | 'share_property';

interface TrackWhatsAppParams {
  agentId: string;
  propertyId?: string;
  interactionType: WhatsAppInteractionType;
}

// Declare Facebook Pixel function
declare global {
  interface Window {
    fbq?: (
      command: string,
      eventName: string,
      parameters?: Record<string, any>
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
      console.log('Usuario no autenticado, no se registra interacción');
      return;
    }

    // Track Facebook Pixel: Contact via WhatsApp
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'Contact', {
        content_name: interactionType === 'contact_agent' ? 'Contacto WhatsApp Agente' : 'Compartir Propiedad WhatsApp',
        content_category: 'whatsapp_interaction',
        content_ids: propertyId ? [propertyId] : [],
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
      console.error('Error tracking WhatsApp interaction:', error);
    }
  } catch (error) {
    console.error('Error tracking WhatsApp interaction:', error);
  }
};
