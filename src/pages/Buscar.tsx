import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MapPin, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function Buscar() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8 p-6 rounded-full bg-primary/10 w-fit mx-auto">
            <MapPin className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Buscador de Propiedades</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Estamos trabajando en una nueva experiencia de búsqueda con mapas interactivos.
            Próximamente podrás explorar propiedades de forma visual.
          </p>
          <Button onClick={() => navigate("/")} variant="outline" size="lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
