import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Star, Home, ShieldCheck } from "lucide-react";
import AgentBadges from "@/components/AgentBadges";

interface BadgeData {
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  priority: number;
}

interface AgentCardProps {
  id: string;
  name: string;
  type: 'agent' | 'agency';
  city: string;
  state: string;
  active_properties: number;
  avg_rating: number | null;
  total_reviews: number;
  is_verified: boolean;
  logo_url?: string;
  plan_name: string | null;
  plan_level: string | null;
  badges?: BadgeData[];
}

const AgentCard = ({
  id,
  name,
  type,
  city,
  state,
  active_properties,
  avg_rating,
  total_reviews,
  is_verified,
  logo_url,
  plan_name,
  plan_level,
  badges = [],
}: AgentCardProps) => {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getPlanBadgeColor = () => {
    if (plan_level === "elite") return "bg-gradient-to-r from-purple-500 to-pink-500 text-white";
    if (plan_level === "pro") return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white";
    return "bg-secondary text-secondary-foreground";
  };

  const isFeatured = () => {
    if (!plan_level) return false;
    return plan_level.includes('elite') || plan_level.includes('pro') || plan_level.includes('grow');
  };

  const linkTo = type === 'agency' ? `/agencia/${id}` : `/agente/${id}`;

  return (
    <Card className={`group overflow-hidden transition-all hover:shadow-lg hover:scale-[1.02] ${isFeatured() ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-6 relative">
        {isFeatured() && (
          <div className="absolute top-2 right-2 z-10">
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0 shadow-md">
              ⭐ Destacado
            </Badge>
          </div>
        )}
        
        <Link to={linkTo} className="block">
          <div className="flex items-start gap-4 mb-4">
            <Avatar className="h-16 w-16 border-2 border-border">
              {logo_url ? (
                <img src={logo_url} alt={name} className="object-cover" />
              ) : (
                <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                  {getInitials(name)}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg leading-tight truncate">
                  {name}
                </h3>
                {is_verified && (
                  <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
                )}
              </div>

              {plan_name && (
                <Badge className={`text-xs ${getPlanBadgeColor()}`}>
                  {plan_name}
                </Badge>
              )}
            </div>
          </div>

          {(city || state) && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {city && state ? `${city}, ${state}` : city || state}
              </span>
            </div>
          )}

          <div className="space-y-3 mb-4">
            {badges && badges.length > 0 && (
              <div className="mb-2">
                <AgentBadges badges={badges} maxVisible={2} size="sm" />
              </div>
            )}

            {avg_rating !== null && total_reviews > 0 && (
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">{avg_rating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">
                  ({total_reviews} {total_reviews === 1 ? "reseña" : "reseñas"})
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{active_properties}</span>
              <span className="text-muted-foreground">
                {active_properties === 1 ? "propiedad activa" : "propiedades activas"}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <span className="text-sm font-medium text-primary group-hover:underline">
              Ver perfil completo →
            </span>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
};

export default AgentCard;
