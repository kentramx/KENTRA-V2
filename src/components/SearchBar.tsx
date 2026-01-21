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
      <div className="group relative mx-auto flex w-full items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 p-1 md:p-1.5 focus-within:ring-2 focus-within:ring-white/40 transition-all">
        <div className="flex-1 min-w-0">
          <PlaceAutocomplete
            onPlaceSelect={onPlaceSelect}
            placeholder={placeholder}
            defaultValue={defaultValue}
            showIcon
            unstyled
            inputClassName="bg-transparent text-white placeholder:text-white/60 h-9 md:h-10 text-sm"
            iconClassName="text-white/70"
          />
        </div>
        <Button
          onClick={onSearch}
          className="shrink-0 rounded-full h-9 md:h-10 px-4 md:px-5 font-semibold shadow-md hover:shadow-lg transition-all duration-300 text-sm"
        >
          <Search className="h-4 w-4 md:mr-1.5" />
          <span className="hidden md:inline">Buscar</span>
        </Button>
      </div>
    </div>
  );
};
