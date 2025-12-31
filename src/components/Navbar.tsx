import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import kentraLogo from "@/assets/kentra-logo.png";
import { useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Home, Heart, User, Users, PlusCircle, LogOut, Search, Building, GitCompare, Settings, DollarSign, HelpCircle } from "lucide-react";
import { MessageBadge } from "./MessageBadge";
import { MobileMenu } from "./MobileMenu";
import { PublishPropertyButton } from "./subscription/PublishPropertyButton";
import { usePropertyCompare } from "@/hooks/usePropertyCompare";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { AdminRealtimeNotifications } from "./AdminRealtimeNotifications";
import { SocialLinks } from "./SocialLinks";
import { RoleImpersonationSelector } from "./RoleImpersonationSelector";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { useRoleImpersonation } from '@/hooks/useRoleImpersonation';
import { PlanBadge } from "./subscription/PlanBadge";

const Navbar = () => {
  const { user, signOut, isEmailVerified } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const listingType = searchParams.get("listingType");
  const { compareList } = usePropertyCompare();
  const { isAdmin, isSuperAdmin } = useAdminCheck();
  const { userRole, loading: roleLoading } = useUserRole();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { impersonatedRole, isImpersonating } = useRoleImpersonation();
  const { toast } = useToast();

  const effectiveRole = useMemo(() => 
    (isImpersonating && isSuperAdmin && impersonatedRole) ? impersonatedRole : userRole,
    [isImpersonating, isSuperAdmin, impersonatedRole, userRole]
  );

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const handleComprarClick = useCallback(() => {
    if (listingType === "venta") return;
    const params = new URLSearchParams(searchParams);
    params.set("listingType", "venta");
    navigate(`/buscar?${params.toString()}`);
  }, [listingType, searchParams, navigate]);

  const handleRentarClick = useCallback(() => {
    if (listingType === "renta") return;
    const params = new URLSearchParams(searchParams);
    params.set("listingType", "renta");
    navigate(`/buscar?${params.toString()}`);
  }, [listingType, searchParams, navigate]);

  const isComprarActive = !listingType || listingType === "venta";
  const isRentarActive = listingType === "renta";

  const handlePublicarClick = () => {
    if (!user) {
      navigate('/auth?redirect=/panel-agente&action=publicar');
      return;
    }
    if (roleLoading) return;
    if ((effectiveRole === 'agent' || effectiveRole === 'agency') && !isEmailVerified()) {
      toast({
        title: '⚠️ Email no verificado',
        description: 'Verifica tu email antes de publicar propiedades',
        variant: 'destructive',
      });
      navigate('/perfil?tab=profile');
      return;
    }
    
    switch(effectiveRole) {
      case 'agent':
        navigate('/panel-agente?tab=form');
        break;
      case 'agency':
        navigate('/panel-inmobiliaria?tab=form');
        break;
      case 'buyer':
        setShowUpgradeDialog(true);
        break;
      default:
        setShowUpgradeDialog(true);
        break;
    }
  };

  return (
    <>
      <ImpersonationBanner />
      {/* TIER S: Glassmorphism navbar */}
      <nav className="sticky top-0 z-50 w-full glass-morphism">
        <div className="container mx-auto px-4">
          {/* Desktop Navigation */}
          <div className="hidden md:grid grid-cols-3 h-16 items-center gap-4">
            {/* Left Navigation - Desktop */}
            <div className="flex items-center gap-1 justify-start">
              {/* TIER S: Animated underline on hover */}
              <Button 
                type="button"
                variant={isComprarActive ? "default" : "ghost"} 
                size="sm"
                className={`relative ${isComprarActive ? "shadow-sm" : "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform hover:after:scale-x-100"}`}
                onClick={handleComprarClick}
              >
                Comprar
              </Button>
              <Button 
                type="button"
                variant={isRentarActive ? "default" : "ghost"} 
                size="sm"
                className={`relative ${isRentarActive ? "shadow-sm" : "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform hover:after:scale-x-100"}`}
                onClick={handleRentarClick}
              >
                Rentar
              </Button>
            </div>

            {/* Center Logo - Desktop with hover effect */}
            <Link to="/" className="flex items-center justify-center shrink-0 group">
              <img 
                src={kentraLogo} 
                alt="Kentra" 
                className="h-12 transition-transform duration-300 group-hover:scale-105" 
              />
            </Link>

            {/* Right Navigation - Desktop */}
            <div className="flex items-center gap-3 justify-end">
              <RoleImpersonationSelector />
              <PublishPropertyButton size="sm" className="shadow-sm" />
              {user ? (
                <>
                  <PlanBadge />
                  <MessageBadge />
                  {isAdmin && (
                    <AdminRealtimeNotifications userId={user.id} isAdmin={isAdmin} />
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Menú de usuario">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                            {getUserInitials()}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Acciones Rápidas</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <Link to="/agentes">
                        <DropdownMenuItem className="cursor-pointer">
                          <Search className="mr-2 h-4 w-4" />
                          Buscar Inmobiliarias
                        </DropdownMenuItem>
                      </Link>
                      <Link to="/favoritos">
                        <DropdownMenuItem className="cursor-pointer">
                          <Heart className="mr-2 h-4 w-4" />
                          Favoritos
                        </DropdownMenuItem>
                      </Link>
                      <Link to="/comparar">
                        <DropdownMenuItem className="cursor-pointer">
                          <GitCompare className="mr-2 h-4 w-4" />
                          Comparar Propiedades
                          {compareList.length > 0 && (
                            <Badge variant="secondary" className="ml-auto">
                              {compareList.length}
                            </Badge>
                          )}
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {isAdmin && (
                        <>
                          <Link to="/admin/dashboard">
                            <DropdownMenuItem className="cursor-pointer">
                              <Badge className="mr-2 bg-purple-600">Admin</Badge>
                              Panel de Moderación
                            </DropdownMenuItem>
                          </Link>
                          {isSuperAdmin && (
                            <Link to="/admin/financiero">
                              <DropdownMenuItem className="cursor-pointer">
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Panel Financiero
                              </DropdownMenuItem>
                            </Link>
                          )}
                          {isSuperAdmin && (
                            <Link to="/admin/system-health">
                              <DropdownMenuItem className="cursor-pointer">
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Salud del Sistema
                              </DropdownMenuItem>
                            </Link>
                          )}
                          {isSuperAdmin && (
                            <Link to="/admin/subscriptions">
                              <DropdownMenuItem className="cursor-pointer">
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Gestión de Suscripciones
                              </DropdownMenuItem>
                            </Link>
                          )}
                          {isSuperAdmin && (
                            <Link to="/admin/churn">
                              <DropdownMenuItem className="cursor-pointer">
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Churn & Retención
                              </DropdownMenuItem>
                            </Link>
                          )}
                          {isSuperAdmin && (
                            <Link to="/admin/geocoding">
                              <DropdownMenuItem className="cursor-pointer">
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Geocodificación Masiva
                              </DropdownMenuItem>
                            </Link>
                          )}
                          {isSuperAdmin && (
                            <Link to="/admin/coupons">
                              <DropdownMenuItem className="cursor-pointer">
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Cupones y Descuentos
                              </DropdownMenuItem>
                            </Link>
                          )}
                          {isSuperAdmin && (
                            <>
                              <Link to="/admin/kpis">
                                <DropdownMenuItem className="cursor-pointer">
                                  <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                  KPIs de Negocio
                                </DropdownMenuItem>
                              </Link>
                              <Link to="/admin/marketing">
                                <DropdownMenuItem className="cursor-pointer">
                                  <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                  Dashboard de Marketing
                                </DropdownMenuItem>
                              </Link>
                            </>
                          )}
                          {isSuperAdmin && (
                            <Link to="/admin/roles">
                              <DropdownMenuItem className="cursor-pointer">
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Gestión de Roles
                              </DropdownMenuItem>
                            </Link>
                          )}
                          {isSuperAdmin && (
                            <Link to="/admin/role-audit">
                              <DropdownMenuItem className="cursor-pointer">
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Auditoría de Roles
                              </DropdownMenuItem>
                            </Link>
                          )}
                          {isSuperAdmin && (
                            <Link to="/admin/subscription-changes">
                              <DropdownMenuItem className="cursor-pointer">
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Panel de Auditoría
                              </DropdownMenuItem>
                            </Link>
                          )}
                          {isSuperAdmin && (
                            <Link to="/admin/notification-settings">
                              <DropdownMenuItem className="cursor-pointer">
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Notificaciones
                              </DropdownMenuItem>
                            </Link>
                          )}
                          <Link to="/admin/kyc">
                            <DropdownMenuItem className="cursor-pointer">
                              <Badge className="mr-2 bg-purple-600">Admin</Badge>
                              Verificaciones KYC
                            </DropdownMenuItem>
                          </Link>
                          {isSuperAdmin && (
                            <Link to="/admin/users">
                              <DropdownMenuItem className="cursor-pointer">
                                <Users className="mr-2 h-4 w-4" />
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Gestión de Usuarios
                              </DropdownMenuItem>
                            </Link>
                          )}
                          {isSuperAdmin && (
                            <Link to="/admin/plans">
                              <DropdownMenuItem className="cursor-pointer">
                                <DollarSign className="mr-2 h-4 w-4" />
                                <Badge className="mr-2 bg-purple-600">Admin</Badge>
                                Gestión de Planes
                              </DropdownMenuItem>
                            </Link>
                          )}
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <Link to="/perfil">
                        <DropdownMenuItem className="cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          Mi Perfil
                        </DropdownMenuItem>
                      </Link>
                      <Link to="/configuracion">
                        <DropdownMenuItem className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          Configuración
                        </DropdownMenuItem>
                      </Link>
                      {(effectiveRole === 'agent' || effectiveRole === 'agency') && (
                        <Link to={effectiveRole === 'agency' ? '/panel-inmobiliaria' : '/panel-agente'}>
                          <DropdownMenuItem className="cursor-pointer">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {effectiveRole === 'agency' ? 'Panel de Inmobiliaria' : 'Mis Propiedades'}
                          </DropdownMenuItem>
                        </Link>
                      )}
                      <Link to="/ayuda">
                        <DropdownMenuItem className="cursor-pointer">
                          <HelpCircle className="mr-2 h-4 w-4" />
                          Soporte
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar Sesión
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Link to="/auth">
                  <Button size="sm">Iniciar Sesión</Button>
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden h-16 items-center justify-between relative">
            <MobileMenu />
            
            <Link to="/" className="absolute left-1/2 -translate-x-1/2">
              <img src={kentraLogo} alt="Kentra" className="h-9" />
            </Link>
            
            <div className="flex items-center gap-2">
              <Button 
                size="icon" 
                variant="default" 
                className="h-9 w-9 shadow-sm"
                onClick={handlePublicarClick}
                aria-label="Publicar propiedad"
              >
                <PlusCircle className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Upgrade Dialog */}
      <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quieres publicar propiedades?</AlertDialogTitle>
            <AlertDialogDescription>
              Para publicar propiedades necesitas una cuenta de agente. Actualiza tu cuenta para acceder a todas las funciones profesionales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/pricing-agente')}>
              Ver Planes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Navbar;
