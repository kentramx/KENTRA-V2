import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useMonitoring } from "@/lib/monitoring";

// Esquema de validación simplificado para newsletter general
const newsletterSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }).optional(),
});

type NewsletterFormData = z.infer<typeof newsletterSchema>;

export const NewsletterForm = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { error: logError, captureException } = useMonitoring();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NewsletterFormData>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: {
      email: user?.email || "",
      name: "",
    },
  });

  const onSubmit = async (data: NewsletterFormData) => {
    try {
      setIsSubmitting(true);
      
      const subscriptionData = {
        email: data.email,
        name: data.name || null,
        user_id: user?.id || null,
        preferences: null, // Newsletter general sin preferencias específicas
        is_active: true,
      };

      // Verificar si ya existe una suscripción
      const { data: existing } = await supabase
        .from("newsletter_subscriptions")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();

      if (existing) {
        // Actualizar suscripción existente
        const { error } = await supabase
          .from("newsletter_subscriptions")
          .update(subscriptionData)
          .eq("id", existing.id);

        if (error) throw error;

        toast({
          title: "¡Suscripción actualizada!",
          description: "Seguirás recibiendo nuestro newsletter con las últimas novedades.",
        });
      } else {
        // Crear nueva suscripción
        const { error } = await supabase
          .from("newsletter_subscriptions")
          .insert(subscriptionData);

        if (error) throw error;

        toast({
          title: "¡Bienvenido!",
          description: "Te has suscrito exitosamente a nuestro newsletter.",
        });
      }

      setIsOpen(false);
      form.reset();
    } catch (error: any) {
      logError("Error al suscribirse al newsletter", {
        component: "NewsletterForm",
        email: data.email,
        error,
      });
      captureException(error, {
        component: "NewsletterForm",
        action: "onSubmit",
      });
      toast({
        title: "Error",
        description: "Hubo un problema al procesar tu suscripción. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Mail className="h-4 w-4" />
          Suscríbete al Newsletter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Suscríbete a Nuestro Newsletter</DialogTitle>
          <DialogDescription>
            Recibe las últimas novedades del mercado inmobiliario directamente en tu email
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email*</FormLabel>
                  <FormControl>
                    <Input placeholder="tu@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Tu nombre" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Suscribiendo..." : "Suscribirme"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
