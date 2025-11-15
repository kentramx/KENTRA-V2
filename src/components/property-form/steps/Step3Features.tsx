import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PropertyFormData } from '@/hooks/useFormWizard';
import { Plus, Minus, Home, Maximize } from 'lucide-react';

interface Step3FeaturesProps {
  formData: PropertyFormData;
  updateFormData: (data: Partial<PropertyFormData>) => void;
}

export const Step3Features = ({ formData, updateFormData }: Step3FeaturesProps) => {
  const showResidentialFields = ['casa', 'departamento'].includes(formData.type);
  const showTerrainFields = formData.type === 'terreno';
  const showCommercialFields = ['oficina', 'local', 'bodega', 'edificio'].includes(formData.type);

  const incrementValue = (field: keyof PropertyFormData) => {
    const currentValue = parseInt(formData[field] as string) || 0;
    updateFormData({ [field]: (currentValue + 1).toString() });
  };

  const decrementValue = (field: keyof PropertyFormData) => {
    const currentValue = parseInt(formData[field] as string) || 0;
    if (currentValue > 0) {
      updateFormData({ [field]: (currentValue - 1).toString() });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Características</h2>
        <p className="text-muted-foreground">
          Especifica los detalles de tu propiedad
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Campos para Residencial */}
          {showResidentialFields && (
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Recámaras */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Recámaras
                  <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => decrementValue('bedrooms')}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    value={formData.bedrooms}
                    onChange={(e) => updateFormData({ bedrooms: e.target.value })}
                    className="text-center"
                    min="0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => incrementValue('bedrooms')}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Baños */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Baños
                  <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => decrementValue('bathrooms')}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    value={formData.bathrooms}
                    onChange={(e) => updateFormData({ bathrooms: e.target.value })}
                    className="text-center"
                    min="0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => incrementValue('bathrooms')}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Estacionamientos */}
              <div className="space-y-2">
                <Label>Estacionamientos</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => decrementValue('parking')}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    value={formData.parking}
                    onChange={(e) => updateFormData({ parking: e.target.value })}
                    className="text-center"
                    min="0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => incrementValue('parking')}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* m² construidos */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Maximize className="w-4 h-4" />
                  m² Construidos
                </Label>
                <Input
                  type="number"
                  value={formData.sqft}
                  onChange={(e) => updateFormData({ sqft: e.target.value })}
                  placeholder="150"
                  min="0"
                />
              </div>
            </div>
          )}

          {/* Campos para Terreno */}
          {showTerrainFields && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Maximize className="w-4 h-4" />
                  m² de Terreno
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  value={formData.lot_size}
                  onChange={(e) => updateFormData({ lot_size: e.target.value })}
                  placeholder="500"
                  min="0"
                  required
                />
              </div>
            </div>
          )}

          {/* Campos para Comercial */}
          {showCommercialFields && (
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  m² Totales
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  value={formData.sqft}
                  onChange={(e) => updateFormData({ sqft: e.target.value })}
                  placeholder="200"
                  min="0"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Estacionamientos</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => decrementValue('parking')}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    value={formData.parking}
                    onChange={(e) => updateFormData({ parking: e.target.value })}
                    className="text-center"
                    min="0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => incrementValue('parking')}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* m² de Terreno (opcional para todas excepto terreno puro) */}
          {!showTerrainFields && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Maximize className="w-4 h-4" />
                m² de Terreno (opcional)
              </Label>
              <Input
                type="number"
                value={formData.lot_size}
                onChange={(e) => updateFormData({ lot_size: e.target.value })}
                placeholder="300"
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Si aplica, indica el tamaño del terreno donde está construida la propiedad
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
