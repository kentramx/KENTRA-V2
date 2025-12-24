import './App.css';
import { useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useTracking } from "@/hooks/useTracking";
import { GlobalSubscriptionBanner } from "@/components/subscription/GlobalSubscriptionBanner";
import { Footer } from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import { Loader2 } from "lucide-react";

// ✅ Lazy loading para todas las páginas (reduce bundle inicial)
const Home = lazy(() => import("./pages/Home"));
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const Favorites = lazy(() => import("./pages/Favorites"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const AgencyDashboard = lazy(() => import("./pages/AgencyDashboard"));
const DeveloperDashboard = lazy(() => import("./pages/DeveloperDashboard"));
const AgentProfile = lazy(() => import("./pages/AgentProfile"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const Settings = lazy(() => import("./pages/Settings"));
const Auth = lazy(() => import("./pages/Auth"));
const Buscar = lazy(() => import("./pages/Buscar"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Publicar = lazy(() => import("./pages/Publicar"));
const PricingAgente = lazy(() => import("./pages/PricingAgente"));
const PricingInmobiliaria = lazy(() => import("./pages/PricingInmobiliaria"));
const PricingDesarrolladora = lazy(() => import("./pages/PricingDesarrolladora"));
const DirectorioAgentes = lazy(() => import("./pages/DirectorioAgentes"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCanceled = lazy(() => import("./pages/PaymentCanceled"));
const AdminRoles = lazy(() => import("./pages/AdminRoles"));
const AdminRoleAudit = lazy(() => import("./pages/AdminRoleAudit"));
const AdminNotificationSettings = lazy(() => import("./pages/AdminNotificationSettings"));
const AdminSubscriptionChanges = lazy(() => import("./pages/AdminSubscriptionChanges"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminFinancial = lazy(() => import("./pages/AdminFinancial"));
const AdminSystemHealth = lazy(() => import("./pages/AdminSystemHealth"));
const AdminKPIs = lazy(() => import("./pages/AdminKPIs"));
const AdminMarketing = lazy(() => import("./pages/AdminMarketing"));
const AdminUpsells = lazy(() => import("./pages/AdminUpsells"));
const AdminKYC = lazy(() => import("./pages/AdminKYC"));
const AdminSubscriptions = lazy(() => import("./pages/AdminSubscriptions"));
const AdminChurn = lazy(() => import("./pages/AdminChurn"));
const AdminGeocoding = lazy(() => import("./pages/AdminGeocoding"));
const AdminCoupons = lazy(() => import("./pages/AdminCoupons"));
const AdminPlans = lazy(() => import("./pages/AdminPlans"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const UnirseEquipo = lazy(() => import("./pages/UnirseEquipo"));
const Privacidad = lazy(() => import("./pages/Privacidad"));
const Terminos = lazy(() => import("./pages/Terminos"));
const Ayuda = lazy(() => import("./pages/Ayuda"));

// Spinner de carga para Suspense
const PageLoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Cargando...</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  },
});

// Componente interno para trackear pageviews
const AppContent = () => {
  const location = useLocation();
  const { trackPageView } = useTracking();

  useEffect(() => {
    window.scrollTo(0, 0);
    trackPageView(location.pathname + location.search);
  }, [location.pathname, trackPageView]);

  return (
    <>
      <GlobalSubscriptionBanner />
      <Suspense fallback={<PageLoadingSpinner />}>
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
          <Route path="/panel-desarrolladora" element={<DeveloperDashboard />} />
          <Route path="/mensajes" element={<MessagesPage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/publicar" element={<Publicar />} />
          <Route path="/pricing-agente" element={<PricingAgente />} />
          <Route path="/pricing-inmobiliaria" element={<PricingInmobiliaria />} />
          <Route path="/pricing-desarrolladora" element={<PricingDesarrolladora />} />
          <Route path="/agentes" element={<DirectorioAgentes />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-canceled" element={<PaymentCanceled />} />
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
          <Route path="/admin/plans" element={<AdminPlans />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/ayuda" element={<Ayuda />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Footer />
      <BottomNav />
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SubscriptionProvider>
              <AppContent />
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;