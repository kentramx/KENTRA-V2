/**
 * Edge Function: cluster-properties
 * Clustering profesional con Supercluster (Mapbox algorithm)
 * 
 * FASE 1: Sin cache Redis (validación de concepto)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Supercluster from "https://esm.sh/supercluster@8";
import { corsHeaders } from "../_shared/cors.ts";

// Tipos
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
    min_bathrooms?: number;
    state?: string;
    municipality?: string;
    colonia?: string;
  };
}

// Configuración de Supercluster estilo Zillow/Airbnb
// Zoom 0-9: clusters grandes | Zoom 10-11: clusters medianos | Zoom 12+: markers individuales
const SUPERCLUSTER_OPTIONS = {
  radius: 60,        // ↓ Radio pequeño = clusters más pequeños, se separan antes
  maxZoom: 11,       // ↓ Mostrar markers individuales desde zoom 12
  minZoom: 0,
  minPoints: 2,      // ↓ Clusters desde 2 propiedades
  extent: 512,       // ↑ Grid más fina = agrupación más precisa
  nodeSize: 64,
  // Agregar propiedades para mostrar en clusters
  map: (props: any) => ({
    price: props.price || 0,
    count: 1,
  }),
  reduce: (accumulated: any, props: any) => {
    accumulated.price = (accumulated.price || 0) + (props.price || 0);
    accumulated.count = (accumulated.count || 0) + (props.count || 1);
  },
};

Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body: RequestBody = await req.json();
    const { bounds, zoom, filters = {} } = body;

    console.log(`[cluster-properties] Request: zoom=${zoom}, bounds=[${bounds.south.toFixed(3)},${bounds.north.toFixed(3)}]`);

    // Cliente Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Cargar propiedades con buffer para clustering correcto en bordes
    let query = supabase
      .from("properties")
      .select(`
        id, lat, lng, price, currency, type, title,
        bedrooms, bathrooms, sqft, parking, listing_type,
        address, colonia, state, municipality,
        for_sale, for_rent, sale_price, rent_price,
        agent_id, created_at
      `)
      .eq("status", "activa")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", bounds.south - 0.5)
      .lte("lat", bounds.north + 0.5)
      .gte("lng", bounds.west - 0.5)
      .lte("lng", bounds.east + 0.5);

    // Aplicar filtros NO geográficos (los bounds ya filtran por ubicación)
    // ✅ listing_type, property_type, price, bedrooms, bathrooms
    // ❌ state, municipality, colonia - redundantes con bounds geográficos
    if (filters.listing_type) {
      query = query.eq("listing_type", filters.listing_type);
    }
    if (filters.property_type) {
      query = query.eq("type", filters.property_type);
    }
    if (filters.min_price) {
      query = query.gte("price", filters.min_price);
    }
    if (filters.max_price) {
      query = query.lte("price", filters.max_price);
    }
    if (filters.min_bedrooms) {
      query = query.gte("bedrooms", filters.min_bedrooms);
    }
    if (filters.min_bathrooms) {
      query = query.gte("bathrooms", filters.min_bathrooms);
    }
    // NOTA: state/municipality/colonia ignorados - bounds geográficos son suficientes
    // Esto evita problemas de nomenclatura (Cancún vs Benito Juárez, etc.)

    const { data: properties, error: dbError } = await query;

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log(`[cluster-properties] Loaded ${properties?.length || 0} properties from DB`);

    // Convertir a GeoJSON para Supercluster
    const points: any[] = (properties || []).map((p: any) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [p.lng, p.lat],
      },
      properties: {
        id: p.id,
        price: p.price || 0,
        currency: p.currency || "MXN",
        type: p.type,
        title: p.title,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        sqft: p.sqft,
        parking: p.parking,
        listing_type: p.listing_type || "venta",
        address: p.address,
        colonia: p.colonia,
        state: p.state,
        municipality: p.municipality,
        for_sale: p.for_sale ?? true,
        for_rent: p.for_rent ?? false,
        sale_price: p.sale_price,
        rent_price: p.rent_price,
        agent_id: p.agent_id,
        created_at: p.created_at,
      },
    }));

    // Crear índice Supercluster
    const index = new Supercluster(SUPERCLUSTER_OPTIONS);
    index.load(points);

    // Obtener clusters/properties para el viewport
    const bbox: [number, number, number, number] = [
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
    ];
    const clustersRaw = index.getClusters(bbox, zoom);

    console.log(`[cluster-properties] Supercluster returned ${clustersRaw.length} items at zoom ${zoom}`);

    // Separar clusters de propiedades individuales
    const clusters: any[] = [];
    const individualProperties: any[] = [];

    for (const feature of clustersRaw) {
      if (feature.properties.cluster) {
        // Es un cluster - ID estable basado en coordenadas redondeadas
        const clusterLat = feature.geometry.coordinates[1];
        const clusterLng = feature.geometry.coordinates[0];
        const stableId = `c-${Math.round(clusterLat * 1000)}-${Math.round(clusterLng * 1000)}-z${zoom}`;
        
        clusters.push({
          id: stableId,
          lat: clusterLat,
          lng: clusterLng,
          count: feature.properties.point_count,
          avg_price: Math.round(
            (feature.properties.price || 0) / (feature.properties.count || 1)
          ),
          expansion_zoom: index.getClusterExpansionZoom(feature.properties.cluster_id),
        });
      } else {
        // Es una propiedad individual
        const props = feature.properties;
        individualProperties.push({
          id: props.id,
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          price: props.price,
          currency: props.currency,
          type: props.type,
          title: props.title,
          bedrooms: props.bedrooms,
          bathrooms: props.bathrooms,
          sqft: props.sqft,
          parking: props.parking,
          listing_type: props.listing_type,
          address: props.address,
          colonia: props.colonia,
          state: props.state,
          municipality: props.municipality,
          for_sale: props.for_sale,
          for_rent: props.for_rent,
          sale_price: props.sale_price,
          rent_price: props.rent_price,
          images: [],  // FASE 2: cargar imágenes
          agent_id: props.agent_id,
          is_featured: false,  // FASE 2: verificar featured
          created_at: props.created_at,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // EXPANDIR CLUSTERS PEQUEÑOS PARA LA LISTA
    // Si hay clusters y estamos en zoom medio-alto, extraer propiedades
    // de clusters pequeños (≤30) para poblar la lista
    // ═══════════════════════════════════════════════════════════
    let propertiesForList = [...individualProperties];

    if (clusters.length > 0 && zoom >= 9) {
      for (const feature of clustersRaw) {
        if (feature.properties.cluster && feature.properties.point_count <= 30) {
          try {
            const leaves = index.getLeaves(feature.properties.cluster_id, 30);
            for (const leaf of leaves) {
              const props = leaf.properties;
              propertiesForList.push({
                id: props.id,
                lat: leaf.geometry.coordinates[1],
                lng: leaf.geometry.coordinates[0],
                price: props.price,
                currency: props.currency,
                type: props.type,
                title: props.title,
                bedrooms: props.bedrooms,
                bathrooms: props.bathrooms,
                sqft: props.sqft,
                parking: props.parking,
                listing_type: props.listing_type,
                address: props.address,
                colonia: props.colonia,
                state: props.state,
                municipality: props.municipality,
                for_sale: props.for_sale,
                for_rent: props.for_rent,
                sale_price: props.sale_price,
                rent_price: props.rent_price,
                images: [],
                agent_id: props.agent_id,
                is_featured: false,
                created_at: props.created_at,
              });
            }
          } catch (e) {
            console.error(`[cluster-properties] Error expanding cluster:`, e);
          }
        }
      }
    }

    // Eliminar duplicados por ID
    const uniqueMap = new Map();
    for (const p of propertiesForList) {
      if (!uniqueMap.has(p.id)) {
        uniqueMap.set(p.id, p);
      }
    }
    propertiesForList = Array.from(uniqueMap.values());

    const duration = Date.now() - startTime;
    
    // Calcular el total REAL del viewport (clusters + individuales)
    const clusterTotal = clusters.reduce((sum, c) => sum + (c.count || 0), 0);
    const viewportTotal = clusterTotal + individualProperties.length;
    
    console.log(
      `[cluster-properties] Response: ${clusters.length} clusters, ${individualProperties.length} individual, ${propertiesForList.length} for list, viewportTotal=${viewportTotal}, ${duration}ms`
    );

    const response = {
      properties: propertiesForList.slice(0, 200),
      clusters,
      total_count: viewportTotal, // ← Total real del viewport, no de la DB
      is_clustered: clusters.length > 0,
      _debug: {
        duration_ms: duration,
        raw_points: points.length,
        db_total: properties?.length || 0,
        viewport_total: viewportTotal,
        cluster_total: clusterTotal,
        individual_count: individualProperties.length,
        expanded_count: propertiesForList.length,
        zoom,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Internal error";
    console.error("[cluster-properties] Error:", errorMessage);
    return new Response(
      JSON.stringify({
        error: errorMessage,
        properties: [],
        clusters: [],
        total_count: 0,
        is_clustered: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
