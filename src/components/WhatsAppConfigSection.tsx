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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Phone, Info, Globe, MessageCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { whatsappSchema, type WhatsAppFormData, formatPhoneDisplay, formatWhatsAppNumber } from "@/utils/whatsapp";
import { COUNTRY_CODES, detectCountryFromNumber, extractLocalNumber, getCountryByCode } from "@/data/countryCodes";

interface WhatsAppConfigSectionProps {
  userId: string;
  initialData?: {
    whatsapp_number?: string | null;
    whatsapp_enabled?: boolean | null;
    whatsapp_business_hours?: string | null;
    whatsapp_verified?: boolean;
    whatsapp_verified_at?: string | null;
  };
  onDataRefresh?: () => void;
}

export const WhatsAppConfigSection = ({ userId, initialData, onDataRefresh }: WhatsAppConfigSectionProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoVerifying, setIsAutoVerifying] = useState(false);
  

  // Detectar país del número inicial
  const initialCountryCode = initialData?.whatsapp_number 
    ? detectCountryFromNumber(initialData.whatsapp_number)
    : "MX";
  
  const initialLocalNumber = initialData?.whatsapp_number
    ? extractLocalNumber(initialData.whatsapp_number, initialCountryCode)
    : "";

  // Guardar el número inicial completo para comparación
  const initialFullNumber = initialData?.whatsapp_number || null;

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
      whatsapp_enabled: initialData?.whatsapp_enabled ?? true
    }
  });

  const whatsappEnabled = watch("whatsapp_enabled");
  const currentNumber = watch("whatsapp_number");
  const currentCountryCode = watch("country_code");
  const selectedCountry = getCountryByCode(currentCountryCode);

  const autoVerifyWhatsApp = async (phoneNumber: string) => {
    setIsAutoVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-whatsapp-number');

      if (error) {
        // Silent error - auto-verification is optional
        return;
      }

      if (data.hasWhatsApp) {
        toast.success("¡WhatsApp verificado automáticamente!", {
          description: "Tu número tiene WhatsApp activo",
        });
      } else {
        toast.warning("WhatsApp no disponible", {
          description: "Este número no tiene WhatsApp activo. Verifica el número o instala WhatsApp.",
        });
      }

      // Actualizar datos después de verificación
      if (onDataRefresh) {
        onDataRefresh();
      }
    } catch (error) {
      // Silent error - auto-verification is optional and shouldn't disrupt user flow
    } finally {
      setIsAutoVerifying(false);
    }
  };


  const onSubmit = async (data: WhatsAppFormData) => {
    setIsLoading(true);

    try {
      // Formatear el número completo con código de país
      const fullNumber = formatWhatsAppNumber(data.whatsapp_number, data.country_code);
      
      // Detectar si el número cambió
      const numberChanged = initialFullNumber !== fullNumber;

      const { error } = await supabase
        .from("profiles")
        .update({
          whatsapp_number: fullNumber,
          whatsapp_enabled: data.whatsapp_enabled
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Configuración de WhatsApp actualizada");

      // Auto-verificar si el número es nuevo o cambió
      if (numberChanged && data.whatsapp_number.length >= 8) {
        // Pequeño delay para que la actualización se complete
        setTimeout(() => {
          toast.info("Verificando WhatsApp automáticamente...", {
            description: "Esto tomará solo unos segundos",
          });
          autoVerifyWhatsApp(fullNumber);
        }, 500);
      }

      // Actualizar datos del perfil
      if (onDataRefresh) {
        onDataRefresh();
      }
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
              {initialFullNumber ? 
                " Verificamos automáticamente si tu número tiene WhatsApp activo cuando lo cambias." :
                " Tu número será verificado automáticamente después de guardarlo."
              }
            </AlertDescription>
          </Alert>

          {isAutoVerifying && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Verificando WhatsApp automáticamente... Por favor espera.
              </AlertDescription>
            </Alert>
          )}

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

          <Button type="submit" disabled={isLoading || isAutoVerifying} className="w-full">
            {isLoading ? "Guardando..." : isAutoVerifying ? "Verificando WhatsApp..." : "Guardar Configuración"}
          </Button>
        </form>

        {/* Estado de Verificación de WhatsApp */}
        {initialData?.whatsapp_number && (
          <div className="mt-6 pt-6 border-t space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Estado de Verificación
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPhoneDisplay(initialData.whatsapp_number, detectCountryFromNumber(initialData.whatsapp_number))}
                </p>
              </div>
              {initialData?.whatsapp_verified ? (
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Verificado
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  No Verificado
                </Badge>
              )}
            </div>

            {initialData?.whatsapp_verified ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Tu número tiene WhatsApp activo. Los usuarios podrán contactarte directamente desde tus propiedades.
                  {initialData?.whatsapp_verified_at && (
                    <span className="block text-xs text-green-700 mt-1">
                      Verificado el {new Date(initialData.whatsapp_verified_at).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert className="bg-orange-50 border-orange-200">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    Tu número aún no está verificado. Verifica que tenga WhatsApp activo para mejorar tu credibilidad.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
