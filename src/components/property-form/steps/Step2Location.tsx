import { Card, CardContent } from '@/components/ui/card';
import { LocationSearch } from '@/components/LocationSearch';
import { PropertyFormData } from '@/hooks/useFormWizard';
import { AlertCircle } from 'lucide-react';

interface Step2LocationProps {
  formData: PropertyFormData;
  updateFormData: (data: Partial<PropertyFormData>) => void;
}

export const Step2Location = ({ formData, updateFormData }: Step2LocationProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          Ubicación <span className="text-destructive">*</span>
          <AlertCircle className="w-5 h-5 text-yellow-600" />
        </h2>
        <p className="text-muted-foreground">
          Indica dónde se encuentra tu propiedad. <strong>La colonia es obligatoria</strong> para crear un título descriptivo.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Buscar ubicación */}
          <LocationSearch
            onLocationSelect={(location) => {
              updateFormData({
                state: location.state,
                municipality: location.municipality,
                address: location.address || '',
                colonia: location.colonia || '',
                lat: location.lat,
                lng: location.lng,
              });
            }}
            defaultValue={formData.address}
          />

          {/* Alerta si falta colonia */}
          {formData.state && formData.municipality && !formData.colonia && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-900 text-sm">Colonia requerida</h4>
                <p className="text-yellow-700 text-sm mt-1">
                  La colonia es obligatoria. Intenta buscar una dirección más específica o selecciona la ubicación en el mapa.
                </p>
              </div>
            </div>
          )}

          {/* Alerta informativa si faltan coordenadas - NO bloquea el avance */}
          {formData.address && formData.colonia && (!formData.lat || !formData.lng) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 text-sm">Coordenadas aproximadas</h4>
                <p className="text-blue-700 text-sm mt-1">
                  Las coordenadas se obtendrán automáticamente al publicar. Para mayor precisión en el mapa, 
                  puedes volver a buscar y seleccionar la dirección desde las sugerencias de Google.
                </p>
              </div>
            </div>
          )}

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
              
              {/* Debug: Estado de validación */}
              <div className="text-xs text-muted-foreground pt-2 border-t border-border/50 mt-2">
                <span className="font-medium">Validación:</span>{' '}
                Estado: {formData.state ? '✓' : '✗'} | 
                Municipio: {formData.municipality ? '✓' : '✗'} | 
                Colonia: {formData.colonia ? '✓' : '✗'} | 
                Lat: {formData.lat ? '✓' : '✗'} | 
                Lng: {formData.lng ? '✓' : '✗'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
