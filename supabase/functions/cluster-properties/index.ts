/**
 * Edge Function: cluster-properties
 * Clustering con Supercluster + PostGIS optimizado
 *
 * Usa RPC get_properties_in_viewport para queries O(log n)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Supercluster from "https://esm.sh/supercluster@8";
import { corsHeaders } from "../_shared/cors.ts";

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

const SUPERCLUSTER_OPTIONS = {
  radius: 60,
  maxZoom: 14,
  minZoom: 0,
  minPoints: 2,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { bounds, zoom, filters = {} }: RequestBody = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Usar RPC de PostGIS - UNA query optimizada con índice GIST
    const { data: properties, error } = await supabase.rpc('get_properties_in_viewport', {
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
      p_limit: 50000,
    });

    if (error) {
      console.error("[cluster-properties] RPC error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    const propertiesArray = (properties || []) as PropertyFromDB[];
    console.log(`[cluster-properties] PostGIS returned ${propertiesArray.length} properties in ${Date.now() - startTime}ms`);

    // Convertir a GeoJSON para Supercluster
    const points = propertiesArray.map((p) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [p.lng, p.lat] as [number, number],
      },
      properties: p,
    }));

    // Clustering
    const index = new Supercluster(SUPERCLUSTER_OPTIONS);
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

    return new Response(
      JSON.stringify({
        clusters,
        properties: individualProperties.slice(0, 200),
        total: propertiesArray.length,
        is_clustered: clusters.length > 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
