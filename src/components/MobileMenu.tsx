import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, Home, Search, Heart, PlusCircle, User, LogOut } from "lucide-react";
import { SocialLinks } from "./SocialLinks";
import kentraLogo from "@/assets/kentra-logo.png";

export function MobileMenu() {
  const { user, signOut } = useAuth();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-center">
            <img src={kentraLogo} alt="Kentra" className="h-7" />
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col gap-2 mt-6">
          <Link to="/buscar">
            <Button variant="ghost" className="w-full justify-start min-h-[48px]">
              <Home className="mr-2 h-5 w-5" />
              Propiedades
            </Button>
          </Link>
          
          <Link to="/buscar">
            <Button variant="ghost" className="w-full justify-start min-h-[48px]">
              <Search className="mr-2 h-5 w-5" />
              Buscar con Mapa
            </Button>
          </Link>

          <Link to="/agentes">
            <Button variant="ghost" className="w-full justify-start min-h-[48px]">
              <Search className="mr-2 h-5 w-5" />
              Buscar Inmobiliarias
            </Button>
          </Link>

          <Link to="/leaderboard">
            <Button variant="ghost" className="w-full justify-start min-h-[48px]">
              Leaderboard
            </Button>
          </Link>

          {user ? (
            <>
              <Link to="/favoritos">
                <Button variant="ghost" className="w-full justify-start min-h-[48px]">
                  <Heart className="mr-2 h-5 w-5" />
                  Favoritos
                </Button>
              </Link>
              
              <Link to="/panel-agente">
                <Button variant="ghost" className="w-full justify-start min-h-[48px]">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Mis Propiedades
                </Button>
              </Link>
              
              <Link to="/perfil">
                <Button variant="ghost" className="w-full justify-start min-h-[48px]">
                  <User className="mr-2 h-5 w-5" />
                  Mi Perfil
                </Button>
              </Link>

              <Button
                variant="ghost"
                className="w-full justify-start min-h-[48px] text-destructive"
                onClick={signOut}
              >
                <LogOut className="mr-2 h-5 w-5" />
                Cerrar Sesión
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button className="w-full min-h-[48px]">Iniciar Sesión</Button>
            </Link>
          )}

          <div className="pt-4 border-t border-border">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Síguenos</span>
              <SocialLinks />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
