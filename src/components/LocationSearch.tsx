import { PlaceAutocomplete } from '@/components/PlaceAutocomplete';

interface LocationSearchProps {
  onLocationSelect: (location: {
    address: string;
    municipality: string;
    state: string;
    colonia?: string;
    lat?: number;
    lng?: number;
  }) => void;
  defaultValue?: string;
}

export const LocationSearch = ({ onLocationSelect, defaultValue }: LocationSearchProps) => {
  return (
    <PlaceAutocomplete
      onPlaceSelect={onLocationSelect}
      defaultValue={defaultValue}
      placeholder="Escribe para buscar dirección..."
      label="Dirección*"
      id="address"
    />
  );
};
