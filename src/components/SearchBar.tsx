import React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";

interface SearchBarProps {
  onPlaceSelect: (location: {
    address: string;
    municipality: string;
    state: string;
    lat?: number;
    lng?: number;
  }) => void;
  onSearch: () => void;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onPlaceSelect,
  onSearch,
  placeholder = "Ciudad, colonia o código postal",
  defaultValue = "",
  className = "",
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="group relative mx-auto flex w-full items-center gap-2 rounded-full bg-white border border-border shadow-sm p-1.5 md:p-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
        <div className="flex-1 min-w-0 text-foreground">
          <PlaceAutocomplete
            onPlaceSelect={onPlaceSelect}
            placeholder={placeholder}
            defaultValue={defaultValue}
            showIcon
            unstyled
          />
        </div>
        <Button
          onClick={onSearch}
          className="shrink-0 rounded-full h-9 md:h-11 px-3 md:px-6 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <Search className="h-4 w-4 md:h-5 md:w-5 md:mr-2" />
          <span className="hidden md:inline">Buscar</span>
        </Button>
      </div>
    </div>
  );
};
