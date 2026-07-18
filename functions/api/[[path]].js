var GH_REPOS = [
  { owner: 'SteamAutoCracks', repo: 'ManifestHub', name: 'ManifestHub' },
  { owner: 'steamtools-games', repo: 'ManifestHub3', name: 'ManifestHub3' },
  { owner: 'Metastem', repo: 'ManifestHub', name: 'Metastem' },
  { owner: 'SSMGAlt', repo: 'ManifestHub2', name: 'ManifestHub2' },
  { owner: 'pjy612', repo: 'SteamManifestCache', name: 'SteamManifestCache' },
  { owner: 'therealgofrez', repo: 'steam-manifests-archive', name: 'ManifestsArchive' },
  { owner: 'BlankTMing', repo: 'ManifestAutoUpdate', name: 'ManifestAutoUpdate' },
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

  if (path === '/api/steam') return handleSteamApi(url, corsHeaders);
  if (path === '/api/manifests') return handleManifests(url, corsHeaders);
  if (path === '/api/download') return handleDownload(url, corsHeaders);
  if (path === '/api/search') return handleSearch(url, corsHeaders);

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
  if (!appId || isNaN(appId)) return jsonResp(headers, { error: 'Invalid' }, 400);
  try {
    var res = await fetch('https://store.steampowered.com/api/appdetails?appids=' + appId + '&l=english', {
      headers: { 'User-Agent': 'SteamMF/2.0' }
    });
    if (!res.ok) return jsonResp(headers, { error: 'Steam error' }, 502);
    var data = await res.json();
    return new Response(JSON.stringify(data), { headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (e) {
    return jsonResp(headers, { error: e.message }, 502);
  }
}

async function handleSearch(url, headers) {
  var query = url.searchParams.get('q');
  if (!query) return jsonResp(headers, { error: 'Query required' }, 400);
  try {
    var res = await fetch('https://store.steampowered.com/api/storesearch/?term=' + encodeURIComponent(query) + '&l=english&cc=US', {
      headers: { 'User-Agent': 'SteamMF/2.0' }
    });
    if (!res.ok) return jsonResp(headers, { error: 'Search error' }, 502);
    var data = await res.json();
    var items = (data.items || []).map(function(i) { return { id: i.id, name: i.name, type: i.type }; });
    return new Response(JSON.stringify({ results: items }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (e) {
    return jsonResp(headers, { error: e.message }, 502);
  }
}

async function handleManifests(url, headers) {
  var appId = url.searchParams.get('appid');
  if (!appId || isNaN(appId)) return jsonResp(headers, { error: 'Invalid' }, 400);

  var cacheKey = 'mf-' + appId;
  try {
    var cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  } catch (e) {}

  var allSources = [];
  var bestResult = null;

  var ghPromises = GH_REPOS.map(function(source) {
    return checkGitHubRepo(appId, source);
  });

  var steamtoolsPromise = checkSteamtoolsGames(appId);

  var ghResults = await Promise.all(ghPromises);

  for (var i = 0; i < ghResults.length; i++) {
    var r = ghResults[i];
    if (r) {
      allSources.push(r);
      if (!bestResult || r.manifestCount > bestResult.manifestCount) {
        bestResult = r;
      }
    }
  }

  if (!bestResult) {
    var stResult = await steamtoolsPromise;
    if (stResult) {
      allSources.push(stResult);
      bestResult = stResult;
    }
  } else {
    var stResult2 = await steamtoolsPromise;
    if (stResult2) allSources.push(stResult2);
  }

  var response = {
    appId: parseInt(appId),
    found: bestResult !== null,
    source: bestResult ? bestResult.source : null,
    allSources: allSources.map(function(s) { return { name: s.source, files: s.totalCount, manifests: s.manifestCount }; }),
    files: bestResult ? bestResult.files : [],
    manifests: bestResult ? bestResult.files.filter(function(f) { return f.isManifest; }) : [],
    totalManifests: bestResult ? bestResult.manifestCount : 0
  };

  var resp = new Response(JSON.stringify(response), {
    headers: { ...headers, 'Content-Type': 'application/json' }
  });

  try {
    resp.headers.set('Cache-Control', 'max-age=300');
    await caches.default.put(cacheKey, resp.clone());
  } catch (e) {}

  return resp;
}

async function checkGitHubRepo(appId, source) {
  try {
    var res = await fetch(
      'https://api.github.com/repos/' + source.owner + '/' + source.repo + '/branches/' + appId,
      { headers: { 'User-Agent': 'SteamMF/2.0', 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) return null;

    var treeRes = await fetch(
      'https://api.github.com/repos/' + source.owner + '/' + source.repo + '/git/trees/' + appId + '?recursive=1',
      { headers: { 'User-Agent': 'SteamMF/2.0', 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (!treeRes.ok) return null;

    var tree = await treeRes.json();
    var files = (tree.tree || [])
      .filter(function(f) { return f.type === 'blob'; })
      .map(function(f) {
        var ext = f.path.split('.').pop().toLowerCase();
        var name = f.path.split('/').pop();
        return {
          path: f.path,
          name: name,
          size: f.size || 0,
          sha: f.sha,
          ext: ext,
          isManifest: ext === 'manifest',
          isLua: ext === 'lua',
          isVdf: ext === 'vdf' || name === 'key.vdf',
          isJson: ext === 'json',
          rawUrl: 'https://raw.githubusercontent.com/' + source.owner + '/' + source.repo + '/' + appId + '/' + f.path,
          htmlUrl: 'https://github.com/' + source.owner + '/' + source.repo + '/blob/' + appId + '/' + f.path
        };
      });

    return {
      source: source.name,
      files: files,
      manifestCount: files.filter(function(f) { return f.isManifest; }).length,
      totalCount: files.length
    };
  } catch (e) {
    return null;
  }
}

async function checkSteamtoolsGames(appId) {
  try {
    var res = await fetch('https://steamtools.games/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SteamMF/2.0' },
      body: JSON.stringify({ appId: appId, branch: 'public' })
    });
    if (!res.ok) return null;

    var data = await res.json();
    if (data.code !== 0 || !data.data) return null;

    var d = data.data;
    var files = [];
    if (d.downloadUrl) {
      files.push({ name: appId + '_manifest.zip', rawUrl: d.downloadUrl, isManifest: true, ext: 'zip', size: 0 });
    }
    if (d.luaUrl) {
      files.push({ name: appId + '.lua', rawUrl: d.luaUrl, isLua: true, ext: 'lua', size: 0 });
    }
    if (d.keyVdfUrl) {
      files.push({ name: 'key.vdf', rawUrl: d.keyVdfUrl, isVdf: true, ext: 'vdf', size: 0 });
    }

    if (files.length === 0) return null;

    return {
      source: 'steamtools.games',
      files: files,
      manifestCount: files.filter(function(f) { return f.isManifest; }).length,
      totalCount: files.length
    };
  } catch (e) {
    return null;
  }
}

async function handleDownload(url, headers) {
  var fileUrl = url.searchParams.get('url');
  var filename = url.searchParams.get('name') || 'manifest';

  if (!fileUrl) return jsonResp(headers, { error: 'URL required' }, 400);

  try {
    var decodedUrl = decodeURIComponent(fileUrl);
    var res = await fetch(decodedUrl, {
      headers: { 'User-Agent': 'SteamMF/2.0' },
      redirect: 'follow'
    });

    if (!res.ok) return jsonResp(headers, { error: 'Failed: ' + res.status }, res.status);

    var ct = res.headers.get('content-type') || 'application/octet-stream';
    var h = new Headers(headers);
    h.set('Content-Type', ct);
    h.set('Content-Disposition', 'attachment; filename="' + filename + '"');

    return new Response(res.body, { status: 200, headers: h });
  } catch (e) {
    return jsonResp(headers, { error: e.message }, 502);
  }
}
