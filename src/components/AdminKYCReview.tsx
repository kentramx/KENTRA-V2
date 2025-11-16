import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMonitoring } from "@/lib/monitoring";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageLightbox } from "@/components/ImageLightbox";
import { KYCVerificationHistory } from "@/components/KYCVerificationHistory";
import { toast } from "@/hooks/use-toast";
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  FileText,
  User,
  Calendar,
  MapPin,
  Image as ImageIcon,
} from "lucide-react";

interface KYCVerification {
  id: string;
  user_id: string;
  status: string;
  ine_front_url?: string;
  ine_back_url?: string;
  rfc_url?: string;
  full_name?: string;
  curp?: string;
  date_of_birth?: string;
  address?: string;
  rejection_reason?: string;
  admin_notes?: string;
  created_at: string;
  profiles?: {
    name: string;
    email?: string;
  };
}

export const AdminKYCReview = () => {
  const { user } = useAuth();
  const { error: logError, captureException } = useMonitoring();
  const [verifications, setVerifications] = useState<KYCVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [selectedVerification, setSelectedVerification] = useState<KYCVerification | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  
  // Estado para el lightbox de documentos
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxTitle, setLightboxTitle] = useState("");

  useEffect(() => {
    fetchVerifications();
  }, [filter]);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("identity_verifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch profile names separately
      if (data && data.length > 0) {
        const userIds = data.map(v => v.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
        
        const enrichedData = data.map(v => ({
          ...v,
          profiles: { name: profileMap.get(v.user_id) || "Usuario" }
        }));
        
        setVerifications(enrichedData as KYCVerification[]);
      } else {
        setVerifications([]);
      }
    } catch (error: any) {
      logError("Error fetching KYC verifications", {
        component: "AdminKYCReview",
        filter,
        error,
      });
      captureException(error, {
        component: "AdminKYCReview",
        action: "fetchVerifications",
        filter,
      });
      toast({
        title: "Error",
        description: "No se pudieron cargar las verificaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!selectedVerification || !reviewAction) return;

    if (reviewAction === 'reject' && !rejectionReason.trim()) {
      toast({
        title: "Motivo requerido",
        description: "Debes especificar el motivo del rechazo",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("identity_verifications")
        .update({
          status: reviewAction === 'approve' ? 'approved' : 'rejected',
          rejection_reason: reviewAction === 'reject' ? rejectionReason : null,
          admin_notes: adminNotes || null,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedVerification.id);

      if (error) throw error;

      toast({
        title: reviewAction === 'approve' ? "Verificación aprobada" : "Verificación rechazada",
        description: `La solicitud de ${selectedVerification.profiles?.name} ha sido ${reviewAction === 'approve' ? 'aprobada' : 'rechazada'}`,
      });

      setSelectedVerification(null);
      setReviewAction(null);
      setRejectionReason("");
      setAdminNotes("");
      await fetchVerifications();
    } catch (error: any) {
      logError("Error processing KYC review", {
        component: "AdminKYCReview",
        verificationId: selectedVerification.id,
        action: reviewAction,
        error,
      });
      captureException(error, {
        component: "AdminKYCReview",
        action: "processReview",
        reviewAction,
      });
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar la revisión",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Aprobado
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rechazado
          </Badge>
        );
      case 'under_review':
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <Eye className="h-3 w-3 mr-1" />
            En Revisión
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pendiente
          </Badge>
        );
    }
  };

  const openDocument = (verification: KYCVerification, docType: 'ine_front' | 'ine_back' | 'rfc') => {
    const documents = [];
    const docNames: Record<string, string> = {
      ine_front: 'INE (Frente)',
      ine_back: 'INE (Reverso)',
      rfc: 'RFC'
    };
    
    // Construir array de documentos disponibles
    if (verification.ine_front_url) {
      documents.push({ url: verification.ine_front_url, name: 'INE (Frente)' });
    }
    if (verification.ine_back_url) {
      documents.push({ url: verification.ine_back_url, name: 'INE (Reverso)' });
    }
    if (verification.rfc_url) {
      documents.push({ url: verification.rfc_url, name: 'RFC' });
    }
    
    // Determinar índice inicial basado en el documento clickeado
    let initialIndex = 0;
    switch (docType) {
      case 'ine_front':
        initialIndex = 0;
        break;
      case 'ine_back':
        initialIndex = verification.ine_front_url ? 1 : 0;
        break;
      case 'rfc':
        initialIndex = documents.length - 1;
        break;
    }
    
    // Abrir lightbox
    setLightboxImages(documents);
    setLightboxIndex(initialIndex);
    setLightboxTitle(`Documentos KYC - ${verification.profiles?.name || 'Usuario'}`);
    setLightboxOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Verificaciones de Identidad (KYC)</h2>
        
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="under_review">En Revisión</SelectItem>
            <SelectItem value="approved">Aprobadas</SelectItem>
            <SelectItem value="rejected">Rechazadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : verifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay verificaciones {filter !== 'all' ? `en estado "${filter}"` : ''}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {verifications.map((verification) => (
            <Card key={verification.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {verification.profiles?.name || "Usuario"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      CURP: {verification.curp || "No proporcionado"}
                    </p>
                  </div>
                  {getStatusBadge(verification.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span><strong>Nombre completo:</strong> {verification.full_name}</span>
                  </div>
                  
                  {verification.date_of_birth && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        <strong>Fecha de nacimiento:</strong>{" "}
                        {new Date(verification.date_of_birth).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {verification.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span><strong>Domicilio:</strong> {verification.address}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      <strong>Enviado:</strong>{" "}
                      {new Date(verification.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {verification.ine_front_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDocument(verification, 'ine_front')}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Ver INE (Frente)
                    </Button>
                  )}
                  {verification.ine_back_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDocument(verification, 'ine_back')}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Ver INE (Reverso)
                    </Button>
                  )}
                  {verification.rfc_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDocument(verification, 'rfc')}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Ver RFC
                    </Button>
                  )}
                </div>

                {verification.status === 'rejected' && verification.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-md text-sm">
                    <p><strong>Motivo del rechazo:</strong> {verification.rejection_reason}</p>
                    {verification.admin_notes && (
                      <p className="mt-1"><strong>Notas:</strong> {verification.admin_notes}</p>
                    )}
                  </div>
                )}

                {verification.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => {
                        setSelectedVerification(verification);
                        setReviewAction('approve');
                      }}
                      size="sm"
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Aprobar
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedVerification(verification);
                        setReviewAction('reject');
                      }}
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Rechazar
                    </Button>
                  </div>
                )}

                {/* Historial de Revisiones */}
                {verification.status !== 'pending' && (
                  <div className="mt-4">
                    <KYCVerificationHistory verificationId={verification.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog
        open={reviewAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReviewAction(null);
            setSelectedVerification(null);
            setRejectionReason("");
            setAdminNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Aprobar Verificación' : 'Rechazar Verificación'}
            </DialogTitle>
            <DialogDescription>
              {selectedVerification?.profiles?.name} - {selectedVerification?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {reviewAction === 'reject' && (
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Motivo del Rechazo *</Label>
                <Select value={rejectionReason} onValueChange={setRejectionReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Documento ilegible o de mala calidad">
                      Documento ilegible o de mala calidad
                    </SelectItem>
                    <SelectItem value="INE vencida">INE vencida</SelectItem>
                    <SelectItem value="Datos no coinciden">
                      Datos no coinciden con documentos
                    </SelectItem>
                    <SelectItem value="Documento alterado o falso">
                      Documento alterado o falso
                    </SelectItem>
                    <SelectItem value="Falta documentación requerida">
                      Falta documentación requerida
                    </SelectItem>
                    <SelectItem value="Otro">Otro motivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-notes">
                Notas Adicionales {reviewAction === 'reject' ? '(opcional)' : ''}
              </Label>
              <Textarea
                id="admin-notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Agrega notas para el usuario..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  setReviewAction(null);
                  setRejectionReason("");
                  setAdminNotes("");
                }}
                variant="outline"
                className="flex-1"
                disabled={processing}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleReview}
                className="flex-1"
                disabled={processing || (reviewAction === 'reject' && !rejectionReason)}
                variant={reviewAction === 'approve' ? 'default' : 'destructive'}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    {reviewAction === 'approve' ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Confirmar Aprobación
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Confirmar Rechazo
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Visor de documentos KYC */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={lightboxTitle}
      />
    </div>
  );
};
