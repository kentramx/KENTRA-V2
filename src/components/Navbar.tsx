import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const Navbar = () => {
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const listingType = searchParams.get("listingType");
  const { compareList } = usePropertyCompare();
  const { isAdmin, isSuperAdmin } = useAdminCheck();

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

  return (
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
          <div className="hidden md:flex items-center gap-1">
            <Link to="/agentes">
              <Button variant="ghost" size="sm">
                <Search className="h-4 w-4 mr-2" />
                Buscar Inmobiliarias
              </Button>
            </Link>
            <Button
              size="sm" 
              className="shadow-sm"
              onClick={() => navigate('/publicar')}
            >
              <Building className="h-4 w-4 mr-2" />
              Publicar Propiedad
            </Button>
            {user ? (
              <>
                <MessageBadge />
                <Link to="/favoritos">
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Heart className="h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/comparar">
                  <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                    <GitCompare className="h-5 w-5" />
                    {compareList.length > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      >
                        {compareList.length}
                      </Badge>
                    )}
                  </Button>
                </Link>
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
              onClick={() => navigate('/publicar')}
            >
              <Building className="h-5 w-5" />
            </Button>
            {user ? (
              <>
                <MessageBadge />
                {isAdmin && (
                  <AdminRealtimeNotifications userId={user.id} isAdmin={isAdmin} />
                )}
                <Link to="/comparar">
                  <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                    <GitCompare className="h-5 w-5" />
                    {compareList.length > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      >
                        {compareList.length}
                      </Badge>
                    )}
                  </Button>
                </Link>
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
    </nav>
  );
};

export default Navbar;
