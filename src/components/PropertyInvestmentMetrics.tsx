import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Percent, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { monitoring } from "@/lib/monitoring";

interface PropertyInvestmentMetricsProps {
  price: number;
  sqft?: number;
  listingType: string;
  state: string;
  municipality: string;
  type: string;
}

export const PropertyInvestmentMetrics = ({
  price,
  sqft,
  listingType,
  state,
  municipality,
  type,
}: PropertyInvestmentMetricsProps) => {
  const [marketData, setMarketData] = useState<{
    avgPrice: number;
    avgPricePerSqft: number;
    totalProperties: number;
  } | null>(null);

  useEffect(() => {
    fetchMarketData();
  }, [state, municipality, type]);

  const fetchMarketData = async () => {
    try {
      let query = supabase
        .from("properties")
        .select("price, sqft")
        .eq("state", state)
        .eq("municipality", municipality)
        .eq("listing_type", listingType)
        .eq("status", "activa");

      // Only add type filter if it's a valid enum value
      if (type) {
        query = query.eq("type", type as any);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        const avgPrice = data.reduce((acc, p) => acc + Number(p.price), 0) / data.length;
        const propertiesWithSqft = data.filter((p) => p.sqft);
        const avgPricePerSqft = propertiesWithSqft.length
          ? propertiesWithSqft.reduce(
              (acc, p) => acc + Number(p.price) / Number(p.sqft),
              0
            ) / propertiesWithSqft.length
          : 0;

        setMarketData({
          avgPrice,
          avgPricePerSqft,
          totalProperties: data.length,
        });
      }
    } catch (error) {
      monitoring.error("Error fetching market data", {
        component: "PropertyInvestmentMetrics",
        state,
        municipality,
        type,
        error,
      });
    }
  };

  const pricePerSqft = sqft ? price / sqft : null;
  const priceVsMarket = marketData
    ? ((price - marketData.avgPrice) / marketData.avgPrice) * 100
    : null;
  const estimatedROI = listingType === "renta" && price ? (price * 12) / 100000 : null;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Indicadores de Inversión
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Price per sqft */}
          {pricePerSqft && (
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Precio por m²</h4>
              </div>
              <p className="text-2xl font-bold text-primary">
                {formatPrice(pricePerSqft)}
              </p>
              {marketData && marketData.avgPricePerSqft > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Promedio del área: {formatPrice(marketData.avgPricePerSqft)}
                </p>
              )}
            </div>
          )}

          {/* Price vs Market */}
          {priceVsMarket !== null && marketData && (
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">vs. Mercado Local</h4>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">
                  {priceVsMarket > 0 ? "+" : ""}
                  {priceVsMarket.toFixed(1)}%
                </p>
                <Badge
                  variant={priceVsMarket <= 0 ? "default" : "secondary"}
                >
                  {priceVsMarket <= 0 ? "Por debajo" : "Por encima"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Promedio: {formatPrice(marketData.avgPrice)}
              </p>
            </div>
          )}

          {/* Market comparison */}
          {marketData && (
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Propiedades Similares</h4>
              </div>
              <p className="text-2xl font-bold text-primary">
                {marketData.totalProperties}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                En {municipality}, {state}
              </p>
            </div>
          )}

          {/* ROI Estimate (for rentals) */}
          {estimatedROI && (
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">ROI Estimado</h4>
              </div>
              <p className="text-2xl font-bold text-primary">
                {estimatedROI.toFixed(2)}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Retorno anual aproximado
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
