import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle } from 'lucide-react';

const QUALITY_CHECKS = [
  { id: 'images', label: 'Mínimo 3 imágenes de calidad', required: true },
  { id: 'description', label: 'Descripción detallada (>50 palabras)', required: true },
  { id: 'amenities', label: 'Amenidades listadas', required: false },
  { id: 'price', label: 'Precio dentro de rango de mercado', required: true },
  { id: 'location', label: 'Ubicación verificada en mapa', required: true },
];

interface QualityChecklistProps {
  property: any;
}

const QualityChecklist = ({ property }: QualityChecklistProps) => {
  // Normalizamos campos para evitar falsos negativos
  const descriptionWordCount = typeof property.description === 'string'
    ? property.description.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const amenitiesCount = Array.isArray(property.amenities)
    ? property.amenities.filter(Boolean).length
    : property.amenities && typeof property.amenities === 'object'
      ? Object.values(property.amenities).filter(Boolean).length
      : 0;
  const hasLocation = typeof property.lat === 'number' && typeof property.lng === 'number';
  const imagesCount = Array.isArray(property.images) ? property.images.length : 0;

  const checks = {
    images: imagesCount >= 3,
    description: descriptionWordCount >= 50,
    amenities: amenitiesCount > 0,
    price: Boolean(property.price && property.price > 0),
    location: hasLocation,
  };

  const passedCount = Object.values(checks).filter(Boolean).length;
  const totalCount = QUALITY_CHECKS.length;
  const allRequiredPassed = QUALITY_CHECKS.filter(c => c.required).every(c => checks[c.id as keyof typeof checks]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Checklist de Calidad</span>
          <span className={`text-lg ${allRequiredPassed ? 'text-green-600' : 'text-red-600'}`}>
            {passedCount}/{totalCount}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {QUALITY_CHECKS.map((check) => (
          <div key={check.id} className="flex items-center gap-2">
            {checks[check.id as keyof typeof checks] ? (
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            )}
            <span className={checks[check.id as keyof typeof checks] ? '' : 'text-muted-foreground'}>
              {check.label}
              {check.required && <span className="text-red-600 ml-1">*</span>}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default QualityChecklist;