import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMonitoring } from "@/lib/monitoring";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  buyer: {
    name: string;
  };
  property: {
    title: string;
  } | null;
}

interface AgentReviewsProps {
  agentId: string;
}

export const AgentReviews = ({ agentId }: AgentReviewsProps) => {
  const { warn } = useMonitoring();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, [agentId]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("agent_reviews")
        .select(`
          id,
          rating,
          comment,
          created_at,
          buyer:profiles!agent_reviews_buyer_id_fkey(name),
          property:properties(title)
        `)
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReviews(data || []);
      
      if (data && data.length > 0) {
        const avg = data.reduce((sum, review) => sum + review.rating, 0) / data.length;
        setAverageRating(avg);
      }
    } catch (error) {
      warn("Error fetching agent reviews", {
        component: "AgentReviews",
        agentId,
        error,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        }`}
      />
    ));
  };

  if (loading) {
    return <div className="text-center py-8">Cargando reseñas...</div>;
  }

  return (
    <div className="space-y-6">
      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Calificación Promedio</span>
              <span className="text-2xl font-bold">{averageRating.toFixed(1)}</span>
              <div className="flex">{renderStars(Math.round(averageRating))}</div>
              <span className="text-sm text-muted-foreground">
                ({reviews.length} {reviews.length === 1 ? "reseña" : "reseñas"})
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Este agente aún no tiene reseñas
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <Avatar>
                    <AvatarFallback>
                      {review.buyer.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold">{review.buyer.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(review.created_at), "d 'de' MMMM, yyyy", {
                            locale: es,
                          })}
                        </p>
                      </div>
                      <div className="flex">{renderStars(review.rating)}</div>
                    </div>
                    {review.property && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Propiedad: {review.property.title}
                      </p>
                    )}
                    {review.comment && (
                      <p className="text-sm mt-2">{review.comment}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}