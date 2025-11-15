import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { DollarSign } from 'lucide-react';

interface PriceInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  required?: boolean;
  placeholder?: string;
}

export const PriceInput = ({
  label,
  value,
  onChange,
  required = false,
  placeholder = '0',
}: PriceInputProps) => {
  const { formatNumber, parseFormattedNumber } = useCurrencyConversion();

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const numericValue = parseFormattedNumber(inputValue);
    onChange(numericValue > 0 ? numericValue : null);
  };

  const displayValue = value ? formatNumber(value.toString()) : '';

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      
      <div className="relative">
        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          value={displayValue}
          onChange={handleValueChange}
          placeholder={placeholder}
          className="pl-9"
          required={required}
        />
      </div>
    </div>
  );
};
