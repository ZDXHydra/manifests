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
  if (path === '/api/trending') return handleTrending(url, corsHeaders);

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

async function handleManifests(url, headers) {
  var appId = url.searchParams.get('appid');
  if (!appId || isNaN(appId)) return jsonResp(headers, { error: 'Invalid' }, 400);

  var cacheKey = 'mf-' + appId;
  try {
    var cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  } catch (e) {}

  var mergedFiles = [];
  var sourcesFound = [];
  var seenPaths = {};

  var ghPromises = GH_REPOS.map(function(source) {
    return checkGitHubRepo(appId, source);
  });

  var ghResults = await Promise.allSettled(ghPromises);

  for (var i = 0; i < ghResults.length; i++) {
    var r = ghResults[i].value || null;
    if (r && r.files.length > 0) {
      sourcesFound.push({ name: r.source, files: r.totalCount, manifests: r.manifestCount });
      for (var j = 0; j < r.files.length; j++) {
        var f = r.files[j];
        var key = f.name + '_' + (f.size || 0);
        if (!seenPaths[key]) {
          seenPaths[key] = true;
          f.source = r.source;
          mergedFiles.push(f);
        }
      }
    }
  }

  var stResult = await checkSteamtoolsGames(appId);
  if (stResult && stResult.files.length > 0) {
    sourcesFound.push({ name: stResult.source, files: stResult.totalCount, manifests: stResult.manifestCount });
    for (var k = 0; k < stResult.files.length; k++) {
      var sf = stResult.files[k];
      var skey = sf.name + '_' + (sf.size || 0);
      if (!seenPaths[skey]) {
        seenPaths[skey] = true;
        sf.source = stResult.source;
        mergedFiles.push(sf);
      }
    }
  }

  var manifests = mergedFiles.filter(function(f) { return f.isManifest; });

  var response = {
    appId: parseInt(appId),
    found: mergedFiles.length > 0,
    source: sourcesFound.length > 0 ? sourcesFound[0].name : null,
    allSources: sourcesFound,
    files: mergedFiles,
    totalManifests: manifests.length,
    totalFiles: mergedFiles.length
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
        var parts = f.path.split('/');
        var name = parts[parts.length - 1];
        var ext = name.split('.').pop().toLowerCase();
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
    if (d.downloadUrl) files.push({ name: appId + '_package.zip', rawUrl: d.downloadUrl, isManifest: false, isZip: true, ext: 'zip', size: 0 });
    if (d.luaUrl) files.push({ name: appId + '.lua', rawUrl: d.luaUrl, isLua: true, ext: 'lua', size: 0 });
    if (d.keyVdfUrl) files.push({ name: 'key.vdf', rawUrl: d.keyVdfUrl, isVdf: true, ext: 'vdf', size: 0 });
    if (files.length === 0) return null;
    return { source: 'steamtools.games', files: files, manifestCount: 0, totalCount: files.length };
  } catch (e) {
    return null;
  }
}

async function handleTrending(url, headers) {
  var cacheKey = 'trending';
  try {
    var cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  } catch (e) {}

  try {
    var res = await fetch('https://store.steampowered.com/api/featuredcategories/?cc=us&l=english', {
      headers: { 'User-Agent': 'SteamMF/2.0' }
    });
    if (!res.ok) return jsonResp(headers, { error: 'Steam API error' }, 502);
    var data = await res.json();

    var games = [];
    var seen = {};

    var categories = ['top_sellers', 'new_releases', 'specials'];
    var exclude = [/^steam deck/i, /^steam machine/i, /^steam controller/i, /^steam link/i, /^steamVR/i];
    for (var i = 0; i < categories.length; i++) {
      var cat = data[categories[i]];
      if (!cat || !cat.items) continue;
      for (var j = 0; j < cat.items.length; j++) {
        var item = cat.items[j];
        if (seen[item.id]) continue;
        if (!item.windows_available) continue;
        var skip = false;
        for (var k = 0; k < exclude.length; k++) {
          if (exclude[k].test(item.name)) { skip = true; break; }
        }
        if (skip) continue;
        seen[item.id] = true;
        games.push({
          id: item.id,
          name: item.name,
          image: item.large_capsule_image || item.header_image,
          price: item.final_price || 0,
          discount: item.discount_percent || 0,
          originalPrice: item.original_price || 0,
          currency: item.currency || 'USD'
        });
      }
    }

    var resp = jsonResp(headers, { games: games.slice(0, 20) });
    resp.headers.set('Cache-Control', 'max-age=600');
    try { await caches.default.put(cacheKey, resp.clone()); } catch (e) {}
    return resp;
  } catch (e) {
    return jsonResp(headers, { error: e.message }, 502);
  }
}

async function handleDownload(url, headers) {
  var fileUrl = url.searchParams.get('url');
  var filename = url.searchParams.get('name') || 'manifest';
  if (!fileUrl) return jsonResp(headers, { error: 'URL required' }, 400);
  try {
    var decodedUrl = decodeURIComponent(fileUrl);
    var res = await fetch(decodedUrl, { headers: { 'User-Agent': 'SteamMF/2.0' }, redirect: 'follow' });
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
