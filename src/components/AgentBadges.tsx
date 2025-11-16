import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as Icons from "lucide-react";

interface BadgeData {
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  priority: number;
  is_secret?: boolean;
}

interface AgentBadgesProps {
  badges: BadgeData[];
  maxVisible?: number;
  size?: "sm" | "md" | "lg";
}

const AgentBadges = ({ badges, maxVisible = 3, size = "md" }: AgentBadgesProps) => {
  if (!badges || badges.length === 0) return null;

  // Sort badges by priority (highest first)
  const sortedBadges = [...badges].sort((a, b) => b.priority - a.priority);
  const visibleBadges = sortedBadges.slice(0, maxVisible);
  const remainingCount = sortedBadges.length - maxVisible;

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "text-xs px-2 py-0.5";
      case "lg":
        return "text-sm px-3 py-1.5";
      default:
        return "text-xs px-2.5 py-1";
    }
  };

  const getIconSize = () => {
    switch (size) {
      case "sm":
        return "h-3 w-3";
      case "lg":
        return "h-5 w-5";
      default:
        return "h-3.5 w-3.5";
    }
  };

  const renderBadge = (badge: BadgeData) => {
    const IconComponent = (Icons as Record<string, React.ComponentType<{ className?: string }>>)[badge.icon] || Icons.Award;
    
    return (
      <TooltipProvider key={badge.code}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              className={`bg-gradient-to-r ${badge.color} text-white border-0 shadow-sm ${getSizeClasses()} flex items-center gap-1 ${
                badge.is_secret ? 'animate-pulse ring-2 ring-yellow-400 ring-offset-2' : ''
              }`}
            >
              <IconComponent className={getIconSize()} />
              <span className="font-medium">{badge.name}</span>
              {badge.is_secret && <Icons.Lock className="h-2.5 w-2.5 ml-0.5" />}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">
              {badge.name}
              {badge.is_secret && <span className="ml-2 text-yellow-400">★ Secreto</span>}
            </p>
            <p className="text-xs text-muted-foreground">{badge.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {visibleBadges.map(renderBadge)}
      {remainingCount > 0 && (
        <Badge variant="secondary" className={getSizeClasses()}>
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
};

export default AgentBadges;
