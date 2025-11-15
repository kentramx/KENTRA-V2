import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertCircle, 
  FileText, 
  Image as ImageIcon, 
  MapPin, 
  DollarSign, 
  Home,
  AlertTriangle
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

export interface RejectionReasons {
  incompleteInfo: boolean;
  poorImages: boolean;
  incorrectLocation: boolean;
  suspiciousPrice: boolean;
  inappropriateContent: boolean;
  duplicateProperty: boolean;
  notes: string;
}

const REJECTION_REASONS = [
  {
    id: 'incompleteInfo',
    label: 'Información incompleta',
    description: 'Faltan datos importantes como descripción, precio, ubicación, etc.',
    icon: FileText,
    color: 'text-orange-500'
  },
  {
    id: 'poorImages',
    label: 'Imágenes de baja calidad',
    description: 'Fotos borrosas, mal iluminadas, o menos de 3 imágenes',
    icon: ImageIcon,
    color: 'text-blue-500'
  },
  {
    id: 'incorrectLocation',
    label: 'Ubicación incorrecta',
    description: 'La ubicación en el mapa no coincide con la dirección',
    icon: MapPin,
    color: 'text-green-500'
  },
  {
    id: 'suspiciousPrice',
    label: 'Precio sospechoso',
    description: 'Precio muy por debajo o por encima del mercado',
    icon: DollarSign,
    color: 'text-yellow-500'
  },
  {
    id: 'inappropriateContent',
    label: 'Contenido inapropiado',
    description: 'Descripción o imágenes con contenido ofensivo',
    icon: AlertTriangle,
    color: 'text-red-500'
  },
  {
    id: 'duplicateProperty',
    label: 'Propiedad duplicada',
    description: 'Esta propiedad ya existe en el sistema',
    icon: Home,
    color: 'text-purple-500'
  }
];

interface RejectionReviewProps {
  onRejectionReasonsChange: (reasons: RejectionReasons) => void;
}

const RejectionReview = ({ onRejectionReasonsChange }: RejectionReviewProps) => {
  const [reasons, setReasons] = useState<RejectionReasons>({
    incompleteInfo: false,
    poorImages: false,
    incorrectLocation: false,
    suspiciousPrice: false,
    inappropriateContent: false,
    duplicateProperty: false,
    notes: ''
  });

  const handleCheckChange = (key: keyof RejectionReasons, checked: boolean | string) => {
    const newReasons = { ...reasons, [key]: checked };
    setReasons(newReasons);
    onRejectionReasonsChange(newReasons);
  };

  const selectedReasonsCount = Object.entries(reasons)
    .filter(([key, value]) => key !== 'notes' && value === true)
    .length;

  const hasReasons = selectedReasonsCount > 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Motivos de Rechazo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Instrucciones:</strong> Selecciona todos los problemas que encuentres en esta publicación 
            y agrega comentarios específicos para que el agente pueda corregirlos.
          </AlertDescription>
        </Alert>

        {/* Rejection Reasons */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Selecciona los problemas detectados</h3>
          <div className="space-y-3">
            {REJECTION_REASONS.map((reason) => {
              const Icon = reason.icon;
              const isChecked = reasons[reason.id as keyof RejectionReasons] === true;
              
              return (
                <div key={reason.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={reason.id}
                    checked={isChecked}
                    onCheckedChange={(checked) => 
                      handleCheckChange(reason.id as keyof RejectionReasons, checked as boolean)
                    }
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={reason.id}
                      className="flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Icon className={`h-4 w-4 ${reason.color}`} />
                      {reason.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{reason.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Internal Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Comentarios para el agente (requerido si rechazas)</Label>
          <Textarea
            id="notes"
            placeholder="Explica en detalle qué debe corregir el agente. Sé específico y constructivo..."
            value={reasons.notes}
            onChange={(e) => handleCheckChange('notes', e.target.value)}
            className="min-h-[100px] resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Estos comentarios serán visibles para el agente cuando vea su propiedad rechazada.
          </p>
        </div>

        {/* Summary Alert */}
        {hasReasons ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Se detectaron <strong>{selectedReasonsCount}</strong> problemas en esta publicación.
              {!reasons.notes && <span className="block mt-1 font-medium">⚠️ Agrega comentarios antes de rechazar.</span>}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-200 bg-green-50 text-green-900">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              ✓ No se han seleccionado problemas. Esta publicación puede ser aprobada.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default RejectionReview;
