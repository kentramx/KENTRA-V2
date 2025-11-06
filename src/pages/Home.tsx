import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Home as HomeIcon, Building2, TreePine } from "lucide-react";
import Navbar from "@/components/Navbar";
import heroBackground from "@/assets/hero-background.jpg";

const Home = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = () => {
    navigate(`/propiedades?busqueda=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section
        className="relative flex min-h-[600px] items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/30" />
        <div className="container relative z-10 mx-auto px-4 text-center text-white">
          <h1 className="mb-4 text-5xl font-bold md:text-6xl">
            Encuentra Tu Hogar Ideal
          </h1>
          <p className="mb-8 text-xl md:text-2xl">
            Miles de propiedades en México esperándote
          </p>

          {/* Search Bar */}
          <div className="mx-auto max-w-3xl">
            <div className="flex gap-2 rounded-lg bg-white p-2 shadow-2xl">
              <div className="flex flex-1 items-center gap-2 px-4">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Ciudad, colonia o código postal"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="border-0 bg-transparent text-foreground focus-visible:ring-0"
                />
              </div>
              <Button
                onClick={handleSearch}
                size="lg"
                className="bg-secondary hover:bg-secondary/90"
              >
                <Search className="mr-2 h-5 w-5" />
                Buscar
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Property Types */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold">
            Explora por Tipo de Propiedad
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <button
              onClick={() => navigate("/propiedades?tipo=casa")}
              className="group flex flex-col items-center rounded-xl border border-border p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <HomeIcon className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Casas</h3>
              <p className="mt-2 text-muted-foreground">
                Encuentra tu casa perfecta
              </p>
            </button>

            <button
              onClick={() => navigate("/propiedades?tipo=departamento")}
              className="group flex flex-col items-center rounded-xl border border-border p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <Building2 className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Departamentos</h3>
              <p className="mt-2 text-muted-foreground">
                Vida urbana moderna
              </p>
            </button>

            <button
              onClick={() => navigate("/propiedades?tipo=terreno")}
              className="group flex flex-col items-center rounded-xl border border-border p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <TreePine className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Terrenos</h3>
              <p className="mt-2 text-muted-foreground">
                Construye tu proyecto
              </p>
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">¿Tienes una Propiedad?</h2>
          <p className="mb-8 text-xl text-muted-foreground">
            Publica tu propiedad y llega a miles de compradores potenciales
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/publicar")}
            className="bg-secondary hover:bg-secondary/90"
          >
            Publicar Gratis
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 Kentra. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
