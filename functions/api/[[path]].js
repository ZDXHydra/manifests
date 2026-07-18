export async function onRequest(context) {
  var request = context.request;
  var url = new URL(request.url);

  var corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  var path = url.pathname;

  if (path === '/api/steam') {
    return handleSteamApi(url, corsHeaders);
  }

  if (path === '/api/manifests') {
    return handleManifests(url, corsHeaders);
  }

  if (path === '/api/download-manifest') {
    return handleDownloadManifest(url, corsHeaders);
  }

  return new Response(JSON.stringify({ error: 'Not found', path: path }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleSteamApi(url, headers) {
  var appId = url.searchParams.get('appid');
  var filters = url.searchParams.get('filters') || '';

  if (!appId || isNaN(appId)) {
    return jsonResponse(headers, { error: 'App ID invalido' }, 400);
  }

  var steamUrl = 'https://store.steampowered.com/api/appdetails?appids=' + appId + '&l=spanish';
  if (filters) steamUrl += '&filters=' + filters;

  try {
    var res = await fetch(steamUrl, {
      headers: { 'User-Agent': 'SteamManifestFinder/1.0' },
    });

    if (!res.ok) {
      return jsonResponse(headers, { error: 'Steam API error: ' + res.status }, 502);
    }

    var data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return jsonResponse(headers, { error: err.message }, 502);
  }
}

async function handleManifests(url, headers) {
  var appId = url.searchParams.get('appid');

  if (!appId || isNaN(appId)) {
    return jsonResponse(headers, { error: 'App ID invalido' }, 400);
  }

  try {
    var cdnServers = await getCdnServers();
    if (cdnServers.length === 0) {
      return jsonResponse(headers, { error: 'No se encontraron servidores CDN de Steam' }, 502);
    }

    var gameInfo = await getAppInfo(appId);

    var depots = [{ id: parseInt(appId), name: gameInfo.name, type: 'main' }];
    if (gameInfo.dlc && Array.isArray(gameInfo.dlc)) {
      gameInfo.dlc.forEach(function(dlcId) {
        depots.push({ id: dlcId, name: 'DLC ' + dlcId, type: 'dlc' });
      });
    }

    var cdn = cdnServers.sort(function(a, b) {
      return (a.weighted_load || 0) - (b.weighted_load || 0);
    })[0];
    var cdnHost = cdn.vhost || cdn.host;
    var scheme = cdn.https_support !== false ? 'https' : 'http';

    var results = [];
    var depotsToCheck = depots.slice(0, 15);

    for (var i = 0; i < depotsToCheck.length; i++) {
      var depot = depotsToCheck[i];
      var result = await checkDepotManifest(scheme, cdnHost, depot);
      results.push(result);
    }

    return new Response(JSON.stringify({
      appId: parseInt(appId),
      gameName: gameInfo.name,
      cdnServer: cdnHost,
      scheme: scheme,
      totalDepots: depots.length,
      checked: depotsToCheck.length,
      results: results
    }), {
      headers: { ...headers, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return jsonResponse(headers, { error: err.message }, 502);
  }
}

async function handleDownloadManifest(url, headers) {
  var depotId = url.searchParams.get('depotId');
  var manifestUrl = url.searchParams.get('url');

  if (!depotId || !manifestUrl) {
    return jsonResponse(headers, { error: 'Faltan parametros: depotId y url' }, 400);
  }

  try {
    var decodedUrl = decodeURIComponent(manifestUrl);
    var res = await fetch(decodedUrl, {
      headers: { 'User-Agent': 'SteamManifestFinder/1.0' },
      redirect: 'follow'
    });

    if (!res.ok) {
      return jsonResponse(headers, { error: 'Error al descargar: HTTP ' + res.status }, res.status);
    }

    var contentType = res.headers.get('content-type') || 'application/octet-stream';
    var newHeaders = new Headers(headers);
    newHeaders.set('Content-Type', contentType);
    newHeaders.set('Content-Disposition', 'attachment; filename="depot_' + depotId + '.manifest"');

    return new Response(res.body, { status: 200, headers: newHeaders });
  } catch (err) {
    return jsonResponse(headers, { error: err.message }, 502);
  }
}

function jsonResponse(headers, data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function getCdnServers() {
  var res = await fetch(
    'https://api.steampowered.com/IContentServerDirectoryService/GetServersForSteamPipe/v1/?cell_id=0&max_servers=50',
    { headers: { 'User-Agent': 'SteamManifestFinder/1.0' } }
  );
  if (!res.ok) throw new Error('No se pudieron obtener servidores CDN');
  var data = await res.json();
  return (data.response && data.response.servers || []).filter(function(s) {
    return s.type === 'SteamCache' || s.type === 'CDN';
  });
}

async function getAppInfo(appId) {
  var res = await fetch(
    'https://store.steampowered.com/api/appdetails?appids=' + appId + '&l=spanish',
    { headers: { 'User-Agent': 'SteamManifestFinder/1.0' } }
  );
  if (!res.ok) throw new Error('Steam API error: ' + res.status);
  var data = await res.json();
  if (!data[appId] || !data[appId].success) throw new Error('Juego no encontrado');
  return data[appId].data;
}

async function checkDepotManifest(scheme, cdnHost, depot) {
  var urlPattern = scheme + '://' + cdnHost + '/depot/' + depot.id + '/manifest/0/5/0';

  try {
    var res = await fetch(urlPattern, {
      headers: { 'User-Agent': 'SteamManifestFinder/1.0' },
      redirect: 'follow'
    });

    var contentType = res.headers.get('content-type') || '';
    var contentLength = res.headers.get('content-length');

    var isManifest = res.ok && (
      contentType.indexOf('zip') !== -1 ||
      contentType.indexOf('octet-stream') !== -1 ||
      contentType.indexOf('binary') !== -1 ||
      (!contentType && res.ok)
    );

    return {
      depotId: depot.id,
      name: depot.name,
      type: depot.type,
      status: res.status,
      contentType: contentType,
      contentLength: contentLength ? parseInt(contentLength) : null,
      url: urlPattern,
      success: res.ok,
      isManifest: isManifest,
      downloadable: isManifest,
      error: !res.ok ? (
        res.status === 401 ? 'Requiere autenticacion Steam' :
        res.status === 403 ? 'Acceso denegado' :
        res.status === 404 ? 'Manifest no encontrado para este depot' :
        'Error HTTP ' + res.status
      ) : null
    };
  } catch (err) {
    return {
      depotId: depot.id,
      name: depot.name,
      type: depot.type,
      success: false,
      downloadable: false,
      error: err.message
    };
  }
}
