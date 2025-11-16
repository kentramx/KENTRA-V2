import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  User,
  Calendar,
} from "lucide-react";
import { monitoring } from "@/lib/monitoring";

interface HistoryEntry {
  id: string;
  reviewed_by: string | null;
  previous_status: string;
  new_status: string;
  rejection_reason: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewer_profile?: {
    name: string;
  };
}

interface KYCVerificationHistoryProps {
  verificationId: string;
}

export const KYCVerificationHistory = ({ verificationId }: KYCVerificationHistoryProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [verificationId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("kyc_verification_history")
        .select("*")
        .eq("verification_id", verificationId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Obtener nombres de los revisores
      if (data && data.length > 0) {
        const reviewerIds = data
          .map((entry) => entry.reviewed_by)
          .filter((id): id is string => id !== null);

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", reviewerIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);

        const enrichedData = data.map((entry) => ({
          ...entry,
          reviewer_profile: {
            name: entry.reviewed_by
              ? profileMap.get(entry.reviewed_by) || "Admin"
              : "Sistema",
          },
        }));

        setHistory(enrichedData);
      } else {
        setHistory([]);
      }
    } catch (error: any) {
      monitoring.error("Error fetching KYC history", {
        component: "KYCVerificationHistory",
        verificationId,
        error,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Aprobado
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rechazado
          </Badge>
        );
      case "under_review":
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

  const getActionText = (prevStatus: string, newStatus: string) => {
    if (prevStatus === "pending" && newStatus === "approved") {
      return "Aprobó la verificación";
    }
    if (prevStatus === "pending" && newStatus === "rejected") {
      return "Rechazó la verificación";
    }
    if (prevStatus === "rejected" && newStatus === "approved") {
      return "Re-aprobó la verificación";
    }
    if (prevStatus === "approved" && newStatus === "rejected") {
      return "Revocó la verificación";
    }
    return `Cambió estado de ${prevStatus} a ${newStatus}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historial de Revisiones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historial de Revisiones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay cambios registrados para esta verificación.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historial de Revisiones
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry, index) => (
            <div
              key={entry.id}
              className={`border-l-2 border-border pl-4 pb-4 ${
                index === history.length - 1 ? "" : "border-b"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {entry.reviewer_profile?.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {getActionText(entry.previous_status, entry.new_status)}
                  </span>
                </div>
                {getStatusBadge(entry.new_status)}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Calendar className="h-3 w-3" />
                {new Date(entry.created_at).toLocaleString("es-MX", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              {entry.rejection_reason && (
                <div className="bg-red-50 border border-red-200 p-2 rounded-md text-sm mt-2">
                  <p className="font-medium text-red-800">
                    Motivo de rechazo:
                  </p>
                  <p className="text-red-700">{entry.rejection_reason}</p>
                </div>
              )}

              {entry.admin_notes && (
                <div className="bg-blue-50 border border-blue-200 p-2 rounded-md text-sm mt-2">
                  <p className="font-medium text-blue-800">Notas del admin:</p>
                  <p className="text-blue-700">{entry.admin_notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
