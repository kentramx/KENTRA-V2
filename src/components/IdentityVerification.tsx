import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Upload, 
  Loader2,
  FileText,
  Shield,
  Eye
} from "lucide-react";
import { useMonitoring } from "@/lib/monitoring";

interface KYCVerification {
  id: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  rejection_reason?: string;
  admin_notes?: string;
  ine_front_url?: string;
  ine_back_url?: string;
  rfc_url?: string;
  full_name?: string;
  curp?: string;
  date_of_birth?: string;
  address?: string;
  created_at: string;
  reviewed_at?: string;
}

export const IdentityVerification = () => {
  const { user } = useAuth();
  const { error: logError, captureException } = useMonitoring();
  const [verification, setVerification] = useState<KYCVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [ineFrontFile, setIneFrontFile] = useState<File | null>(null);
  const [ineBackFile, setIneBackFile] = useState<File | null>(null);
  const [rfcFile, setRfcFile] = useState<File | null>(null);
  const [fullName, setFullName] = useState("");
  const [curp, setCurp] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    fetchVerification();
  }, [user]);

  const fetchVerification = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("identity_verifications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setVerification(data as KYCVerification);
        setFullName(data.full_name || "");
        setCurp(data.curp || "");
        setDateOfBirth(data.date_of_birth || "");
        setAddress(data.address || "");
      }
    } catch (error: any) {
      logError("Error fetching verification", {
        component: "IdentityVerification",
        userId: user?.id,
        error,
      });
      captureException(error, {
        component: "IdentityVerification",
        action: "fetchVerification",
      });
      toast({
        title: "Error",
        description: "No se pudo cargar el estado de verificación",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (file: File, path: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user!.id}/${path}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!ineFrontFile || !ineBackFile || !fullName || !curp) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Upload documents
      const ineFrontUrl = await uploadDocument(ineFrontFile, 'ine_front');
      const ineBackUrl = await uploadDocument(ineBackFile, 'ine_back');
      const rfcUrl = rfcFile ? await uploadDocument(rfcFile, 'rfc') : null;

      // Create or update verification request
      const verificationData = {
        user_id: user!.id,
        ine_front_url: ineFrontUrl,
        ine_back_url: ineBackUrl,
        rfc_url: rfcUrl,
        full_name: fullName,
        curp: curp.toUpperCase(),
        date_of_birth: dateOfBirth || null,
        address: address || null,
        status: 'pending',
      };

      const { error } = await supabase
        .from("identity_verifications")
        .upsert(verificationData, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: "Solicitud enviada",
        description: "Tu solicitud de verificación ha sido enviada. Revisaremos tus documentos pronto.",
      });

      await fetchVerification();
    } catch (error: any) {
      logError("Error submitting verification", {
        component: "IdentityVerification",
        userId: user?.id,
        error,
      });
      captureException(error, {
        component: "IdentityVerification",
        action: "handleSubmit",
      });
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar la solicitud",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verificado
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Rechazado
          </Badge>
        );
      case 'under_review':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <Eye className="h-3 w-3 mr-1" />
            En Revisión
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Pendiente
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Si ya está verificado
  if (verification?.status === 'approved') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Identidad Verificada
          </CardTitle>
          <CardDescription>
            Tu identidad ha sido verificada exitosamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {getStatusBadge(verification.status)}
            <span className="text-sm text-muted-foreground">
              Verificado el {new Date(verification.reviewed_at!).toLocaleDateString()}
            </span>
          </div>
          
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              Tu perfil ahora muestra el badge "Profesional Verificado" que mejora tu credibilidad con los clientes.
            </AlertDescription>
          </Alert>

          <div className="text-sm space-y-1">
            <p><strong>Nombre completo:</strong> {verification.full_name}</p>
            <p><strong>CURP:</strong> {verification.curp}</p>
            {verification.date_of_birth && (
              <p><strong>Fecha de nacimiento:</strong> {new Date(verification.date_of_birth).toLocaleDateString()}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si está en revisión o pendiente
  if (verification && ['pending', 'under_review'].includes(verification.status)) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Verificación en Proceso
          </CardTitle>
          <CardDescription>
            Estamos revisando tu solicitud de verificación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {getStatusBadge(verification.status)}
            <span className="text-sm text-muted-foreground">
              Enviado el {new Date(verification.created_at).toLocaleDateString()}
            </span>
          </div>
          
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription>
              {verification.status === 'under_review' 
                ? "Un administrador está revisando tus documentos. Te notificaremos por email cuando se complete."
                : "Tu solicitud ha sido recibida. Pronto será revisada por nuestro equipo."}
            </AlertDescription>
          </Alert>

          <div className="text-sm space-y-1">
            <p><strong>Nombre completo:</strong> {verification.full_name}</p>
            <p><strong>CURP:</strong> {verification.curp}</p>
            <p><strong>Documentos enviados:</strong></p>
            <ul className="list-disc list-inside ml-4">
              {verification.ine_front_url && <li>INE (frente)</li>}
              {verification.ine_back_url && <li>INE (reverso)</li>}
              {verification.rfc_url && <li>Cédula de RFC</li>}
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si fue rechazado, mostrar motivo y permitir reenviar
  if (verification?.status === 'rejected') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Verificación Rechazada
          </CardTitle>
          <CardDescription>
            Tu solicitud fue rechazada. Puedes enviar una nueva.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription>
              <strong>Motivo del rechazo:</strong> {verification.rejection_reason || "No especificado"}
            </AlertDescription>
          </Alert>

          {verification.admin_notes && (
            <Alert>
              <AlertDescription>
                <strong>Notas del revisor:</strong> {verification.admin_notes}
              </AlertDescription>
            </Alert>
          )}

          <Button onClick={() => setVerification(null)} variant="outline" className="w-full">
            Enviar Nueva Solicitud
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Formulario para nueva solicitud
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Verificación de Identidad
        </CardTitle>
        <CardDescription>
          Verifica tu identidad para obtener el badge "Profesional Verificado" y aumentar tu credibilidad
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <strong>Documentos requeridos:</strong> INE vigente (ambos lados) y opcionalmente cédula de RFC.
            Tus documentos se almacenan de forma segura y solo son accesibles por administradores.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full-name">Nombre Completo *</Label>
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Como aparece en tu INE"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="curp">CURP *</Label>
            <Input
              id="curp"
              value={curp}
              onChange={(e) => setCurp(e.target.value.toUpperCase())}
              placeholder="18 caracteres"
              maxLength={18}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Fecha de Nacimiento (opcional)</Label>
            <Input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Domicilio (opcional)</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle, número, colonia, ciudad"
            />
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <Label htmlFor="ine-front">INE - Frente * (máx 5MB)</Label>
            <Input
              id="ine-front"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setIneFrontFile(e.target.files?.[0] || null)}
            />
            {ineFrontFile && (
              <p className="text-sm text-muted-foreground">
                ✓ {ineFrontFile.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ine-back">INE - Reverso * (máx 5MB)</Label>
            <Input
              id="ine-back"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setIneBackFile(e.target.files?.[0] || null)}
            />
            {ineBackFile && (
              <p className="text-sm text-muted-foreground">
                ✓ {ineBackFile.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rfc">Cédula de RFC (opcional, máx 5MB)</Label>
            <Input
              id="rfc"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setRfcFile(e.target.files?.[0] || null)}
            />
            {rfcFile && (
              <p className="text-sm text-muted-foreground">
                ✓ {rfcFile.name}
              </p>
            )}
          </div>
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={uploading || !ineFrontFile || !ineBackFile || !fullName || !curp}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando Documentos...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Enviar Solicitud de Verificación
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Al enviar esta solicitud, aceptas que almacenemos tus documentos de forma segura para verificar tu identidad.
          Normalmente revisamos solicitudes en 24-48 horas.
        </p>
      </CardContent>
    </Card>
  );
};

import { Separator } from "./ui/separator";
