import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { AdminRoleManagement } from "@/components/AdminRoleManagement";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useRequire2FA } from "@/hooks/useRequire2FA";

const AdminRoles = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  if (!isSuperAdmin || !user || !requirementMet) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gestión de Roles</h1>
          <p className="text-muted-foreground mt-2">
            Administración de roles y permisos administrativos
          </p>
        </div>
        <AdminRoleManagement currentUserId={user.id} isSuperAdmin={isSuperAdmin} />
      </div>
    </div>
  );
};

export default AdminRoles;
