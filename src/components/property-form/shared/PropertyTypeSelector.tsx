import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  PROPERTY_TYPES, 
  PROPERTY_CATEGORIES, 
  getPropertyTypesByCategory,
  PropertyCategory 
} from '@/config/propertyTypes';

interface PropertyTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const CATEGORY_ORDER: PropertyCategory[] = ['residencial', 'comercial', 'industrial', 'terrenos', 'desarrollos'];

export const PropertyTypeSelector = ({ value, onChange }: PropertyTypeSelectorProps) => {
  return (
    <div className="space-y-6">
      <Label className="flex items-center gap-1 text-lg">
        Tipo de Propiedad
        <span className="text-destructive">*</span>
      </Label>
      
      {CATEGORY_ORDER.map((category) => {
        const types = getPropertyTypesByCategory(category);
        
        return (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {PROPERTY_CATEGORIES[category]}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {types.map((type) => {
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
                    <div className="flex flex-col items-center justify-center p-3 gap-2">
                      <Icon className={cn(
                        "w-6 h-6",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className={cn(
                        "text-xs font-medium text-center",
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
      })}
    </div>
  );
};
