export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  const appId = url.searchParams.get('appid');
  const filters = url.searchParams.get('filters') || '';

  if (!appId || isNaN(appId)) {
    return new Response(
      JSON.stringify({ error: 'App ID invalido' }),
      { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }

  let steamUrl = 'https://store.steampowered.com/api/appdetails?appids=' + appId + '&l=spanish';
  if (filters) {
    steamUrl += '&filters=' + filters;
  }

  try {
    const res = await fetch(steamUrl, {
      headers: { 'User-Agent': 'SteamManifestFinder/1.0' },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: 'Steam API error: ' + res.status }),
        { status: 502, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 502, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
}
