/**
 * ✅ Grid OPTIMIZADO con React.memo para evitar re-renders innecesarios
 * Usado en Home, Buscar, Favorites para grids masivos
 */

import { memo } from 'react';
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

const VirtualizedPropertyGridComponent = ({ 
  properties,
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

// ✅ Memoizado para evitar re-renders cuando props no cambian
export const VirtualizedPropertyGrid = memo(VirtualizedPropertyGridComponent);
