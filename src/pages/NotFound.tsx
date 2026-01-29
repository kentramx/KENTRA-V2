import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { monitoring } from "@/lib/monitoring";
import { Button } from "@/components/ui/button";
import { Home, Search, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    monitoring.warn("404 Error: User attempted to access non-existent route", {
      page: "NotFound",
      pathname: location.pathname,
    });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in-up">
        {/* Large 404 number with gradient */}
        <div className="relative">
          <span className="text-[10rem] md:text-[12rem] font-bold leading-none bg-gradient-to-br from-primary/20 to-primary/5 bg-clip-text text-transparent select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center animate-pulse-soft">
              <Search className="w-10 h-10 text-primary" />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Página no encontrada
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-sm mx-auto">
            Lo sentimos, la página que buscas no existe o ha sido movida.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button asChild size="lg" className="gap-2">
            <Link to="/">
              <Home className="w-4 h-4" />
              Ir al Inicio
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link to="/buscar">
              <Search className="w-4 h-4" />
              Buscar Propiedades
            </Link>
          </Button>
        </div>

        {/* Back link */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la página anterior
        </button>

        {/* Debug info (only in dev) */}
        {import.meta.env.DEV && (
          <p className="text-xs text-muted-foreground/50 font-mono">
            Ruta intentada: {location.pathname}
          </p>
        )}
      </div>
    </div>
  );
};

export default NotFound;
