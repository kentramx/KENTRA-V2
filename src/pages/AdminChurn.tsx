import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { ChurnMetrics } from "@/components/ChurnMetrics";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useRequire2FA } from "@/hooks/useRequire2FA";

const AdminChurn = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading } = useAdminCheck();
  const { requirementMet, checking: checking2FA } = useRequire2FA();

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      navigate("/");
    }
  }, [isSuperAdmin, loading, navigate]);

  if (loading || checking2FA) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Cargando...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin || !requirementMet) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <div className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Churn & Retención</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Análisis de cancelaciones, retención y valor de vida del cliente
          </p>
        </div>
        <ChurnMetrics />
      </div>
    </div>
  );
};

export default AdminChurn;
