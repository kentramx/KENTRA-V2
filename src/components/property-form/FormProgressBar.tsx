import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormProgressBarProps {
  currentStep: number;
  totalSteps: number;
  isStepComplete: (step: number) => boolean;
  onStepClick?: (step: number) => void;
}

const stepLabels = [
  'Información',
  'Ubicación',
  'Características',
  'Descripción',
  'Amenidades',
  'Revisión'
];

export const FormProgressBar = ({ 
  currentStep, 
  totalSteps, 
  isStepComplete,
  onStepClick 
}: FormProgressBarProps) => {
  return (
    <div className="w-full py-8">
      <div className="flex items-center justify-between relative">
        {/* Línea de progreso */}
        <div className="absolute top-5 left-0 w-full h-0.5 bg-muted" />
        <div 
          className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
        
        {/* Steps */}
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
          const isActive = step === currentStep;
          const isCompleted = step < currentStep || isStepComplete(step);
          
          return (
            <div
              key={step}
              className={cn(
                "relative flex flex-col items-center gap-2 z-10 cursor-pointer transition-all",
                isActive && "scale-110"
              )}
              onClick={() => onStepClick?.(step)}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isActive
                    ? "bg-background border-primary text-primary"
                    : "bg-background border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isCompleted && step < currentStep ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span className="font-semibold">{step}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium text-center max-w-[80px] hidden sm:block",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {stepLabels[step - 1]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
