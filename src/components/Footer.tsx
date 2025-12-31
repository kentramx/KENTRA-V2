import { Link } from "react-router-dom";
import { SocialLinks } from "./SocialLinks";
import kentraLogo from "@/assets/kentra-logo.png";
import { NewsletterForm } from "./NewsletterForm";
import { MapPin, Mail, Phone } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="relative bg-foreground text-background/90">
      {/* TIER S: Decorative gradient top border */}
      <div className="absolute top-0 left-0 right-0 h-1 gradient-hero-olive" />
      
      <div className="container mx-auto px-4 py-12 md:py-16">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
          {/* Kentra Brand Column */}
          <div className="col-span-2 md:col-span-1 lg:col-span-1">
            <img 
              src={kentraLogo} 
              alt="Kentra" 
              className="h-10 mb-4 brightness-0 invert opacity-90" 
            />
            <p className="text-sm text-background/60 mb-6 leading-relaxed">
              La plataforma inmobiliaria líder en México para comprar, vender y rentar propiedades.
            </p>
            <div className="space-y-3 text-sm text-background/60">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <a href="mailto:soporte@kentra.com.mx" className="hover:text-background transition-colors">
                  soporte@kentra.com.mx
                </a>
              </div>
            </div>
          </div>

          {/* Enlaces Rápidos */}
          <div>
            <h4 className="font-semibold text-background mb-4 text-sm uppercase tracking-wider">Explorar</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/buscar" className="text-background/60 hover:text-background transition-colors">
                  Buscar Propiedades
                </Link>
              </li>
              <li>
                <Link to="/publicar" className="text-background/60 hover:text-background transition-colors">
                  Publicar Propiedad
                </Link>
              </li>
              <li>
                <Link to="/agentes" className="text-background/60 hover:text-background transition-colors">
                  Directorio de Agentes
                </Link>
              </li>
              <li>
                <Link to="/leaderboard" className="text-background/60 hover:text-background transition-colors">
                  Leaderboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Para Profesionales */}
          <div>
            <h4 className="font-semibold text-background mb-4 text-sm uppercase tracking-wider">Profesionales</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/pricing-agente" className="text-background/60 hover:text-background transition-colors">
                  Planes Agentes
                </Link>
              </li>
              <li>
                <Link to="/pricing-inmobiliaria" className="text-background/60 hover:text-background transition-colors">
                  Planes Inmobiliarias
                </Link>
              </li>
              <li>
                <Link to="/pricing-desarrolladora" className="text-background/60 hover:text-background transition-colors">
                  Plan Desarrolladora
                </Link>
              </li>
              <li>
                <Link to="/panel-agente" className="text-background/60 hover:text-background transition-colors">
                  Panel de Agente
                </Link>
              </li>
            </ul>
          </div>

          {/* Soporte */}
          <div>
            <h4 className="font-semibold text-background mb-4 text-sm uppercase tracking-wider">Soporte</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/ayuda" className="text-background/60 hover:text-background transition-colors">
                  Centro de Ayuda
                </Link>
              </li>
              <li>
                <Link to="/privacidad" className="text-background/60 hover:text-background transition-colors">
                  Política de Privacidad
                </Link>
              </li>
              <li>
                <Link to="/terminos" className="text-background/60 hover:text-background transition-colors">
                  Términos de Servicio
                </Link>
              </li>
            </ul>
          </div>

          {/* Social & Newsletter */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <h4 className="font-semibold text-background mb-4 text-sm uppercase tracking-wider">Síguenos</h4>
            <div className="mb-6">
              <SocialLinks />
            </div>
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="py-8 border-t border-background/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <h4 className="font-semibold text-background mb-1">Suscríbete a nuestro newsletter</h4>
              <p className="text-sm text-background/60">Recibe las últimas propiedades y novedades</p>
            </div>
            <div className="w-full md:w-auto">
              <NewsletterForm />
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-background/10 text-center text-background/50 text-sm">
          <p>© {new Date().getFullYear()} Kentra. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};
