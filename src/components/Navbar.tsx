import { Link } from "react-router-dom";
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
import { HeaderSearchBar } from "./HeaderSearchBar";
import { MobileMenu } from "./MobileMenu";
import { ThemeToggle } from "./ThemeToggle";

const Navbar = () => {
  const { user, signOut } = useAuth();

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 shrink-0">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-primary hidden sm:inline">Kentra</span>
          </Link>

          {/* Search Bar - Desktop Only */}
          <div className="hidden md:flex flex-1 justify-center">
            <HeaderSearchBar />
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-1">
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
                    <Link to="/propiedades">
                      <DropdownMenuItem className="cursor-pointer">
                        <Building className="mr-2 h-4 w-4" />
                        Ver Propiedades
                      </DropdownMenuItem>
                    </Link>
                    <Link to="/buscar">
                      <DropdownMenuItem className="cursor-pointer">
                        <Search className="mr-2 h-4 w-4" />
                        Búsqueda Avanzada
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
            {user && <MessageBadge />}
            <MobileMenu />
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden pb-3">
          <HeaderSearchBar />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
