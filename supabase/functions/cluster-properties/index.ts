/**
 * Edge Function: cluster-properties
 * Clustering con Supercluster + PostGIS optimizado
 *
 * ESCALA: Diseñado para 10 - 1,000,000 propiedades
 * - Zoom bajo (0-8): Solo clusters, límite 10K propiedades
 * - Zoom medio (9-12): Clusters + algunas individuales, límite 5K
 * - Zoom alto (13+): Propiedades individuales, límite 500
 */

import Supercluster from "https://esm.sh/supercluster@8";
import { getCorsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoom: number;
  filters?: {
    listing_type?: string;
    property_type?: string;
    min_price?: number;
    max_price?: number;
    min_bedrooms?: number;
    state?: string;
    municipality?: string;
  };
}

interface PropertyFromDB {
  id: string;
  lat: number;
  lng: number;
  price: number;
  currency: string;
  title: string;
  type: string;
  listing_type: string;
  address: string;
  colonia: string | null;
  municipality: string;
  state: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  sqft: number | null;
  for_sale: boolean;
  for_rent: boolean;
  sale_price: number | null;
  rent_price: number | null;
  agent_id: string;
  is_featured: boolean;
  created_at: string;
}

// Configuración dinámica basada en zoom para estabilidad y velocidad
const getClusterConfig = (zoom: number) => {
  // Zoom muy bajo (país): menos datos, clusters muy grandes
  if (zoom <= 4) {
    return { radius: 200, minPoints: 50, limit: 2000 };
  }
  // Zoom bajo: clusters grandes y estables
  if (zoom <= 6) {
    return { radius: 160, minPoints: 20, limit: 3000 };
  }
  // Zoom medio-bajo
  if (zoom <= 8) {
    return { radius: 120, minPoints: 10, limit: 4000 };
  }
  // Zoom medio: balance entre clusters y detalle
  if (zoom <= 10) {
    return { radius: 80, minPoints: 6, limit: 3000 };
  }
  // Zoom medio-alto
  if (zoom <= 12) {
    return { radius: 60, minPoints: 4, limit: 2000 };
  }
  // Zoom alto: más detalle, menos agrupación
  if (zoom <= 14) {
    return { radius: 40, minPoints: 3, limit: 1000 };
  }
  // Zoom muy alto: propiedades individuales
  return { radius: 30, minPoints: 2, limit: 500 };
};

const createSuperclusterOptions = (zoom: number) => {
  const config = getClusterConfig(zoom);
  return {
    radius: config.radius,
    maxZoom: 16,
    minZoom: 0,
    minPoints: config.minPoints,
    extent: 512,
    nodeSize: 64,
    map: (props: PropertyFromDB) => ({
      price: props.price || 0,
      count: 1,
    }),
    reduce: (accumulated: { price: number; count: number }, props: { price: number; count: number }) => {
      accumulated.price = (accumulated.price || 0) + (props.price || 0);
      accumulated.count = (accumulated.count || 0) + (props.count || 1);
    },
  };
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { bounds, zoom, filters = {} }: RequestBody = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Configuración dinámica basada en zoom
    const clusterConfig = getClusterConfig(zoom);

    // Usar fetch directamente para evitar el límite de 1000 filas de PostgREST
    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_properties_in_viewport`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Range': `0-${clusterConfig.limit - 1}`,  // Bypass 1000 row limit
        'Prefer': 'count=none',  // Don't count total (faster)
      },
      body: JSON.stringify({
        bounds_north: bounds.north,
        bounds_south: bounds.south,
        bounds_east: bounds.east,
        bounds_west: bounds.west,
        p_status: 'activa',
        p_listing_type: filters.listing_type || null,
        p_property_type: filters.property_type || null,
        p_min_price: filters.min_price || null,
        p_max_price: filters.max_price || null,
        p_min_bedrooms: filters.min_bedrooms || null,
        p_state: filters.state || null,
        p_municipality: filters.municipality || null,
        p_limit: clusterConfig.limit,
      }),
    });

    if (!rpcResponse.ok) {
      const errorText = await rpcResponse.text();
      console.error("[cluster-properties] RPC error:", errorText);
      throw new Error(`Database error: ${rpcResponse.status}`);
    }

    const propertiesArray = (await rpcResponse.json()) as PropertyFromDB[];
    console.log(`[cluster-properties] zoom=${zoom} limit=${clusterConfig.limit} returned=${propertiesArray.length} in ${Date.now() - startTime}ms`);

    // Convertir a GeoJSON para Supercluster
    const points = propertiesArray.map((p) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [p.lng, p.lat] as [number, number],
      },
      properties: p,
    }));

    // Clustering con configuración dinámica
    const superclusterOptions = createSuperclusterOptions(zoom);
    const index = new Supercluster(superclusterOptions);
    index.load(points);

    const bbox: [number, number, number, number] = [
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
    ];
    const clustersRaw = index.getClusters(bbox, zoom);

    // Separar clusters de propiedades individuales
    const clusters: Array<{
      id: string;
      lat: number;
      lng: number;
      count: number;
      expansion_zoom: number;
    }> = [];

    const individualProperties: PropertyFromDB[] = [];

    for (const feature of clustersRaw) {
      if (feature.properties.cluster) {
        const clusterId = feature.properties.cluster_id;
        clusters.push({
          id: `cluster-${clusterId}`,
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          count: feature.properties.point_count,
          expansion_zoom: index.getClusterExpansionZoom(clusterId),
        });
      } else {
        individualProperties.push(feature.properties as PropertyFromDB);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[cluster-properties] ${clusters.length} clusters, ${individualProperties.length} individual, ${duration}ms`);

    // Limitar propiedades individuales basado en zoom
    const maxIndividual = zoom >= 14 ? 100 : zoom >= 12 ? 50 : 20;

    return new Response(
      JSON.stringify({
        clusters,
        properties: individualProperties.slice(0, maxIndividual),
        total: propertiesArray.length,
        is_clustered: clusters.length > 0,
        _meta: { zoom, limit: clusterConfig.limit, radius: clusterConfig.radius }
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=30, s-maxage=60",
        },
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Internal error";
    console.error("[cluster-properties] Error:", errorMessage);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        clusters: [],
        properties: [],
        total: 0,
        is_clustered: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
