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
import { Home, Heart, User, PlusCircle, LogOut, Search, Building } from "lucide-react";
import { MessageBadge } from "./MessageBadge";
import { MobileMenu } from "./MobileMenu";
import { ThemeToggle } from "./ThemeToggle";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const listingType = searchParams.get("listingType");

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
            <Link to="/buscar">
              <Button variant="ghost" size="sm">
                <Search className="h-4 w-4 mr-2" />
                Buscar Inmobiliarias
              </Button>
            </Link>
            {user ? (
              <>
                <MessageBadge />
                <Link to="/favoritos">
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Heart className="h-5 w-5" />
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
                    <div className="px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Tema</span>
                        <ThemeToggle />
                      </div>
                    </div>
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
                <ThemeToggle />
                <Link to="/auth">
                  <Button size="sm">Iniciar Sesión</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            <MobileMenu />
            {user ? (
              <>
                <MessageBadge />
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
