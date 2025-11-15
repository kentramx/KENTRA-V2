import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { DollarSign } from 'lucide-react';

interface PriceInputProps {
  label: string;
  value: number | null;
  currency: 'MXN' | 'USD';
  onChange: (value: number | null) => void;
  onCurrencyChange: (currency: 'MXN' | 'USD') => void;
  required?: boolean;
  showConversion?: boolean;
  placeholder?: string;
}

export const PriceInput = ({
  label,
  value,
  currency,
  onChange,
  onCurrencyChange,
  required = false,
  showConversion = true,
  placeholder = '0',
}: PriceInputProps) => {
  const { convertMXNtoUSD, convertUSDtoMXN, formatPrice, formatNumber, parseFormattedNumber } = useCurrencyConversion();

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const numericValue = parseFormattedNumber(inputValue);
    onChange(numericValue > 0 ? numericValue : null);
  };

  const displayValue = value ? formatNumber(value.toString()) : '';
  
  const conversionText = value && showConversion
    ? currency === 'MXN'
      ? `≈ ${formatPrice(convertMXNtoUSD(value), 'USD')}`
      : `≈ ${formatPrice(convertUSDtoMXN(value), 'MXN')}`
    : null;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
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
        
        <Select value={currency} onValueChange={(v) => onCurrencyChange(v as 'MXN' | 'USD')}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MXN">MXN</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {conversionText && (
        <p className="text-sm text-muted-foreground">{conversionText}</p>
      )}
    </div>
  );
};
