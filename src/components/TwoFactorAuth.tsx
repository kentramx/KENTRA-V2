import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Shield, QrCode, Key, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import { useMonitoring } from "@/lib/monitoring";

interface TwoFactorAuthProps {
  isAdminRole: boolean;
  userRole: string | null;
}

export const TwoFactorAuth = ({ isAdminRole, userRole }: TwoFactorAuthProps) => {
  const { debug, error: logError, captureException } = useMonitoring();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [totpSecret, setTotpSecret] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [factorId, setFactorId] = useState<string>("");

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factors?.totp?.find(f => f.status === 'verified');
      
      setMfaEnabled(!!verifiedFactor);
      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
      }
    } catch (error) {
      console.error("Error checking MFA status:", error);
    } finally {
      setLoading(false);
    }
  };

  const startEnrollment = async () => {
    setEnrolling(true);
    try {
      // Primero verificar si ya existen factores no verificados y eliminarlos
      const { data: existingFactors } = await supabase.auth.mfa.listFactors();
      
      if (existingFactors?.totp) {
        // Eliminar todos los factores no verificados
        for (const factor of existingFactors.totp) {
          if (factor.status !== 'verified') {
            try {
              await supabase.auth.mfa.unenroll({ factorId: factor.id });
            } catch (unenrollError) {
              debug('Error eliminando factor no verificado', {
                component: 'TwoFactorAuth',
                factorId: factor.id,
                error: unenrollError,
              });
            }
          }
        }
      }

      // Crear nuevo factor con nombre único usando timestamp
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Kentra Admin MFA ${Date.now()}`
      });

      if (error) throw error;

      if (data) {
        setTotpSecret(data.totp.secret);
        setFactorId(data.id);
        
        // El QR code ya viene como SVG completo de Supabase, usarlo directamente
        setQrCode(data.totp.qr_code);

        toast({
          title: "Código QR generado",
          description: "Escanea el código con tu app de autenticación",
        });
      }
    } catch (error: any) {
      logError("Error enrolling MFA", {
        component: "TwoFactorAuth",
        error,
      });
      captureException(error, {
        component: "TwoFactorAuth",
        action: "startEnrollment",
      });
      toast({
        title: "Error",
        description: error.message || "No se pudo iniciar la configuración de 2FA",
        variant: "destructive",
      });
    }
  };

  const verifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Error",
        description: "Ingresa el código de 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factorId,
        code: verificationCode,
      });

      if (error) throw error;

      setMfaEnabled(true);
      setEnrolling(false);
      setQrCode("");
      setVerificationCode("");
      
      toast({
        title: "2FA habilitado",
        description: "La autenticación de dos factores está activa",
      });
    } catch (error: any) {
      logError("Error verifying MFA", {
        component: "TwoFactorAuth",
        error,
      });
      captureException(error, {
        component: "TwoFactorAuth",
        action: "verifyAndEnable",
      });
      toast({
        title: "Error",
        description: error.message || "Código incorrecto. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const disableMFA = async () => {
    if (!confirm("¿Estás seguro de desactivar 2FA? Esto reducirá la seguridad de tu cuenta.")) {
      return;
    }

    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      
      if (error) throw error;

      setMfaEnabled(false);
      setFactorId("");
      
      toast({
        title: "2FA deshabilitado",
        description: "La autenticación de dos factores ha sido desactivada",
      });
    } catch (error: any) {
      logError("Error disabling MFA", {
        component: "TwoFactorAuth",
        error,
      });
      captureException(error, {
        component: "TwoFactorAuth",
        action: "disableMFA",
      });
      toast({
        title: "Error",
        description: error.message || "No se pudo desactivar 2FA",
        variant: "destructive",
      });
    }
  };

  const cancelEnrollment = () => {
    setEnrolling(false);
    setQrCode("");
    setTotpSecret("");
    setVerificationCode("");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Autenticación de Dos Factores (2FA)
        </CardTitle>
        <CardDescription>
          Agrega una capa adicional de seguridad a tu cuenta administrativa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Estado:</span>
          {mfaEnabled ? (
            <Badge className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Habilitado
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="w-3 h-3 mr-1" />
              Deshabilitado
            </Badge>
          )}
        </div>

        {/* Advertencia para roles administrativos sin 2FA */}
        {isAdminRole && !mfaEnabled && !enrolling && (
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Seguridad requerida:</strong> Como {userRole === 'super_admin' ? 'Super Admin' : 'Moderador'}, 
              se recomienda encarecidamente habilitar 2FA para proteger tu cuenta.
            </AlertDescription>
          </Alert>
        )}

        {/* Estado: 2FA habilitado */}
        {mfaEnabled && !enrolling && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Tu cuenta está protegida con autenticación de dos factores. 
                Se te solicitará un código cada vez que inicies sesión.
              </AlertDescription>
            </Alert>
            
            <Button 
              variant="outline" 
              onClick={disableMFA}
              className="w-full"
            >
              Desactivar 2FA
            </Button>
          </div>
        )}

        {/* Estado: No habilitado, no enrollando */}
        {!mfaEnabled && !enrolling && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>La autenticación de dos factores agrega seguridad adicional requiriendo:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Tu contraseña (algo que sabes)</li>
                <li>Un código de tu teléfono (algo que tienes)</li>
              </ul>
            </div>
            
            <Button 
              onClick={startEnrollment}
              className="w-full"
            >
              <QrCode className="w-4 h-4 mr-2" />
              Configurar 2FA
            </Button>
          </div>
        )}

        {/* Estado: En proceso de enrollment */}
        {enrolling && !mfaEnabled && (
          <div className="space-y-4">
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                Sigue estos pasos para configurar 2FA:
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">1. Escanea el código QR</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Usa una app de autenticación (Google Authenticator, Authy, 1Password, etc.)
                </p>
                {qrCode && (
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <div 
                      className="w-48 h-48" 
                      dangerouslySetInnerHTML={{ __html: qrCode }}
                    />
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-2">2. O ingresa manualmente:</h4>
                <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
                  {totpSecret}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">3. Ingresa el código de verificación</h4>
                <Label htmlFor="verification-code">Código de 6 dígitos</Label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="mt-2"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={verifyAndEnable}
                  className="flex-1"
                  disabled={verificationCode.length !== 6}
                >
                  Verificar y Activar
                </Button>
                <Button 
                  variant="outline" 
                  onClick={cancelEnrollment}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Información adicional */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-semibold mb-2">Aplicaciones recomendadas:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Google Authenticator</li>
            <li>• Microsoft Authenticator</li>
            <li>• Authy</li>
            <li>• 1Password</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
