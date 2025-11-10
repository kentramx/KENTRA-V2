import { Instagram, Facebook } from "lucide-react";
import { Button } from "./ui/button";

interface SocialLinksProps {
  className?: string;
  iconSize?: number;
}

export const SocialLinks = ({ className = "", iconSize = 20 }: SocialLinksProps) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Button
        variant="ghost"
        size="icon"
        asChild
        className="hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <a
          href="https://instagram.com/kentra.mx"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Síguenos en Instagram"
        >
          <Instagram className="h-5 w-5" />
        </a>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        asChild
        className="hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <a
          href="https://www.facebook.com/profile.php?id=61583478575484"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Síguenos en Facebook"
        >
          <Facebook className="h-5 w-5" />
        </a>
      </Button>
    </div>
  );
};
