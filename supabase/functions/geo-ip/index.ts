import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null;

  if (!ip) {
    return new Response(
      JSON.stringify({ ip: null, city: null, region: null, country: null, latitude: null, longitude: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let geoData: any = null;

  // Try ipapi.co first
  try {
    const resp = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'User-Agent': 'GestaoEBD/1.0' },
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.ip && !data.error) {
        geoData = data;
      }
    }
  } catch (e) {
    console.warn('ipapi.co failed:', e);
  }

  // Fallback to ip-api.com
  if (!geoData) {
    try {
      const resp = await fetch(`http://ip-api.com/json/${ip}?fields=query,city,regionName,country,lat,lon`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.status === 'success') {
          geoData = {
            ip: data.query,
            city: data.city,
            region: data.regionName,
            country: data.country,
            latitude: data.lat,
            longitude: data.lon,
          };
        }
      }
    } catch (e) {
      console.warn('ip-api.com fallback failed:', e);
    }
  }

  const result = {
    ip: geoData?.ip || ip,
    city: geoData?.city || null,
    region: geoData?.region || geoData?.region_name || null,
    country: geoData?.country_name || geoData?.country || null,
    latitude: geoData?.latitude || null,
    longitude: geoData?.longitude || null,
  };

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
