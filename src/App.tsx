import './App.css';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useTracking } from "@/hooks/useTracking";
import { monitoring } from "@/lib/monitoring";
import { initSentry } from "@/lib/sentry";

// Inicializar Sentry al cargar la app
initSentry();
import Home from "./pages/Home";
import PropertyDetail from "./pages/PropertyDetail";
import Favorites from "./pages/Favorites";
import ComparePage from "./pages/ComparePage";
import AgentDashboard from "./pages/AgentDashboard";
import AgencyDashboard from "./pages/AgencyDashboard";
import AgentProfile from "./pages/AgentProfile";
import UserProfile from "./pages/UserProfile";
import NotificationSettings from "./pages/NotificationSettings";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import Buscar from "./pages/Buscar";
import MessagesPage from "./pages/MessagesPage";
import NotFound from "./pages/NotFound";
// MapPreloader eliminado - Google Maps removido
import Publicar from "./pages/Publicar";
import PricingAgente from "./pages/PricingAgente";
import PricingInmobiliaria from "./pages/PricingInmobiliaria";
import PricingDesarrolladora from "./pages/PricingDesarrolladora";
import DirectorioAgentes from "./pages/DirectorioAgentes";
import Leaderboard from "./pages/Leaderboard";
import PaymentSuccess from "./pages/PaymentSuccess";
import AdminRoles from "./pages/AdminRoles";
import AdminRoleAudit from "./pages/AdminRoleAudit";
import AdminNotificationSettings from "./pages/AdminNotificationSettings";
import AdminSubscriptionChanges from "./pages/AdminSubscriptionChanges";
import AdminDashboard from "./pages/AdminDashboard";
import AdminFinancial from "./pages/AdminFinancial";
import AdminSystemHealth from "./pages/AdminSystemHealth";
import AdminKPIs from "./pages/AdminKPIs";
import AdminMarketing from "./pages/AdminMarketing";
import AdminUpsells from "./pages/AdminUpsells";
import AdminKYC from "./pages/AdminKYC";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminChurn from "./pages/AdminChurn";
import AdminGeocoding from "./pages/AdminGeocoding";
import AdminCoupons from "./pages/AdminCoupons";
import UnirseEquipo from "./pages/UnirseEquipo";
import { Footer } from "@/components/Footer";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos - datos considerados frescos
      gcTime: 30 * 60 * 1000, // 30 minutos - mantener en caché (antes cacheTime)
      retry: 1, // Solo 1 reintento en caso de fallo
      refetchOnWindowFocus: false, // No refetch al cambiar de ventana
      refetchOnMount: false, // No refetch al montar si hay datos en caché
      refetchOnReconnect: false, // No refetch al reconectar internet
    },
  },
});

// Componente interno para trackear pageviews
const AppContent = () => {
  const location = useLocation();
  const { trackPageView } = useTracking();

  useEffect(() => {
    // Trackear pageview en cada cambio de ruta usando GTM
    trackPageView(location.pathname + location.search);
  }, [location, trackPageView]);

  return (
    <>
      <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/propiedad/:id" element={<PropertyDetail />} />
              <Route path="/agente/:id" element={<AgentProfile />} />
              <Route path="/perfil" element={<UserProfile />} />
              <Route path="/notificaciones" element={<NotificationSettings />} />
              <Route path="/configuracion" element={<Settings />} />
              <Route path="/buscar" element={<Buscar />} />
              <Route path="/favoritos" element={<Favorites />} />
              <Route path="/comparar" element={<ComparePage />} />
              <Route path="/panel-agente" element={<AgentDashboard />} />
              <Route path="/panel-inmobiliaria" element={<AgencyDashboard />} />
              <Route path="/mensajes" element={<MessagesPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/publicar" element={<Publicar />} />
              <Route path="/pricing-agente" element={<PricingAgente />} />
              <Route path="/pricing-inmobiliaria" element={<PricingInmobiliaria />} />
              <Route path="/pricing-desarrolladora" element={<PricingDesarrolladora />} />
              <Route path="/agentes" element={<DirectorioAgentes />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/unirse-equipo" element={<UnirseEquipo />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/financiero" element={<AdminFinancial />} />
              <Route path="/admin/system-health" element={<AdminSystemHealth />} />
              <Route path="/admin/kpis" element={<AdminKPIs />} />
              <Route path="/admin/marketing" element={<AdminMarketing />} />
              <Route path="/admin/roles" element={<AdminRoles />} />
              <Route path="/admin/role-audit" element={<AdminRoleAudit />} />
              <Route path="/admin/subscription-changes" element={<AdminSubscriptionChanges />} />
              <Route path="/admin/notification-settings" element={<AdminNotificationSettings />} />
              <Route path="/admin/upsells" element={<AdminUpsells />} />
              <Route path="/admin/kyc" element={<AdminKYC />} />
              <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
              <Route path="/admin/churn" element={<AdminChurn />} />
              <Route path="/admin/geocoding" element={<AdminGeocoding />} />
              <Route path="/admin/coupons" element={<AdminCoupons />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Footer />
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* MapPreloader eliminado */}
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
