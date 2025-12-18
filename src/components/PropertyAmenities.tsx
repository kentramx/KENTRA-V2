import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wifi,
  Tv,
  Wind,
  Waves,
  Car,
  Trees,
  Dumbbell,
  Shield,
  Camera,
  Sun,
  Droplets,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";

interface Amenity {
  category: string;
  items: string[];
}

interface PropertyAmenitiesProps {
  amenities: string[] | Amenity[];
}

const AMENITY_ICONS: Record<string, any> = {
  Interior: Lightbulb,
  Exterior: Trees,
  Servicios: Wifi,
  Seguridad: Shield,
  Recreación: Dumbbell,
};

const ITEM_ICONS: Record<string, any> = {
  "WiFi": Wifi,
  "Internet": Wifi,
  "TV por cable": Tv,
  "Aire acondicionado": Wind,
  "Calefacción": Sun,
  "Piscina": Waves,
  "Alberca": Waves,
  "Estacionamiento": Car,
  "Jardín": Trees,
  "Gimnasio": Dumbbell,
  "Seguridad 24/7": Shield,
  "Cámaras de seguridad": Camera,
  "Agua": Droplets,
};

export const PropertyAmenities = ({ amenities }: PropertyAmenitiesProps) => {
  if (!amenities || !Array.isArray(amenities) || amenities.length === 0) {
    return null;
  }

  // Detectar si es array simple de strings
  const isSimpleArray = typeof amenities[0] === 'string';

  if (isSimpleArray) {
    // Renderizar lista simple de amenidades
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Amenidades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(amenities as string[]).map((item, index) => {
              const ItemIcon = ITEM_ICONS[item] || CheckCircle2;
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <ItemIcon className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Renderizar con categorías (formato estructurado)
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Amenidades</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {(amenities as Amenity[]).map((amenityGroup, index) => {
            // Validación defensiva
            if (!amenityGroup?.items || !Array.isArray(amenityGroup.items)) {
              return null;
            }
            
            const CategoryIcon = AMENITY_ICONS[amenityGroup.category] || CheckCircle2;
            
            return (
              <div key={index}>
                <div className="flex items-center gap-2 mb-3">
                  <CategoryIcon className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">{amenityGroup.category}</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {amenityGroup.items.map((item, itemIndex) => {
                    const ItemIcon = ITEM_ICONS[item] || CheckCircle2;
                    
                    return (
                      <div
                        key={itemIndex}
                        className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <ItemIcon className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm">{item}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
