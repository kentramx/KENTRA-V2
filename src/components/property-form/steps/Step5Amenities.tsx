import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PropertyFormData } from '@/hooks/useFormWizard';
import { Plus, X, Sparkles } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Step5AmenitiesProps {
  formData: PropertyFormData;
  updateFormData: (data: Partial<PropertyFormData>) => void;
}

const commonAmenities = {
  'Interior': ['Cocina equipada', 'Closets', 'Aire acondicionado', 'Calefacción', 'Piso de madera', 'Piso de mármol'],
  'Exterior': ['Jardín', 'Terraza', 'Balcón', 'Patio', 'Alberca', 'Roof garden'],
  'Seguridad': ['Vigilancia 24/7', 'Circuito cerrado', 'Portón eléctrico', 'Alarma'],
  'Servicios': ['Gimnasio', 'Salón de eventos', 'Elevador', 'Cisterna', 'Tanque de gas'],
};

export const Step5Amenities = ({ formData, updateFormData }: Step5AmenitiesProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customAmenity, setCustomAmenity] = useState('');

  const addAmenity = (category: string, item: string) => {
    const existingCategory = formData.amenities.find((a) => a.category === category);
    
    if (existingCategory) {
      if (!existingCategory.items.includes(item)) {
        const updated = formData.amenities.map((a) =>
          a.category === category ? { ...a, items: [...a.items, item] } : a
        );
        updateFormData({ amenities: updated });
      }
    } else {
      updateFormData({
        amenities: [...formData.amenities, { category, items: [item] }],
      });
    }
  };

  const removeAmenity = (category: string, item: string) => {
    const updated = formData.amenities.map((a) => {
      if (a.category === category) {
        return { ...a, items: a.items.filter((i) => i !== item) };
      }
      return a;
    }).filter((a) => a.items.length > 0);
    
    updateFormData({ amenities: updated });
  };

  const isAmenitySelected = (category: string, item: string) => {
    const existingCategory = formData.amenities.find((a) => a.category === category);
    return existingCategory?.items.includes(item) || false;
  };

  const addCustomAmenity = () => {
    if (customAmenity.trim() && selectedCategory) {
      addAmenity(selectedCategory, customAmenity.trim());
      setCustomAmenity('');
    }
  };

  const totalAmenities = formData.amenities.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Amenidades</h2>
        <p className="text-muted-foreground">
          Selecciona las características que hacen especial a tu propiedad
        </p>
      </div>

      {/* Amenidades seleccionadas */}
      {totalAmenities > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <Label className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Amenidades Seleccionadas ({totalAmenities})
              </Label>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.amenities.map((category) =>
                category.items.map((item) => (
                  <Badge key={`${category.category}-${item}`} variant="secondary" className="gap-1">
                    {item}
                    <button
                      type="button"
                      onClick={() => removeAmenity(category.category, item)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Amenidades comunes por categoría */}
      {Object.entries(commonAmenities).map(([category, items]) => (
        <Card key={category}>
          <CardContent className="pt-6">
            <Label className="text-base font-semibold mb-4 block">{category}</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              {items.map((item) => {
                const isSelected = isAmenitySelected(category, item);
                return (
                  <div
                    key={item}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => isSelected ? removeAmenity(category, item) : addAmenity(category, item)}
                  >
                    <Checkbox checked={isSelected} />
                    <span className="text-sm">{item}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Agregar amenidad personalizada */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Label className="text-base font-semibold">Agregar Amenidad Personalizada</Label>
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecciona categoría</option>
              {Object.keys(commonAmenities).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <Input
              value={customAmenity}
              onChange={(e) => setCustomAmenity(e.target.value)}
              placeholder="Nombre de la amenidad"
              onKeyPress={(e) => e.key === 'Enter' && addCustomAmenity()}
            />
            <Button
              type="button"
              onClick={addCustomAmenity}
              disabled={!customAmenity.trim() || !selectedCategory}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
