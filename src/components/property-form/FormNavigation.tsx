import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';

interface FormNavigationProps {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onSaveDraft?: () => void;
  isNextDisabled?: boolean;
  isLoading?: boolean;
}

export const FormNavigation = ({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  onSaveDraft,
  isNextDisabled,
  isLoading,
}: FormNavigationProps) => {
  return (
    <div className="flex items-center justify-between pt-6 border-t">
      <Button
        type="button"
        variant="outline"
        onClick={onPrev}
        disabled={currentStep === 1 || isLoading}
        className="gap-2"
      >
        <ChevronLeft className="w-4 h-4" />
        Anterior
      </Button>

      <div className="flex gap-2">
        {onSaveDraft && (
          <Button
            type="button"
            variant="ghost"
            onClick={onSaveDraft}
            disabled={isLoading}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar borrador
          </Button>
        )}

        <Button
          type="button"
          onClick={onNext}
          disabled={isNextDisabled || isLoading}
          className="gap-2"
        >
          {currentStep === totalSteps ? 'Continuar a revisión' : 'Siguiente'}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
