import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { MapPin } from "lucide-react";

interface AgentSearchBarProps {
  filters: {
    state: string;
    municipality: string;
    type: string;
    minRating: number;
    minProperties: number;
    plan: string;
  };
  onFiltersChange: (filters: AgentSearchBarProps['filters']) => void;
  sortBy: "active" | "rating" | "recent";
  onSortChange: (sort: "active" | "rating" | "recent") => void;
}

const AgentSearchBar: React.FC<AgentSearchBarProps> = ({
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
}) => {
  const [locationText, setLocationText] = useState("");

  const handleLocationSelect = (place: { state?: string; municipality?: string; address?: string }) => {
    onFiltersChange({
      ...filters,
      state: place.state || "",
      municipality: place.municipality || "",
    });
    setLocationText(place.address || "");
  };

  const handleFilterChange = (key: string, value: string | number) => {
    onFiltersChange({
      ...filters,
      [key]: value === "all" ? (key === "type" ? "all" : key === "minRating" ? 0 : "") : value,
    });
  };

  return (
    <div className="mb-8">
      <div className="flex flex-col lg:flex-row gap-3 items-center">
        {/* Location Search */}
        <div className="flex-1 w-full lg:w-auto">
          <PlaceAutocomplete
            onPlaceSelect={handleLocationSelect}
            defaultValue={locationText}
            placeholder="Ciudad, código postal..."
            id="agent-location-search"
            showIcon={true}
          />
        </div>

        {/* Tipo */}
        <Select value={filters.type} onValueChange={(value) => handleFilterChange("type", value)}>
          <SelectTrigger className="w-full lg:w-[140px] h-12 rounded-full border-border">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="agent">Agentes</SelectItem>
            <SelectItem value="agency">Inmobiliarias</SelectItem>
          </SelectContent>
        </Select>

        {/* Calificación */}
        <Select
          value={filters.minRating.toString()}
          onValueChange={(value) => handleFilterChange("minRating", parseFloat(value))}
        >
          <SelectTrigger className="w-full lg:w-[160px] h-12 rounded-full border-border">
            <SelectValue placeholder="Calificación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Cualquiera</SelectItem>
            <SelectItem value="3">3★ o más</SelectItem>
            <SelectItem value="4">4★ o más</SelectItem>
            <SelectItem value="4.5">4.5★ o más</SelectItem>
          </SelectContent>
        </Select>

        {/* Ordenar por */}
        <Select value={sortBy} onValueChange={(value: "active" | "rating" | "recent") => onSortChange(value)}>
          <SelectTrigger className="w-full lg:w-[160px] h-12 rounded-full border-border">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Más activos</SelectItem>
            <SelectItem value="rating">Mejor calificados</SelectItem>
            <SelectItem value="recent">Más recientes</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default AgentSearchBar;
