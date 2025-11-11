import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
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
import { Home, Heart, User, PlusCircle, LogOut, Search, Building, GitCompare, Settings, DollarSign } from "lucide-react";
import { MessageBadge } from "./MessageBadge";
import { MobileMenu } from "./MobileMenu";
import { ThemeToggle } from "./ThemeToggle";
import { usePropertyCompare } from "@/hooks/usePropertyCompare";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { AdminRealtimeNotifications } from "./AdminRealtimeNotifications";
import { SocialLinks } from "./SocialLinks";
import { RoleImpersonationSelector } from "./RoleImpersonationSelector";
import { ImpersonationBanner } from "./ImpersonationBanner";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const listingType = searchParams.get("listingType");
  const { compareList } = usePropertyCompare();
  const { isAdmin, isSuperAdmin } = useAdminCheck();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  useEffect(() => {
    if (user) {
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          setUserRole(data?.role || 'buyer');
        });
    }
  }, [user]);

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const handleComprarClick = () => {
    const params = new URLSearchParams(searchParams);
    params.set("listingType", "venta");
    navigate(`/buscar?${params.toString()}`, { replace: true });
  };

  const handleRentarClick = () => {
    const params = new URLSearchParams(searchParams);
    params.set("listingType", "renta");
    navigate(`/buscar?${params.toString()}`, { replace: true });
  };

  const isComprarActive = !listingType || listingType === "venta";
  const isRentarActive = listingType === "renta";

  const handlePublicarClick = () => {
    if (!user) {
      navigate('/auth?redirect=/panel-agente&action=publicar');
      return;
    }
    
    // Usuario autenticado - verificar rol y redirigir
    switch(userRole) {
      case 'agent':
        navigate('/panel-agente?tab=form');
        break;
      case 'agency':
        navigate('/panel-inmobiliaria?tab=form');
        break;
      case 'buyer':
      default:
        setShowUpgradeDialog(true);
        break;
    }
  };

  return (
    <>
      <ImpersonationBanner />
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">
          {/* Left Navigation - Desktop */}
          <div className="hidden md:flex items-center gap-1">
            <Button 
              variant={isComprarActive ? "default" : "ghost"} 
              size="sm"
              className={isComprarActive ? "shadow-sm" : ""}
              onClick={handleComprarClick}
            >
              Comprar
            </Button>
            <Button 
              variant={isRentarActive ? "default" : "ghost"} 
              size="sm"
              className={isRentarActive ? "shadow-sm" : ""}
              onClick={handleRentarClick}
            >
              Rentar
            </Button>
          </div>

          {/* Center Logo - Always visible */}
          <Link to="/" className="flex items-center space-x-2 shrink-0">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-primary">Kentra</span>
          </Link>

          {/* Right Navigation - Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <RoleImpersonationSelector />
            <Button
              size="sm" 
              className="shadow-sm"
              onClick={handlePublicarClick}
            >
              <Building className="h-4 w-4 mr-2" />
              Publicar Propiedad
            </Button>
            {user ? (
              <>
                <MessageBadge />
                {isAdmin && (
                  <AdminRealtimeNotifications userId={user.id} isAdmin={isAdmin} />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
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
                          <Link to="/admin/kpis">
                            <DropdownMenuItem className="cursor-pointer">
                              <Badge className="mr-2 bg-purple-600">Admin</Badge>
                              KPIs de Negocio
                            </DropdownMenuItem>
                          </Link>
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
                    <Link to="/panel-agente">
                      <DropdownMenuItem className="cursor-pointer">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Mis Propiedades
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
              <>
                <Link to="/auth">
                  <Button size="sm">Iniciar Sesión</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            <MobileMenu />
            <Button 
              size="icon" 
              variant="default" 
              className="h-9 w-9 shadow-sm"
              onClick={handlePublicarClick}
            >
              <Building className="h-5 w-5" />
            </Button>
            {user ? (
              <>
                <MessageBadge />
                {isAdmin && (
                  <AdminRealtimeNotifications userId={user.id} isAdmin={isAdmin} />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
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
                          <Link to="/admin/kpis">
                            <DropdownMenuItem className="cursor-pointer">
                              <Badge className="mr-2 bg-purple-600">Admin</Badge>
                              KPIs de Negocio
                            </DropdownMenuItem>
                          </Link>
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
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <Link to="/perfil">
                      <DropdownMenuItem className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Mi Perfil
                      </DropdownMenuItem>
                    </Link>
                    <Link to="/panel-agente">
                      <DropdownMenuItem className="cursor-pointer">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Mis Propiedades
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
      </div>

      {/* Upgrade Dialog for Buyers */}
      <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conviértete en Agente o Inmobiliaria</AlertDialogTitle>
            <AlertDialogDescription>
              Para publicar propiedades necesitas cambiar tu tipo de cuenta a agente o inmobiliaria.
              Puedes hacerlo desde tu configuración o ver los planes disponibles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button 
              variant="outline"
              onClick={() => {
                setShowUpgradeDialog(false);
                navigate('/configuracion?section=account');
              }}
            >
              Cambiar Tipo de Cuenta
            </Button>
            <AlertDialogAction onClick={() => {
              setShowUpgradeDialog(false);
              navigate('/publicar');
            }}>
              Ver Planes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
    </>
  );
};

export default Navbar;
