import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";
import Home from "./pages/Home";
import PropertyDetail from "./pages/PropertyDetail";
import Favorites from "./pages/Favorites";
import ComparePage from "./pages/ComparePage";
import AgentDashboard from "./pages/AgentDashboard";
import AgencyDashboard from "./pages/AgencyDashboard";
import AgentProfile from "./pages/AgentProfile";
import UserProfile from "./pages/UserProfile";
import NotificationSettings from "./pages/NotificationSettings";
import Auth from "./pages/Auth";
import Buscar from "./pages/Buscar";
import MessagesPage from "./pages/MessagesPage";
import InstallPWA from "./pages/InstallPWA";
import SetupDemo from "./pages/SetupDemo";
import NotFound from "./pages/NotFound";
import MapPreloader from "@/components/MapPreloader";
import Publicar from "./pages/Publicar";
import PricingAgente from "./pages/PricingAgente";
import PricingInmobiliaria from "./pages/PricingInmobiliaria";
import PricingDesarrolladora from "./pages/PricingDesarrolladora";
import DirectorioAgentes from "./pages/DirectorioAgentes";
import PaymentSuccess from "./pages/PaymentSuccess";
import AdminSubscriptionChanges from "./pages/AdminSubscriptionChanges";
import AdminNotificationSettings from "./pages/AdminNotificationSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <NotificationPermissionBanner />
        <MapPreloader />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/propiedad/:id" element={<PropertyDetail />} />
              <Route path="/agente/:id" element={<AgentProfile />} />
              <Route path="/perfil" element={<UserProfile />} />
              <Route path="/notificaciones" element={<NotificationSettings />} />
              <Route path="/buscar" element={<Buscar />} />
              <Route path="/favoritos" element={<Favorites />} />
              <Route path="/comparar" element={<ComparePage />} />
              <Route path="/panel-agente" element={<AgentDashboard />} />
              <Route path="/panel-inmobiliaria" element={<AgencyDashboard />} />
              <Route path="/mensajes" element={<MessagesPage />} />
              <Route path="/instalar" element={<InstallPWA />} />
              <Route path="/setup-demo" element={<SetupDemo />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/publicar" element={<Publicar />} />
              <Route path="/pricing-agente" element={<PricingAgente />} />
              <Route path="/pricing-inmobiliaria" element={<PricingInmobiliaria />} />
              <Route path="/pricing-desarrolladora" element={<PricingDesarrolladora />} />
              <Route path="/agentes" element={<DirectorioAgentes />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/admin/subscription-changes" element={<AdminSubscriptionChanges />} />
              <Route path="/admin/notification-settings" element={<AdminNotificationSettings />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
