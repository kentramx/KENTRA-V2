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

// Generar o recuperar session_id para tracking anónimo
const getSessionId = (): string => {
  const key = 'whatsapp_session_id';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
};

export const trackWhatsAppInteraction = async ({
  agentId,
  propertyId,
  interactionType,
}: TrackWhatsAppParams) => {
  try {
    // Intentar obtener usuario autenticado (puede ser null)
    const { data: { user } } = await supabase.auth.getUser();
    
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

    // Guardar en base de datos (funciona para usuarios autenticados y anónimos)
    const sessionId = getSessionId();
    
    const { error } = await supabase
      .from('whatsapp_interactions')
      .insert({
        user_id: user?.id || null, // NULL para usuarios anónimos
        agent_id: agentId,
        property_id: propertyId || null,
        interaction_type: interactionType,
        session_id: sessionId, // Para identificar sesiones anónimas
      });

    if (error) {
      monitoring.error('Error tracking WhatsApp interaction', { util: 'whatsappTracking', error });
    } else {
      monitoring.debug('WhatsApp interaction tracked', { 
        util: 'whatsappTracking', 
        userId: user?.id || 'anonymous',
        sessionId,
        interactionType 
      });
    }
  } catch (error) {
    monitoring.captureException(error as Error, { util: 'whatsappTracking' });
  }
};
