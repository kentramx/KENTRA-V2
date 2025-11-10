import { supabase } from "@/integrations/supabase/client";

export type WhatsAppInteractionType = 'contact_agent' | 'share_property';

interface TrackWhatsAppParams {
  agentId: string;
  propertyId?: string;
  interactionType: WhatsAppInteractionType;
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
