import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { LocationSearch } from '@/components/LocationSearch';
import { ColoniaAutocomplete } from '@/components/ColoniaAutocomplete';
import { PropertyFormData } from '@/hooks/useFormWizard';
import { MapPin } from 'lucide-react';

interface Step2LocationProps {
  formData: PropertyFormData;
  updateFormData: (data: Partial<PropertyFormData>) => void;
}

export const Step2Location = ({ formData, updateFormData }: Step2LocationProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Ubicación</h2>
        <p className="text-muted-foreground">
          Indica dónde se encuentra tu propiedad
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Buscar ubicación */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Buscar Ubicación
              <span className="text-destructive">*</span>
            </Label>
            <LocationSearch
              onLocationSelect={(location) => {
                updateFormData({
                  state: location.state,
                  municipality: location.municipality,
                  address: location.address || formData.address,
                  colonia: location.colonia || formData.colonia,
                  lat: location.lat,
                  lng: location.lng,
                });
              }}
              defaultValue={formData.address}
            />
          </div>

          {/* Colonia/Neighborhood */}
          <div className="space-y-2">
            <Label>
              Colonia
              <span className="text-destructive">*</span>
            </Label>
            <ColoniaAutocomplete
              state={formData.state}
              municipality={formData.municipality}
              onColoniaSelect={(colonia) => updateFormData({ colonia })}
              defaultValue={formData.colonia}
            />
            <p className="text-xs text-muted-foreground">
              Si no encuentras tu colonia, puedes escribirla manualmente
            </p>
          </div>

          {/* Vista previa de ubicación */}
          {formData.state && formData.municipality && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-sm">Ubicación seleccionada:</h4>
              <div className="text-sm space-y-1">
                {formData.colonia && <p><span className="text-muted-foreground">Colonia:</span> {formData.colonia}</p>}
                <p><span className="text-muted-foreground">Municipio:</span> {formData.municipality}</p>
                <p><span className="text-muted-foreground">Estado:</span> {formData.state}</p>
                {formData.address && <p><span className="text-muted-foreground">Dirección:</span> {formData.address}</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
