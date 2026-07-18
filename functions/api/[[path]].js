var MANIFEST_SOURCES = [
  {
    name: 'ManifestHub (Principal)',
    owner: 'SteamAutoCracks',
    repo: 'ManifestHub',
    type: 'github'
  },
  {
    name: 'ManifestHub3 (Mirror)',
    owner: 'steamtools-games',
    repo: 'ManifestHub3',
    type: 'github'
  },
  {
    name: 'Metastem (Mirror)',
    owner: 'Metastem',
    repo: 'ManifestHub',
    type: 'github'
  }
];

export async function onRequest(context) {
  var request = context.request;
  var url = new URL(request.url);

  var corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  if (path === '/api/download') {
    return handleDownload(url, corsHeaders);
  }
  if (path === '/api/search') {
    return handleSearch(url, corsHeaders);
  }

  return jsonResp(corsHeaders, { error: 'Not found' }, 404);
}

function jsonResp(headers, data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function handleSteamApi(url, headers) {
  var appId = url.searchParams.get('appid');
  if (!appId || isNaN(appId)) {
    return jsonResp(headers, { error: 'App ID invalido' }, 400);
  }

  try {
    var res = await fetch(
      'https://store.steampowered.com/api/appdetails?appids=' + appId + '&l=english',
      { headers: { 'User-Agent': 'SteamManifestFinder/2.0' } }
    );
    if (!res.ok) return jsonResp(headers, { error: 'Steam API error: ' + res.status }, 502);
    var data = await res.json();
    if (!data[appId] || !data[appId].success) {
      return jsonResp(headers, { error: 'Juego no encontrado' }, 404);
    }
    return new Response(JSON.stringify(data), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return jsonResp(headers, { error: err.message }, 502);
  }
}

async function handleSearch(url, headers) {
  var query = url.searchParams.get('q');
  if (!query) return jsonResp(headers, { error: 'Query required' }, 400);

  try {
    var res = await fetch(
      'https://store.steampowered.com/api/storesearch/?term=' + encodeURIComponent(query) + '&l=english&cc=US',
      { headers: { 'User-Agent': 'SteamManifestFinder/2.0' } }
    );
    if (!res.ok) return jsonResp(headers, { error: 'Search error' }, 502);
    var data = await res.json();
    var items = (data.items || []).map(function(item) {
      return { id: item.id, name: item.name, type: item.type };
    });
    return new Response(JSON.stringify({ results: items }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return jsonResp(headers, { error: err.message }, 502);
  }
}

async function handleManifests(url, headers) {
  var appId = url.searchParams.get('appid');
  var sourceIndex = parseInt(url.searchParams.get('source') || '0');

  if (!appId || isNaN(appId)) {
    return jsonResp(headers, { error: 'App ID invalido' }, 400);
  }

  var cacheKey = 'mf-' + appId;
  try {
    var cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  } catch (e) {}

  var allResults = [];
  var errors = [];

  for (var i = 0; i < MANIFEST_SOURCES.length; i++) {
    var source = MANIFEST_SOURCES[i];
    try {
      var branchRes = await fetch(
        'https://api.github.com/repos/' + source.owner + '/' + source.repo + '/branches/' + appId,
        {
          headers: {
            'User-Agent': 'SteamManifestFinder/2.0',
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (branchRes.ok) {
        var treeRes = await fetch(
          'https://api.github.com/repos/' + source.owner + '/' + source.repo + '/git/trees/' + appId + '?recursive=1',
          {
            headers: {
              'User-Agent': 'SteamManifestFinder/2.0',
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );

        if (treeRes.ok) {
          var tree = await treeRes.json();
          var files = (tree.tree || [])
            .filter(function(f) { return f.type === 'blob'; })
            .map(function(f) {
              var ext = f.path.split('.').pop().toLowerCase();
              return {
                path: f.path,
                name: f.path.split('/').pop(),
                size: f.size || 0,
                sha: f.sha,
                ext: ext,
                isManifest: ext === 'manifest',
                isLua: ext === 'lua',
                isVdf: ext === 'vdf' || f.path === 'key.vdf',
                isJson: ext === 'json',
                rawUrl: 'https://raw.githubusercontent.com/' + source.owner + '/' + source.repo + '/' + appId + '/' + f.path,
                htmlUrl: 'https://github.com/' + source.owner + '/' + source.repo + '/blob/' + appId + '/' + f.path
              };
            });

          allResults.push({
            source: source.name,
            owner: source.owner,
            repo: source.repo,
            branch: appId,
            files: files,
            manifestCount: files.filter(function(f) { return f.isManifest; }).length,
            totalCount: files.length
          });
        }
      } else if (branchRes.status === 404) {
        errors.push(source.name + ': No encontrado');
      } else {
        errors.push(source.name + ': HTTP ' + branchRes.status);
      }
    } catch (err) {
      errors.push(source.name + ': ' + err.message);
    }
  }

  var bestResult = allResults.sort(function(a, b) {
    return b.manifestCount - a.manifestCount;
  })[0] || null;

  var response = {
    appId: parseInt(appId),
    found: allResults.length > 0,
    primarySource: bestResult ? bestResult.source : null,
    sources: allResults,
    best: bestResult,
    errors: errors,
    allFiles: bestResult ? bestResult.files : [],
    manifests: bestResult ? bestResult.files.filter(function(f) { return f.isManifest; }) : [],
    totalManifests: bestResult ? bestResult.manifestCount : 0
  };

  var resp = new Response(JSON.stringify(response), {
    headers: { ...headers, 'Content-Type': 'application/json' }
  });

  try {
    resp.headers.set('Cache-Control', 'max-age=300');
    var cache = caches.default;
    await cache.put(cacheKey, resp.clone());
  } catch (e) {}

  return resp;
}

async function handleDownload(url, headers) {
  var fileUrl = url.searchParams.get('url');
  var filename = url.searchParams.get('name') || 'manifest.manifest';

  if (!fileUrl) {
    return jsonResp(headers, { error: 'URL required' }, 400);
  }

  try {
    var decodedUrl = decodeURIComponent(fileUrl);
    var res = await fetch(decodedUrl, {
      headers: { 'User-Agent': 'SteamManifestFinder/2.0' },
      redirect: 'follow'
    });

    if (!res.ok) {
      return jsonResp(headers, { error: 'Download failed: HTTP ' + res.status }, res.status);
    }

    var contentType = res.headers.get('content-type') || 'application/octet-stream';
    var newHeaders = new Headers(headers);
    newHeaders.set('Content-Type', contentType);
    newHeaders.set('Content-Disposition', 'attachment; filename="' + filename + '"');

    return new Response(res.body, { status: 200, headers: newHeaders });
  } catch (err) {
    return jsonResp(headers, { error: err.message }, 502);
  }
}
