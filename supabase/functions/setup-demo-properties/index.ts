import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropertyData {
  title: string;
  address: string;
  state: string;
  municipality: string;
  price: number;
  type: string;
  listing_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  sqft: number | null;
  description: string;
  lat: number;
  lng: number;
  imagePrompt: string;
}

const properties: PropertyData[] = [
  {
    title: 'Casa Moderna de Lujo con Jardín',
    address: 'Paseo de la Reforma 250',
    state: 'Ciudad de México',
    municipality: 'Miguel Hidalgo',
    price: 8500000,
    type: 'casa',
    listing_type: 'venta',
    bedrooms: 4,
    bathrooms: 3,
    parking: 2,
    sqft: 350,
    description: 'Hermosa casa moderna de dos niveles con amplios espacios, jardín privado y acabados de lujo.',
    lat: 19.4326,
    lng: -99.1332,
    imagePrompt: 'Modern luxury house exterior with beautiful garden, sunset lighting, architectural photography'
  },
  {
    title: 'Departamento con Vista Panorámica',
    address: 'Av. Insurgentes Sur 1500',
    state: 'Ciudad de México',
    municipality: 'Benito Juárez',
    price: 5200000,
    type: 'departamento',
    listing_type: 'venta',
    bedrooms: 2,
    bathrooms: 2,
    parking: 1,
    sqft: 120,
    description: 'Departamento contemporáneo con espectacular vista a la ciudad.',
    lat: 19.3894,
    lng: -99.1704,
    imagePrompt: 'Contemporary apartment interior with open living space, modern kitchen, floor-to-ceiling windows, city view'
  },
  {
    title: 'Casa de Playa Frente al Mar',
    address: 'Costera Miguel Alemán 100',
    state: 'Guerrero',
    municipality: 'Acapulco',
    price: 12000000,
    type: 'casa',
    listing_type: 'venta',
    bedrooms: 5,
    bathrooms: 4,
    parking: 3,
    sqft: 450,
    description: 'Impresionante casa de playa con acceso directo al mar, piscina privada.',
    lat: 16.8531,
    lng: -99.8237,
    imagePrompt: 'Beautiful beach house with ocean view, palm trees, tropical architecture, sunset'
  },
  {
    title: 'Penthouse de Lujo',
    address: 'Bosques de las Lomas 800',
    state: 'Ciudad de México',
    municipality: 'Cuajimalpa',
    price: 15000000,
    type: 'departamento',
    listing_type: 'venta',
    bedrooms: 3,
    bathrooms: 3,
    parking: 2,
    sqft: 280,
    description: 'Espectacular penthouse con terraza panorámica, vistas increíbles.',
    lat: 19.4034,
    lng: -99.2558,
    imagePrompt: 'Spacious modern penthouse terrace with city skyline, luxury outdoor furniture, evening lighting'
  },
  {
    title: 'Casa Colonial Restaurada',
    address: 'Calle Aldama 45',
    state: 'Guanajuato',
    municipality: 'San Miguel de Allende',
    price: 9500000,
    type: 'casa',
    listing_type: 'venta',
    bedrooms: 4,
    bathrooms: 3,
    parking: 2,
    sqft: 320,
    description: 'Hermosa casa colonial completamente restaurada con patio central.',
    lat: 20.9144,
    lng: -100.7463,
    imagePrompt: 'Colonial style house exterior with courtyard, fountain, traditional Mexican architecture'
  },
  {
    title: 'Terreno con Vista a la Montaña',
    address: 'Carretera Federal 15',
    state: 'Nuevo León',
    municipality: 'Monterrey',
    price: 2800000,
    type: 'terreno',
    listing_type: 'venta',
    bedrooms: null,
    bathrooms: null,
    parking: null,
    sqft: 500,
    description: 'Excelente terreno residencial con vista panorámica a las montañas.',
    lat: 25.6866,
    lng: -100.3161,
    imagePrompt: 'Empty land plot with mountain views, residential development area, clear sky'
  },
  {
    title: 'Local Comercial en Centro',
    address: 'Av. Juárez 123',
    state: 'Jalisco',
    municipality: 'Guadalajara',
    price: 3500000,
    type: 'local',
    listing_type: 'venta',
    bedrooms: null,
    bathrooms: 2,
    parking: 2,
    sqft: 200,
    description: 'Amplio local comercial en zona de alta afluencia, fachada de cristal.',
    lat: 20.6737,
    lng: -103.3444,
    imagePrompt: 'Modern commercial retail space interior, glass storefront, bright lighting'
  },
  {
    title: 'Estudio Minimalista',
    address: 'Polanco 456',
    state: 'Ciudad de México',
    municipality: 'Miguel Hidalgo',
    price: 3200000,
    type: 'departamento',
    listing_type: 'venta',
    bedrooms: 1,
    bathrooms: 1,
    parking: 1,
    sqft: 55,
    description: 'Acogedor estudio con diseño minimalista.',
    lat: 19.4363,
    lng: -99.1910,
    imagePrompt: 'Minimalist studio apartment, white walls, wooden floors, large windows'
  },
  {
    title: 'Villa con Alberca Infinita',
    address: 'Valle de Bravo Centro',
    state: 'Estado de México',
    municipality: 'Valle de Bravo',
    price: 18000000,
    type: 'casa',
    listing_type: 'venta',
    bedrooms: 5,
    bathrooms: 5,
    parking: 4,
    sqft: 550,
    description: 'Espectacular villa de lujo con alberca infinita.',
    lat: 19.1931,
    lng: -100.1357,
    imagePrompt: 'Luxury villa with infinity pool, mountain backdrop, modern architecture, sunset'
  },
  {
    title: 'Hacienda Colonial',
    address: 'Camino Real 789',
    state: 'Yucatán',
    municipality: 'Mérida',
    price: 11000000,
    type: 'casa',
    listing_type: 'venta',
    bedrooms: 6,
    bathrooms: 4,
    parking: 3,
    sqft: 480,
    description: 'Majestuosa hacienda de estilo colonial mexicano.',
    lat: 20.9674,
    lng: -89.5926,
    imagePrompt: 'Traditional Mexican hacienda exterior, arches, colorful walls, garden patio'
  },
  {
    title: 'Loft Industrial',
    address: 'Roma Norte 234',
    state: 'Ciudad de México',
    municipality: 'Cuauhtémoc',
    price: 4800000,
    type: 'departamento',
    listing_type: 'venta',
    bedrooms: 2,
    bathrooms: 2,
    parking: 1,
    sqft: 140,
    description: 'Moderno loft con techos altos, muros de ladrillo expuesto.',
    lat: 19.4150,
    lng: -99.1637,
    imagePrompt: 'Modern loft apartment with exposed brick walls, industrial style, high ceilings'
  },
  {
    title: 'Casa Familiar Residencial',
    address: 'Calle Pinos 567',
    state: 'Querétaro',
    municipality: 'Querétaro',
    price: 6200000,
    type: 'casa',
    listing_type: 'venta',
    bedrooms: 4,
    bathrooms: 3,
    parking: 2,
    sqft: 280,
    description: 'Amplia casa familiar en fraccionamiento privado.',
    lat: 20.5888,
    lng: -100.3899,
    imagePrompt: 'Family home exterior with front yard, two-story house, suburban neighborhood'
  },
  {
    title: 'Edificio de Oficinas',
    address: 'Santa Fe 901',
    state: 'Ciudad de México',
    municipality: 'Álvaro Obregón',
    price: 45000000,
    type: 'local',
    listing_type: 'venta',
    bedrooms: null,
    bathrooms: 10,
    parking: 50,
    sqft: 1200,
    description: 'Moderno edificio corporativo con fachada de cristal.',
    lat: 19.3569,
    lng: -99.2676,
    imagePrompt: 'Office building exterior, modern glass facade, corporate architecture, blue sky'
  },
  {
    title: 'Cabaña en Bosque',
    address: 'Carretera a Huasca',
    state: 'Hidalgo',
    municipality: 'Mineral del Chico',
    price: 3800000,
    type: 'casa',
    listing_type: 'venta',
    bedrooms: 3,
    bathrooms: 2,
    parking: 2,
    sqft: 180,
    description: 'Acogedora cabaña de madera en medio del bosque.',
    lat: 20.2095,
    lng: -98.7253,
    imagePrompt: 'Cozy cabin in the woods, wooden exterior, mountain setting, pine trees'
  },
  {
    title: 'Complejo Residencial',
    address: 'Av. Universidad 678',
    state: 'Puebla',
    municipality: 'Puebla',
    price: 35000000,
    type: 'departamento',
    listing_type: 'venta',
    bedrooms: null,
    bathrooms: null,
    parking: 30,
    sqft: 2500,
    description: 'Moderno complejo residencial de 6 pisos.',
    lat: 19.0414,
    lng: -98.2063,
    imagePrompt: 'Urban apartment building exterior, modern residential complex, balconies, evening lighting'
  },
  {
    title: 'Local para Restaurante',
    address: 'Playa del Carmen Centro',
    state: 'Quintana Roo',
    municipality: 'Solidaridad',
    price: 7500000,
    type: 'local',
    listing_type: 'renta',
    bedrooms: null,
    bathrooms: 3,
    parking: 5,
    sqft: 250,
    description: 'Espacio comercial ideal para restaurante.',
    lat: 20.6296,
    lng: -87.0739,
    imagePrompt: 'Restaurant space interior, dining area, modern design, ambient lighting'
  },
  {
    title: 'Townhouse Contemporáneo',
    address: 'Condesa 345',
    state: 'Ciudad de México',
    municipality: 'Cuauhtémoc',
    price: 7800000,
    type: 'casa',
    listing_type: 'venta',
    bedrooms: 3,
    bathrooms: 2,
    parking: 1,
    sqft: 210,
    description: 'Moderno townhouse en fila, diseño contemporáneo.',
    lat: 19.4120,
    lng: -99.1718,
    imagePrompt: 'Townhouse exterior, row houses, contemporary design, urban setting'
  },
  {
    title: 'Bodega Industrial',
    address: 'Parque Industrial Norte',
    state: 'Nuevo León',
    municipality: 'Apodaca',
    price: 12000000,
    type: 'local',
    listing_type: 'venta',
    bedrooms: null,
    bathrooms: 2,
    parking: 10,
    sqft: 800,
    description: 'Amplia bodega industrial con techos altos.',
    lat: 25.7800,
    lng: -100.1889,
    imagePrompt: 'Warehouse interior, industrial space, high ceilings, concrete floors'
  },
  {
    title: 'Rancho Campestre',
    address: 'Tequisquiapan Centro',
    state: 'Querétaro',
    municipality: 'Tequisquiapan',
    price: 22000000,
    type: 'casa',
    listing_type: 'venta',
    bedrooms: 5,
    bathrooms: 4,
    parking: 6,
    sqft: 650,
    description: 'Espectacular rancho con caballerizas y amplios terrenos.',
    lat: 20.5205,
    lng: -99.8896,
    imagePrompt: 'Countryside ranch house, large property, rural setting, horses, barn'
  },
  {
    title: 'Condominio de Lujo',
    address: 'Av. Masaryk 1200',
    state: 'Ciudad de México',
    municipality: 'Miguel Hidalgo',
    price: 9800000,
    type: 'departamento',
    listing_type: 'venta',
    bedrooms: 3,
    bathrooms: 3,
    parking: 2,
    sqft: 200,
    description: 'Elegante departamento en condominio de lujo con lobby de mármol.',
    lat: 19.4320,
    lng: -99.2025,
    imagePrompt: 'Luxury condominium lobby, marble floors, modern design, elegant entrance'
  }
];

async function generateImage(prompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image-preview',
      messages: [{
        role: 'user',
        content: `${prompt}, ultra high resolution, 16:9 aspect ratio`
      }],
      modalities: ['image', 'text']
    })
  });

  const data = await response.json();
  const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  if (!imageBase64) {
    throw new Error('No image generated');
  }
  
  return imageBase64;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    console.log('Setting up demo properties for user:', user.id);

    // Check if user already has agent role
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'agent')
      .single();

    if (!existingRole) {
      // Insert agent role into user_roles table
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ 
          user_id: user.id,
          role: 'agent'
        });

      if (roleError) {
        console.error('Error granting agent role:', roleError);
        throw roleError;
      }

      console.log('Agent role granted to user');
    }

    // Update verification status in profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_verified: true })
      .eq('id', user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    console.log('User profile updated');

    // Create properties with images
    const createdProperties = [];
    
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      console.log(`Creating property ${i + 1}/20: ${property.title}`);

      // Insert property
      const { data: newProperty, error: propertyError } = await supabase
        .from('properties')
        .insert({
          ...property,
          agent_id: user.id,
          status: 'activa'
        })
        .select()
        .single();

      if (propertyError) {
        console.error('Error creating property:', propertyError);
        continue;
      }

      console.log(`Property created with ID: ${newProperty.id}`);

      // Generate and upload image
      try {
        console.log('Generating image...');
        const imageBase64 = await generateImage(property.imagePrompt);
        
        // Convert base64 to blob
        const base64Data = imageBase64.split(',')[1];
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        // Upload to storage
        const fileName = `${newProperty.id}-main.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('property-images')
          .upload(fileName, binaryData, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          continue;
        }

        console.log('Image uploaded:', fileName);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(fileName);

        // Insert image record
        const { error: imageError } = await supabase
          .from('images')
          .insert({
            property_id: newProperty.id,
            url: urlData.publicUrl,
            position: 0
          });

        if (imageError) {
          console.error('Error creating image record:', imageError);
        } else {
          console.log('Image record created');
        }

        createdProperties.push({
          ...newProperty,
          imageUrl: urlData.publicUrl
        });
      } catch (imageError) {
        console.error('Error with image generation/upload:', imageError);
        createdProperties.push(newProperty);
      }
    }

    console.log(`Setup complete! Created ${createdProperties.length} properties`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Setup complete! Created ${createdProperties.length} properties`,
        properties: createdProperties
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in setup-demo-properties:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
