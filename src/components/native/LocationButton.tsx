import { useState } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface LocationButtonProps extends Omit<ButtonProps, 'onClick' | 'onError'> {
  onLocation: (coords: { lat: number; lng: number }) => void;
  onLocationError?: (error: Error) => void;
}

export function LocationButton({ onLocation, onLocationError, children, ...props }: LocationButtonProps) {
  const [loading, setLoading] = useState(false);
  const { getLocation, haptic } = useNativeFeatures();

  const handleClick = async () => {
    await haptic('light');
    setLoading(true);
    try {
      const coords = await getLocation();
      await haptic('medium');
      onLocation(coords);
    } catch (e) {
      onLocationError?.(e as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
      {children}
    </Button>
  );
}
