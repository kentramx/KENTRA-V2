import { Link } from "react-router-dom";
import { SocialLinks } from "./SocialLinks";
import { SentryTestButton } from "./SentryTestButton";
import kentraLogo from "@/assets/kentra-logo.png";

export const Footer = () => {
  return (
    <footer className="bg-muted/30 border-t border-border mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
          {/* Kentra Info */}
          <div>
            <img src={kentraLogo} alt="Kentra" className="h-8 mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              La plataforma líder en México para comprar, vender y rentar propiedades.
            </p>
            <div>
              <p className="text-sm font-semibold mb-2">Síguenos</p>
              <SocialLinks />
            </div>
          </div>

          {/* Enlaces Rápidos */}
          <div>
            <h4 className="font-semibold mb-4">Enlaces Rápidos</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/buscar" className="text-muted-foreground hover:text-foreground transition-colors">
                  Buscar Propiedades
                </Link>
              </li>
              <li>
                <Link to="/publicar" className="text-muted-foreground hover:text-foreground transition-colors">
                  Publicar Propiedad
                </Link>
              </li>
              <li>
                <Link to="/agentes" className="text-muted-foreground hover:text-foreground transition-colors">
                  Directorio de Agentes
                </Link>
              </li>
              <li>
                <Link to="/leaderboard" className="text-muted-foreground hover:text-foreground transition-colors">
                  Leaderboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Para Agentes */}
          <div>
            <h4 className="font-semibold mb-4">Para Agentes</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/pricing-agente" className="text-muted-foreground hover:text-foreground transition-colors">
                  Planes para Agentes
                </Link>
              </li>
              <li>
                <Link to="/pricing-inmobiliaria" className="text-muted-foreground hover:text-foreground transition-colors">
                  Planes para Inmobiliarias
                </Link>
              </li>
              <li>
                <Link to="/pricing-desarrolladora" className="text-muted-foreground hover:text-foreground transition-colors">
                  Plan Desarrolladora
                </Link>
              </li>
              <li>
                <Link to="/panel-agente" className="text-muted-foreground hover:text-foreground transition-colors">
                  Panel de Agente
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Copyright */}
        <div className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <div className="flex justify-center items-center gap-4 mb-3">
            <p>© {new Date().getFullYear()} Kentra. Todos los derechos reservados.</p>
            <SentryTestButton />
          </div>
        </div>
      </div>
    </footer>
  );
};
