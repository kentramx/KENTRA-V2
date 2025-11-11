import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Phone, Info, Globe } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { whatsappSchema, type WhatsAppFormData, formatPhoneDisplay, formatWhatsAppNumber } from "@/utils/whatsapp";
import { COUNTRY_CODES, detectCountryFromNumber, extractLocalNumber, getCountryByCode } from "@/data/countryCodes";

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

  // Detectar país del número inicial
  const initialCountryCode = initialData?.whatsapp_number 
    ? detectCountryFromNumber(initialData.whatsapp_number)
    : "MX";
  
  const initialLocalNumber = initialData?.whatsapp_number
    ? extractLocalNumber(initialData.whatsapp_number, initialCountryCode)
    : "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<WhatsAppFormData>({
    resolver: zodResolver(whatsappSchema),
    defaultValues: {
      country_code: initialCountryCode,
      whatsapp_number: initialLocalNumber,
      whatsapp_enabled: initialData?.whatsapp_enabled ?? true,
      whatsapp_business_hours: initialData?.whatsapp_business_hours || ""
    }
  });

  const whatsappEnabled = watch("whatsapp_enabled");
  const currentNumber = watch("whatsapp_number");
  const currentCountryCode = watch("country_code");
  const selectedCountry = getCountryByCode(currentCountryCode);

  const onSubmit = async (data: WhatsAppFormData) => {
    setIsLoading(true);

    try {
      // Formatear el número completo con código de país
      const fullNumber = formatWhatsAppNumber(data.whatsapp_number, data.country_code);
      
      const { error } = await supabase
        .from("profiles")
        .update({
          whatsapp_number: fullNumber,
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
              <Label htmlFor="country_code" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                País
              </Label>
              <Select
                value={currentCountryCode}
                onValueChange={(value) => setValue("country_code", value)}
                disabled={isLoading}
              >
                <SelectTrigger id="country_code">
                  <SelectValue placeholder="Selecciona un país" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {COUNTRY_CODES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{country.flag}</span>
                        <span>{country.name}</span>
                        <span className="text-muted-foreground text-sm">({country.dialCode})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">
                Número de WhatsApp <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="flex items-center justify-center bg-muted px-3 rounded-l-md border border-r-0 min-w-[70px]">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <span className="text-base">{selectedCountry.flag}</span>
                    <span>{selectedCountry.dialCode}</span>
                  </span>
                </div>
                <Input
                  id="whatsapp_number"
                  type="tel"
                  placeholder={selectedCountry.placeholder}
                  {...register("whatsapp_number")}
                  disabled={isLoading}
                  className={errors.whatsapp_number ? "border-destructive rounded-l-none" : "rounded-l-none"}
                />
              </div>
              {errors.whatsapp_number && (
                <p className="text-sm text-destructive">{errors.whatsapp_number.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {selectedCountry.minLength === selectedCountry.maxLength 
                  ? `Ingresa ${selectedCountry.minLength} dígitos sin espacios ni guiones`
                  : `Ingresa entre ${selectedCountry.minLength} y ${selectedCountry.maxLength} dígitos`
                }
              </p>
              {currentNumber && !errors.whatsapp_number && currentNumber.length >= selectedCountry.minLength && (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Formato completo: <span className="font-medium text-foreground">
                      {formatPhoneDisplay(formatWhatsAppNumber(currentNumber, currentCountryCode), currentCountryCode)}
                    </span>
                  </p>
                </div>
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
