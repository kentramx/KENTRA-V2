import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Mail, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTracking } from '@/hooks/useTracking';
import { useMonitoring } from '@/lib/monitoring';

interface ContactPropertyDialogProps {
  property: any;
  agentId: string;
}

const CONTACT_REASONS = [
  { value: "info", label: "Quiero más información sobre esta propiedad" },
  { value: "visit", label: "Me gustaría agendar una visita" },
  { value: "offer", label: "Quiero hacer una oferta" },
  { value: "exchange", label: "Tengo una propiedad para intercambiar" },
  { value: "financing", label: "Necesito información sobre financiamiento" },
  { value: "other", label: "Otro motivo" },
];

export const ContactPropertyDialog = ({
  property,
  agentId,
}: ContactPropertyDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trackEvent } = useTracking();
  const { error: logError, captureException } = useMonitoring();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("info");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!message.trim()) {
      toast.error("Por favor escribe un mensaje");
      return;
    }

    setSending(true);
    try {
      // Check for existing conversation
      const { data: existingConvo } = await supabase
        .from("conversations")
        .select("id")
        .eq("property_id", property.id)
        .eq("buyer_id", user.id)
        .eq("agent_id", agentId)
        .maybeSingle();

      let conversationId;

      if (existingConvo) {
        conversationId = existingConvo.id;
      } else {
        // Create new conversation
        const { data: newConvo, error: convoError } = await supabase
          .from("conversations")
          .insert({
            property_id: property.id,
            buyer_id: user.id,
            agent_id: agentId,
          })
          .select()
          .single();

        if (convoError) throw convoError;
        conversationId = newConvo.id;
      }

      // Send message
      const selectedReason = CONTACT_REASONS.find((r) => r.value === reason);
      const fullMessage = `${selectedReason?.label}\n\n${message}`;

      const { error: messageError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: fullMessage,
      });

      if (messageError) throw messageError;

      // Track Facebook Pixel: Contact
      trackEvent('Contact', {
        content_name: 'Contacto sobre Propiedad',
        content_category: 'property_inquiry',
        content_ids: [property.id],
      });

      toast.success("Mensaje enviado correctamente");
      setOpen(false);
      setMessage("");
      setReason("info");
      navigate(`/mensajes?conversation=${conversationId}`);
    } catch (error) {
      logError("Error sending message about property", {
        component: "ContactPropertyDialog",
        propertyId: property?.id,
        agentId,
        error,
      });
      captureException(error as Error, {
        component: "ContactPropertyDialog",
        action: "sendMessage",
        propertyId: property?.id,
      });
      toast.error("Error al enviar el mensaje");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Mail className="mr-2 h-4 w-4" />
          Contactar Agente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Contactar sobre esta propiedad</DialogTitle>
          <DialogDescription>
            Envía un mensaje al agente sobre {property.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>¿Qué te interesa?</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {CONTACT_REASONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label
                    htmlFor={option.value}
                    className="font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensaje adicional (opcional)</Label>
            <Textarea
              id="message"
              placeholder="Escribe aquí cualquier detalle adicional..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={sending}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending} className="flex-1">
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar Mensaje"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
