import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { SuperAdminMetrics } from "@/components/SuperAdminMetrics";
import { useAdminCheck } from "@/hooks/useAdminCheck";

const AdminKPIs = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading } = useAdminCheck();

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      navigate("/");
    }
  }, [isSuperAdmin, loading, navigate]);

  if (loading) {
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

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">KPIs de Negocio</h1>
          <p className="text-muted-foreground mt-2">
            Métricas estratégicas y análisis de crecimiento
          </p>
        </div>
        <SuperAdminMetrics />
      </div>
    </div>
  );
};

export default AdminKPIs;
