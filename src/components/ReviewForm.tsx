import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Star, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { useMonitoring } from "@/lib/monitoring";

const reviewSchema = z.object({
  rating: z.number().min(1, "Debes seleccionar una calificación").max(5),
  comment: z.string().max(500, "El comentario no puede exceder 500 caracteres").optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  agentId: string;
  propertyId?: string;
  onReviewSubmitted?: () => void;
}

export const ReviewForm = ({ agentId, propertyId, onReviewSubmitted }: ReviewFormProps) => {
  const { user } = useAuth();
  const { warn, error: logError, captureException } = useMonitoring();
  const [open, setOpen] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [canReview, setCanReview] = useState<boolean | null>(null);
  const [hasExistingReview, setHasExistingReview] = useState(false);

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: "",
    },
  });

  useEffect(() => {
    if (user && agentId) {
      checkReviewEligibility();
    }
  }, [user, agentId]);

  const checkReviewEligibility = async () => {
    if (!user) return;

    try {
      // Verificar si ya existe una review
      const { data: existingReview } = await supabase
        .from('agent_reviews')
        .select('id')
        .eq('agent_id', agentId)
        .eq('buyer_id', user.id)
        .maybeSingle();

      if (existingReview) {
        setHasExistingReview(true);
        setCanReview(false);
        return;
      }

      // Verificar si existe conversación con el agente
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(buyer_id.eq.${user.id},agent_id.eq.${agentId}),and(agent_id.eq.${user.id},buyer_id.eq.${agentId})`)
        .maybeSingle();

      setCanReview(!!conversation);
    } catch (error) {
      warn('Error checking review eligibility', {
        component: 'ReviewForm',
        agentId,
        userId: user?.id,
        error,
      });
      setCanReview(false);
    }
  };

  const onSubmit = async (data: ReviewFormData) => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para dejar una reseña",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("agent_reviews").insert({
        agent_id: agentId,
        buyer_id: user.id,
        property_id: propertyId || null,
        rating: data.rating,
        comment: data.comment || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Error",
            description: "Ya has dejado una reseña para este agente",
            variant: "destructive",
          });
        } else if (error.message?.includes('row-level security')) {
          toast({
            title: "No permitido",
            description: "Solo puedes dejar reseñas de agentes con los que has interactuado",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "¡Reseña publicada!",
        description: "Tu reseña ha sido publicada exitosamente",
      });

      form.reset();
      setOpen(false);
      setHasExistingReview(true);
      onReviewSubmitted?.();
    } catch (error) {
      logError("Error submitting review", {
        component: "ReviewForm",
        agentId,
        propertyId,
        error,
      });
      captureException(error as Error, {
        component: "ReviewForm",
        action: "submitReview",
      });
      toast({
        title: "Error",
        description: "No se pudo publicar tu reseña. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => {
      const starValue = i + 1;
      const isActive = starValue <= (hoveredRating || rating);
      
      return (
        <button
          key={i}
          type="button"
          onClick={() => form.setValue("rating", starValue)}
          onMouseEnter={() => setHoveredRating(starValue)}
          onMouseLeave={() => setHoveredRating(0)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`w-8 h-8 ${
              isActive ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        </button>
      );
    });
  };

  if (!user) {
    return null;
  }

  // Mostrar estado de carga
  if (canReview === null) {
    return (
      <Button variant="outline" disabled>
        Verificando...
      </Button>
    );
  }

  // Usuario ya dejó review
  if (hasExistingReview) {
    return (
      <Button variant="outline" disabled>
        Ya dejaste una reseña
      </Button>
    );
  }

  // Usuario no puede dejar review
  if (!canReview) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="outline" disabled>
          Dejar Reseña
        </Button>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MessageCircle className="h-3 w-3" />
          Contacta al agente primero para poder dejarle una reseña
        </p>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Dejar Reseña</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Calificar Agente</DialogTitle>
          <DialogDescription>
            Comparte tu experiencia trabajando con este agente
          </DialogDescription>
        </DialogHeader>
        
        {/* Información sobre elegibilidad */}
        <Alert className="bg-blue-50 border-blue-200">
          <MessageCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            Solo puedes dejar reseñas de agentes con los que has interactuado previamente a través de mensajes en la plataforma.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calificación</FormLabel>
                  <FormControl>
                    <div className="flex gap-1">{renderStars(field.value)}</div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentario (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Cuéntanos sobre tu experiencia..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Publicar Reseña
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}