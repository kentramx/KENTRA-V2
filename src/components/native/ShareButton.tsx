import { Button, ButtonProps } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface ShareButtonProps extends Omit<ButtonProps, 'onClick'> {
  title: string;
  text?: string;
  url: string;
}

export function ShareButton({ title, text, url, children, ...props }: ShareButtonProps) {
  const { share, haptic } = useNativeFeatures();

  const handleShare = async () => {
    await haptic('light');
    await share({ title, text, url });
  };

  return (
    <Button onClick={handleShare} {...props}>
      <Share2 className="h-4 w-4" />
      {children}
    </Button>
  );
}
