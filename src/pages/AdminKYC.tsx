import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useRequire2FA } from "@/hooks/useRequire2FA";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { AdminKYCReview } from "@/components/AdminKYCReview";
import { DynamicBreadcrumbs } from "@/components/DynamicBreadcrumbs";
import { Loader2 } from "lucide-react";

const AdminKYC = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { requirementMet, checking: checking2FA } = useRequire2FA();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!adminLoading && !checking2FA && (!isAdmin || !requirementMet)) {
      navigate("/");
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a esta página",
        variant: "destructive",
      });
    }
  }, [isAdmin, adminLoading, navigate, requirementMet, checking2FA]);

  if (adminLoading || checking2FA) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin || !requirementMet) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <DynamicBreadcrumbs
          items={[
            { label: "Inicio", href: "/", active: false },
            { label: "Admin", href: "/admin/dashboard", active: false },
            { label: "Verificaciones KYC", href: "", active: true },
          ]}
          className="mb-6"
        />

        <AdminKYCReview />
      </div>
    </div>
  );
};

export default AdminKYC;
