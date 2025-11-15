import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Home, Building2, Mountain, Briefcase, Store, Warehouse, Building, Trees } from 'lucide-react';

interface PropertyTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const propertyTypes = [
  { value: 'casa', label: 'Casa', icon: Home },
  { value: 'departamento', label: 'Departamento', icon: Building2 },
  { value: 'terreno', label: 'Terreno', icon: Mountain },
  { value: 'oficina', label: 'Oficina', icon: Briefcase },
  { value: 'local', label: 'Local', icon: Store },
  { value: 'bodega', label: 'Bodega', icon: Warehouse },
  { value: 'edificio', label: 'Edificio', icon: Building },
  { value: 'rancho', label: 'Rancho', icon: Trees },
];

export const PropertyTypeSelector = ({ value, onChange }: PropertyTypeSelectorProps) => {
  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-1">
        Tipo de Propiedad
        <span className="text-destructive">*</span>
      </Label>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {propertyTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = value === type.value;
          
          return (
            <Card
              key={type.value}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary bg-primary/5"
              )}
              onClick={() => onChange(type.value)}
            >
              <div className="flex flex-col items-center justify-center p-4 gap-2">
                <Icon className={cn(
                  "w-8 h-8",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm font-medium text-center",
                  isSelected ? "text-primary" : "text-foreground"
                )}>
                  {type.label}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
