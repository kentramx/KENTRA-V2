import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlaceAutocomplete } from "./PlaceAutocomplete";

interface LocationData {
  address: string;
  municipality: string;
  state: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export function HeaderSearchBar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [transactionType, setTransactionType] = useState<string>("all");
  const [propertyType, setPropertyType] = useState<string>("all");
  const [searchText, setSearchText] = useState("");

  const handlePlaceSelect = (place: {
    address: string;
    municipality: string;
    state: string;
    lat?: number;
    lng?: number;
  }) => {
    if (place.lat && place.lng) {
      const location = {
        address: place.address,
        municipality: place.municipality,
        state: place.state,
        coordinates: { lat: place.lat, lng: place.lng },
      };
      setSelectedLocation(location);
      setSearchText(location.address);
    }
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    
    if (selectedLocation) {
      params.append("ubicacion", selectedLocation.address);
      if (selectedLocation.municipality) {
        params.append("municipio", selectedLocation.municipality);
      }
      if (selectedLocation.state) {
        params.append("estado", selectedLocation.state);
      }
      if (selectedLocation.coordinates) {
        params.append("lat", selectedLocation.coordinates.lat.toString());
        params.append("lng", selectedLocation.coordinates.lng.toString());
      }
    }
    
    if (transactionType !== "all") {
      params.append("tipo", transactionType);
    }
    
    if (propertyType !== "all") {
      params.append("propiedad", propertyType);
    }

    setIsOpen(false);
    navigate(`/buscar?${params.toString()}`);
  };

  return (
    <div className="flex-1 max-w-2xl">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-11 px-4 text-muted-foreground hover:text-foreground bg-background hover:bg-accent"
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span className="text-sm">
                {searchText || "Buscar ubicación, propiedad..."}
              </span>
            </div>
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-6" align="start">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Ubicación
              </label>
              <PlaceAutocomplete
                onPlaceSelect={handlePlaceSelect}
                placeholder="Buscar ubicación..."
                defaultValue={searchText}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Tipo de operación
                </label>
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="renta">Renta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Tipo de propiedad
                </label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="casa">Casa</SelectItem>
                    <SelectItem value="departamento">Departamento</SelectItem>
                    <SelectItem value="terreno">Terreno</SelectItem>
                    <SelectItem value="oficina">Oficina</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSearch} className="w-full">
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
