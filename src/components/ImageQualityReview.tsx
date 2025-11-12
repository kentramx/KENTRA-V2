import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ImageOff, 
  AlertTriangle, 
  Eye, 
  Sun, 
  Monitor, 
  Zap,
  Edit3
} from 'lucide-react';

interface ImageQualityReviewProps {
  images: { id: string; url: string }[];
  onQualityIssuesChange: (issues: ImageQualityIssues) => void;
}

export interface ImageQualityIssues {
  hasBlurryImages: boolean;
  hasPoorLighting: boolean;
  hasLowResolution: boolean;
  hasDarkImages: boolean;
  hasPoorComposition: boolean;
  hasInappropriateContent: boolean;
  hasManipulation: boolean;
  issueNotes: string;
}

const QUALITY_CHECKS = [
  {
    key: 'hasBlurryImages' as const,
    label: 'Imágenes borrosas o desenfocadas',
    icon: Eye,
    description: 'Las fotos están fuera de foco o no se ven nítidas',
    color: 'text-orange-600',
  },
  {
    key: 'hasPoorLighting' as const,
    label: 'Iluminación deficiente',
    icon: Sun,
    description: 'Fotos demasiado oscuras o con luces quemadas',
    color: 'text-yellow-600',
  },
  {
    key: 'hasLowResolution' as const,
    label: 'Resolución muy baja',
    icon: Monitor,
    description: 'Imágenes pixeladas o de tamaño insuficiente',
    color: 'text-blue-600',
  },
  {
    key: 'hasDarkImages' as const,
    label: 'Imágenes muy oscuras',
    icon: ImageOff,
    description: 'Difícil ver detalles por falta de luz',
    color: 'text-purple-600',
  },
  {
    key: 'hasPoorComposition' as const,
    label: 'Mala composición',
    icon: Zap,
    description: 'Encuadre inadecuado o ángulos poco profesionales',
    color: 'text-amber-600',
  },
  {
    key: 'hasInappropriateContent' as const,
    label: 'Contenido inapropiado',
    icon: AlertTriangle,
    description: 'Contenido ofensivo, violento o explícito',
    color: 'text-red-600',
  },
  {
    key: 'hasManipulation' as const,
    label: 'Evidencia de manipulación',
    icon: Edit3,
    description: 'Fotos alteradas digitalmente o con filtros excesivos',
    color: 'text-pink-600',
  },
];

export const ImageQualityReview = ({ images, onQualityIssuesChange }: ImageQualityReviewProps) => {
  const [issues, setIssues] = useState<ImageQualityIssues>({
    hasBlurryImages: false,
    hasPoorLighting: false,
    hasLowResolution: false,
    hasDarkImages: false,
    hasPoorComposition: false,
    hasInappropriateContent: false,
    hasManipulation: false,
    issueNotes: '',
  });

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleCheckChange = (key: keyof ImageQualityIssues, checked: boolean) => {
    const updatedIssues = { ...issues, [key]: checked };
    setIssues(updatedIssues);
    onQualityIssuesChange(updatedIssues);
  };

  const checkedIssuesCount = Object.entries(issues).filter(
    ([key, value]) => key !== 'issueNotes' && value === true
  ).length;

  const hasAnyIssue = checkedIssuesCount > 0;

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle>Evaluación Manual de Calidad de Imágenes</CardTitle>
          </div>
          {hasAnyIssue && (
            <Badge variant="destructive" className="ml-auto">
              {checkedIssuesCount} problema{checkedIssuesCount !== 1 ? 's' : ''} detectado{checkedIssuesCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Galería de imágenes para revisión */}
        <div className="space-y-2">
          <Label>Vista previa de imágenes ({images.length} total)</Label>
          <div className="relative">
            {images.length > 0 ? (
              <>
                <img
                  src={images[currentImageIndex]?.url}
                  alt={`Imagen ${currentImageIndex + 1}`}
                  className="w-full h-64 object-cover rounded-lg border"
                />
                <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-md text-sm font-medium">
                  {currentImageIndex + 1} / {images.length}
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                    {images.map((img, idx) => (
                      <button
                        key={img.id}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all ${
                          idx === currentImageIndex
                            ? 'border-primary ring-2 ring-primary ring-offset-2'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <img
                          src={img.url}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                Sin imágenes
              </div>
            )}
          </div>
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-sm text-blue-900">
            <strong>Instrucciones:</strong> Revisa todas las imágenes y marca los problemas de calidad que detectes. Si encuentras problemas, selecciona "Imágenes de baja calidad" como motivo de rechazo.
          </AlertDescription>
        </Alert>

        {/* Checklist de problemas de calidad */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Problemas de Calidad Detectados</Label>
          <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
            {QUALITY_CHECKS.map((check) => {
              const Icon = check.icon;
              return (
                <div key={check.key} className="flex items-start gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={check.key}
                    checked={issues[check.key] as boolean}
                    onCheckedChange={(checked) => handleCheckChange(check.key, checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={check.key}
                      className="flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Icon className={`h-4 w-4 ${check.color}`} />
                      {check.label}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {check.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumen de evaluación */}
        {hasAnyIssue ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Problemas de calidad detectados:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {QUALITY_CHECKS.filter(check => issues[check.key]).map(check => (
                  <li key={check.key} className="text-sm">
                    {check.label}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-sm text-green-900">
              ✓ No se detectaron problemas de calidad en las imágenes
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
