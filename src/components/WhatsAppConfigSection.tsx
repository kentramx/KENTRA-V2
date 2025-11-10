import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Phone, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { whatsappSchema, type WhatsAppFormData, formatPhoneDisplay } from "@/utils/whatsapp";

interface WhatsAppConfigSectionProps {
  userId: string;
  initialData?: {
    whatsapp_number?: string | null;
    whatsapp_enabled?: boolean | null;
    whatsapp_business_hours?: string | null;
  };
}

export const WhatsAppConfigSection = ({ userId, initialData }: WhatsAppConfigSectionProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<WhatsAppFormData>({
    resolver: zodResolver(whatsappSchema),
    defaultValues: {
      whatsapp_number: initialData?.whatsapp_number || "",
      whatsapp_enabled: initialData?.whatsapp_enabled ?? true,
      whatsapp_business_hours: initialData?.whatsapp_business_hours || ""
    }
  });

  const whatsappEnabled = watch("whatsapp_enabled");
  const currentNumber = watch("whatsapp_number");

  const onSubmit = async (data: WhatsAppFormData) => {
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          whatsapp_number: data.whatsapp_number,
          whatsapp_enabled: data.whatsapp_enabled,
          whatsapp_business_hours: data.whatsapp_business_hours || null
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Configuración de WhatsApp actualizada");
    } catch (error) {
      console.error("Error updating WhatsApp config:", error);
      toast.error("Error al actualizar la configuración");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-green-600" />
          Configuración de WhatsApp
        </CardTitle>
        <CardDescription>
          Configura tu número de WhatsApp para recibir consultas directas de potenciales clientes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Al habilitar WhatsApp, los usuarios podrán contactarte directamente desde tus propiedades.
              Esto puede aumentar significativamente tus oportunidades de venta.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">
                Número de WhatsApp <span className="text-destructive">*</span>
              </Label>
              <Input
                id="whatsapp_number"
                type="tel"
                placeholder="5512345678"
                {...register("whatsapp_number")}
                disabled={isLoading}
                className={errors.whatsapp_number ? "border-destructive" : ""}
              />
              {errors.whatsapp_number && (
                <p className="text-sm text-destructive">{errors.whatsapp_number.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Ingresa tu número de 10 dígitos sin espacios ni guiones
              </p>
              {currentNumber && !errors.whatsapp_number && (
                <p className="text-sm text-muted-foreground">
                  Formato: {formatPhoneDisplay(currentNumber)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp_business_hours">
                Horario de atención (opcional)
              </Label>
              <Input
                id="whatsapp_business_hours"
                type="text"
                placeholder="Lun-Vie 9:00-18:00, Sáb 10:00-14:00"
                {...register("whatsapp_business_hours")}
                disabled={isLoading}
                maxLength={100}
              />
              <p className="text-sm text-muted-foreground">
                Indica cuándo estás disponible para responder consultas
              </p>
            </div>

            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="whatsapp_enabled" className="text-base">
                  Habilitar WhatsApp en mis propiedades
                </Label>
                <p className="text-sm text-muted-foreground">
                  Mostrar botón de WhatsApp en tus publicaciones
                </p>
              </div>
              <Switch
                id="whatsapp_enabled"
                checked={whatsappEnabled}
                onCheckedChange={(checked) => setValue("whatsapp_enabled", checked)}
                disabled={isLoading}
              />
            </div>
          </div>

          {initialData?.whatsapp_number && whatsappEnabled && (
            <Alert className="bg-green-50 border-green-200">
              <Info className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                WhatsApp activo. Los usuarios verán un botón "Contactar por WhatsApp" en tus propiedades.
              </AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Guardando..." : "Guardar Configuración"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
