import PropertyCard from './PropertyCard';

interface Property {
  id: string;
  title: string;
  price: number;
  type: string;
  listing_type: string;
  address: string;
  municipality: string;
  state: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  sqft?: number;
  images?: { url: string; position: number }[];
  agent_id: string;
  is_featured?: boolean;
  currency?: string;
}

interface VirtualizedPropertyGridProps {
  properties: Property[];
}

/**
 * Grid optimizado para renderizar miles de propiedades
 */
export const VirtualizedPropertyGrid = ({ 
  properties
}: VirtualizedPropertyGridProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          {...property}
          agentId={property.agent_id}
          isFeatured={property.is_featured}
        />
      ))}
    </div>
  );
};
