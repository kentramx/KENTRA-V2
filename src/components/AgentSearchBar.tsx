import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { mexicoStates, mexicoMunicipalities } from "@/data/mexicoLocations";
import { Filter, ArrowUpDown } from "lucide-react";

interface AgentSearchBarProps {
  filters: {
    state: string;
    municipality: string;
    type: string;
    minRating: number;
    minProperties: number;
    plan: string;
  };
  onFiltersChange: (filters: any) => void;
  sortBy: "active" | "rating" | "recent";
  onSortChange: (sort: "active" | "rating" | "recent") => void;
}

const AgentSearchBar: React.FC<AgentSearchBarProps> = ({
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
}) => {
  const municipalities = filters.state ? mexicoMunicipalities[filters.state] || [] : [];

  const handleStateChange = (value: string) => {
    onFiltersChange({
      ...filters,
      state: value === "all" ? "" : value,
      municipality: "", // Reset municipality when state changes
    });
  };

  const handleFilterChange = (key: string, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: key === "municipality" && value === "all" ? "" : value,
    });
  };

  return (
    <div className="bg-card border rounded-lg p-6 mb-8 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Filtros de búsqueda</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Estado */}
        <div className="space-y-2">
          <Label htmlFor="state">Estado</Label>
          <Select value={filters.state || "all"} onValueChange={handleStateChange}>
            <SelectTrigger id="state">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {mexicoStates.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Municipio */}
        <div className="space-y-2">
          <Label htmlFor="municipality">Municipio/Ciudad</Label>
          <Select
            value={filters.municipality || "all"}
            onValueChange={(value) => handleFilterChange("municipality", value)}
            disabled={!filters.state}
          >
            <SelectTrigger id="municipality">
              <SelectValue placeholder="Todos los municipios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los municipios</SelectItem>
              {municipalities.map((municipality) => (
                <SelectItem key={municipality} value={municipality}>
                  {municipality}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tipo */}
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <Select value={filters.type} onValueChange={(value) => handleFilterChange("type", value)}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="agent">Solo Agentes</SelectItem>
              <SelectItem value="agency">Solo Inmobiliarias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Calificación mínima */}
        <div className="space-y-2">
          <Label htmlFor="minRating">Calificación mínima</Label>
          <Select
            value={filters.minRating.toString()}
            onValueChange={(value) => handleFilterChange("minRating", parseFloat(value))}
          >
            <SelectTrigger id="minRating">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todas las calificaciones</SelectItem>
              <SelectItem value="3">3★ o más</SelectItem>
              <SelectItem value="4">4★ o más</SelectItem>
              <SelectItem value="4.5">4.5★ o más</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Propiedades mínimas */}
        <div className="space-y-2">
          <Label htmlFor="minProperties">Propiedades mínimas</Label>
          <Select
            value={filters.minProperties.toString()}
            onValueChange={(value) => handleFilterChange("minProperties", parseInt(value))}
          >
            <SelectTrigger id="minProperties">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sin mínimo</SelectItem>
              <SelectItem value="5">5 o más</SelectItem>
              <SelectItem value="10">10 o más</SelectItem>
              <SelectItem value="20">20 o más</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Plan */}
        <div className="space-y-2">
          <Label htmlFor="plan">Plan</Label>
          <Select value={filters.plan} onValueChange={(value) => handleFilterChange("plan", value)}>
            <SelectTrigger id="plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los planes</SelectItem>
              <SelectItem value="pro_elite">Solo Pro/Elite</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Ordenamiento */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="sort" className="text-sm font-normal">
              Ordenar por:
            </Label>
          </div>
          <Select value={sortBy} onValueChange={(value: any) => onSortChange(value)}>
            <SelectTrigger id="sort" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Más activos</SelectItem>
              <SelectItem value="rating">Mejor calificados</SelectItem>
              <SelectItem value="recent">Más recientes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default AgentSearchBar;
