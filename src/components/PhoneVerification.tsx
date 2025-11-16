import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, AlertTriangle, Smartphone, Loader2 } from "lucide-react";
import { useMonitoring } from "@/lib/monitoring";

interface PhoneVerificationProps {
  phoneNumber: string | null;
  phoneVerified: boolean;
  onPhoneVerified: () => void;
}

export const PhoneVerification = ({ phoneNumber, phoneVerified, onPhoneVerified }: PhoneVerificationProps) => {
  const { error: logError, captureException } = useMonitoring();
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const handleSendCode = async () => {
    if (!phoneNumber) {
      toast({
        title: "Error",
        description: "Primero guarda tu número de teléfono",
        variant: "destructive",
      });
      return;
    }

    setSendingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-phone-verification", {
        body: { phoneNumber },
      });

      if (error) throw error;

      // Show dev code in toast if Twilio not configured (DEVELOPMENT ONLY)
      if (data?.devCode) {
        toast({
          title: "Código de desarrollo",
          description: `Tu código es: ${data.devCode} (Twilio no configurado)`,
          duration: 10000,
        });
      } else {
        toast({
          title: "Código enviado",
          description: "Revisa tu SMS con el código de verificación",
        });
      }

      setCodeSent(true);
    } catch (error: any) {
      logError("Error sending verification code", {
        component: "PhoneVerification",
        phoneNumber,
        error,
      });
      captureException(error, {
        component: "PhoneVerification",
        action: "handleSendCode",
      });
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar el código",
        variant: "destructive",
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Error",
        description: "Ingresa el código de 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);
    try {
      const { error } = await supabase.functions.invoke("verify-phone-code", {
        body: { code: verificationCode },
      });

      if (error) throw error;

      toast({
        title: "¡Teléfono verificado!",
        description: "Tu número de teléfono ha sido verificado exitosamente",
      });

      onPhoneVerified();
      setCodeSent(false);
      setVerificationCode("");
    } catch (error: any) {
      logError("Error verifying code", {
        component: "PhoneVerification",
        error,
      });
      captureException(error, {
        component: "PhoneVerification",
        action: "handleVerifyCode",
      });
      toast({
        title: "Error",
        description: error.message || "Código incorrecto o expirado",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  if (phoneVerified) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Teléfono Verificado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tu número de teléfono {phoneNumber} está verificado correctamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!phoneNumber) {
    return (
      <Card className="border-gray-200 bg-gray-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-gray-600" />
            Verificación de Teléfono
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Agrega tu número de teléfono arriba para poder verificarlo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500 bg-yellow-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Teléfono No Verificado
        </CardTitle>
        <CardDescription>
          Verifica tu número para aparecer como "Teléfono Verificado" en tu perfil público
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Número: <strong>{phoneNumber}</strong>
        </p>

        {!codeSent ? (
          <Button 
            onClick={handleSendCode} 
            disabled={sendingCode}
            size="sm"
            className="w-full"
          >
            {sendingCode ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando SMS...
              </>
            ) : (
              "Enviar Código de Verificación"
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                Ingresa el código de 6 dígitos que recibiste por SMS
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="verification-code">Código de Verificación</Label>
              <Input
                id="verification-code"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                disabled={verifying}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleVerifyCode} 
                disabled={verifying || verificationCode.length !== 6}
                size="sm"
                className="flex-1"
              >
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar Código"
                )}
              </Button>
              
              <Button 
                onClick={handleSendCode} 
                disabled={sendingCode}
                size="sm"
                variant="outline"
              >
                Reenviar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
