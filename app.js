var API = location.origin + '/api';
var currentData = null;
var gameInfoCache = {};

var els = {
  input: document.getElementById('appIdInput'),
  fetchBtn: document.getElementById('fetchBtn'),
  error: document.getElementById('error'),
  loading: document.getElementById('loading'),
  results: document.getElementById('results'),
  welcome: document.getElementById('welcome'),
  gameImg: document.getElementById('gameImg'),
  gameName: document.getElementById('gameName'),
  gameMeta: document.getElementById('gameMeta'),
  manifestCount: document.getElementById('manifestCount'),
  sourceInfo: document.getElementById('sourceInfo'),
  fileList: document.getElementById('fileList'),
  downloadAllBtn: document.getElementById('downloadAllBtn'),
};

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function setError(msg) { els.error.textContent = msg; show(els.error); }
function clearError() { hide(els.error); }

function goHome() {
  hide(els.results);
  hide(els.error);
  hide(els.loading);
  show(els.welcome);
  els.input.value = '';
  currentData = null;
  els.input.focus();
  var ts = document.getElementById('trendingSection');
  var tl = document.getElementById('trendingLoading');
  var tg = document.getElementById('trendingGrid');
  if (tg.children.length === 0 && tl.classList.contains('hidden')) {
    trendingLoaded = false;
    tl.classList.remove('hidden');
    loadTrending();
  }
}

function formatBytes(b) {
  if (!b) return '';
  var u = ['B', 'KB', 'MB', 'GB'];
  var i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return b.toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
}

function downloadBlob(filename, blob) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadFile(url, name) {
  var fullUrl = API + '/download?url=' + encodeURIComponent(url) + '&name=' + encodeURIComponent(name);
  var a = document.createElement('a');
  a.href = fullUrl;
  a.download = name;
  a.click();
}

async function fetchGameInfo(appId) {
  if (gameInfoCache[appId]) return gameInfoCache[appId];
  try {
    var res = await fetch(API + '/steam?appid=' + appId);
    if (!res.ok) return null;
    var data = await res.json();
    if (data[appId] && data[appId].success) {
      gameInfoCache[appId] = data[appId].data;
      return data[appId].data;
    }
  } catch (e) {}
  return null;
}

async function fetchManifests(appId) {
  var res = await fetch(API + '/manifests?appid=' + appId);
  if (!res.ok) {
    var err = await res.json().catch(function() { return { error: 'Error' }; });
    throw new Error(err.error || 'Error');
  }
  return await res.json();
}

async function doFetch() {
  var appId = els.input.value.trim();
  if (!appId || isNaN(appId) || appId <= 0) {
    setError('Ingresa un App ID valido.');
    return;
  }

  clearError();
  hide(els.results);
  hide(els.welcome);
  show(els.loading);

  try {
    var results = await Promise.all([
      fetchGameInfo(appId),
      fetchManifests(appId)
    ]);
    var gameInfo = results[0];
    var manifests = results[1];

    hide(els.loading);

    if (!manifests.found) {
      setError('No se encontraron manifests para el App ID ' + appId + '. Es posible que aún no estén disponibles para este ID.');
      show(els.welcome);
      return;
    }

    currentData = manifests;

    if (gameInfo) {
      els.gameImg.src = 'https://cdn.akamai.steamstatic.com/steam/apps/' + appId + '/header.jpg';
      els.gameImg.onerror = function() {
        this.src = 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + appId + '/header.jpg';
      };
      els.gameName.textContent = gameInfo.name || 'App ' + appId;
      var meta = [];
      if (gameInfo.developers) meta.push(gameInfo.developers.join(', '));
      if (gameInfo.release_date && gameInfo.release_date.date) meta.push(gameInfo.release_date.date);
      if (gameInfo.is_free) meta.push('Free to Play');
      else if (gameInfo.price_overview) meta.push(gameInfo.price_overview.final_formatted);
      els.gameMeta.textContent = meta.join(' · ');
    } else {
      els.gameImg.src = 'https://cdn.akamai.steamstatic.com/steam/apps/' + appId + '/header.jpg';
      els.gameName.textContent = 'App ID: ' + appId;
      els.gameMeta.textContent = '';
    }

    els.manifestCount.textContent = manifests.totalManifests + ' manifest(s)';
    var sourceText = manifests.allSources.length + ' fuente(s)';
    els.sourceInfo.textContent = sourceText;

    renderFiles(manifests.files);
    show(els.results);
  } catch (err) {
    hide(els.loading);
    setError(err.message || 'Error al buscar.');
    show(els.welcome);
  }
}

function renderFiles(files) {
  var manifests = files.filter(function(f) { return f.isManifest; });
  var luaFiles = files.filter(function(f) { return f.isLua; });
  var vdfFiles = files.filter(function(f) { return f.isVdf; });
  var jsonFiles = files.filter(function(f) { return f.isJson; });
  var zipFiles = files.filter(function(f) { return f.isZip; });

  var html = '';

  if (manifests.length > 0) {
    html += '<div class="file-section">';
    html += '<h4 class="file-section-title">Manifests <span class="file-badge">' + manifests.length + '</span></h4>';
    manifests.forEach(function(f) { html += buildFileRow(f, 'manifest'); });
    html += '</div>';
  }

  if (luaFiles.length > 0) {
    html += '<div class="file-section">';
    html += '<h4 class="file-section-title">Lua Scripts <span class="file-badge">' + luaFiles.length + '</span></h4>';
    luaFiles.forEach(function(f) { html += buildFileRow(f, 'lua'); });
    html += '</div>';
  }

  if (vdfFiles.length > 0) {
    html += '<div class="file-section">';
    html += '<h4 class="file-section-title">Keys / VDF <span class="file-badge">' + vdfFiles.length + '</span></h4>';
    vdfFiles.forEach(function(f) { html += buildFileRow(f, 'vdf'); });
    html += '</div>';
  }

  if (jsonFiles.length > 0) {
    html += '<div class="file-section">';
    html += '<h4 class="file-section-title">JSON <span class="file-badge">' + jsonFiles.length + '</span></h4>';
    jsonFiles.forEach(function(f) { html += buildFileRow(f, 'json'); });
    html += '</div>';
  }

  els.fileList.innerHTML = html;
}

function buildFileRow(f, type) {
  var icons = { manifest: '\uD83D\uDCE6', lua: '\uD83D\uDCDC', vdf: '\uD83D\uDD11', json: '\uD83D\uDCC4', zip: '\uD83D\uDCE5' };
  var icon = icons[type] || '\uD83D\uDCC4';
  var sizeStr = f.size ? formatBytes(f.size) : '';
  var sourceStr = f.source ? ' · ' + f.source : '';
  var escapedUrl = f.rawUrl.replace(/'/g, "\\'");
  var escapedName = f.name.replace(/'/g, "\\'");

  return '<div class="file-row file-type-' + type + '">' +
    '<div class="file-info">' +
      '<span class="file-icon">' + icon + '</span>' +
      '<div class="file-details">' +
        '<span class="file-name">' + f.name + '</span>' +
        '<span class="file-meta">' + sizeStr + sourceStr + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="file-actions">' +
      '<button class="btn-dl" onclick="downloadFile(\'' + escapedUrl + '\', \'' + escapedName + '\')">Descargar</button>' +
      (f.htmlUrl ? '<button class="btn-github" onclick="window.open(\'' + f.htmlUrl + '\', \'_blank\')">GitHub</button>' : '') +
    '</div>' +
  '</div>';
}

async function downloadAll() {
  if (!currentData || !currentData.files.length) return;

  if (typeof JSZip === 'undefined') {
    setError('JSZip no se cargo. Recarga la pagina.');
    return;
  }

  var zip = new JSZip();
  var folderName = currentData.appId + '_manifests';
  var folder = zip.folder(folderName);

  els.downloadAllBtn.textContent = 'Descargando...';
  els.downloadAllBtn.disabled = true;

  var toDownload = currentData.files.filter(function(f) { return f.isManifest || f.isLua || f.isVdf; });
  var BATCH = 6;
  var done = 0;

  for (var b = 0; b < toDownload.length; b += BATCH) {
    var batch = toDownload.slice(b, b + BATCH);
    var promises = batch.map(function(f) {
      return fetch(API + '/download?url=' + encodeURIComponent(f.rawUrl) + '&name=' + encodeURIComponent(f.name))
        .then(function(res) {
          done++;
          els.downloadAllBtn.textContent = 'Descargando... ' + done + '/' + toDownload.length;
          if (!res.ok) return null;
          return res.blob().then(function(blob) {
            return { file: f, blob: blob };
          });
        })
        .catch(function() { done++; return null; });
    });
    var results = await Promise.all(promises);
    for (var r = 0; r < results.length; r++) {
      if (results[r]) {
        var subfolder = results[r].file.isManifest ? 'manifests' : results[r].file.isLua ? 'lua' : 'keys';
        folder.folder(subfolder).file(results[r].file.name, results[r].blob);
      }
    }
  }

  folder.file('info.json', JSON.stringify({
    appId: currentData.appId,
    sources: currentData.allSources,
    totalManifests: currentData.totalManifests,
    timestamp: new Date().toISOString()
  }, null, 2));

  folder.file('README.txt', [
    'Steam Manifests - App ID: ' + currentData.appId,
    '',
    'Sources: ' + currentData.allSources.map(function(s) { return s.name; }).join(', '),
    'Total manifests: ' + currentData.totalManifests,
    'Date: ' + new Date().toISOString(),
    '',
    'How to use:',
    '1. Copy the manifest files to your Steam depotcache folder',
    '2. Use SteamTools to import them',
    '',
    'More info: https://steamdb.info/app/' + currentData.appId,
    ''
  ].join('\n'));

  folder.file('LEEME.txt', [
    'Manifests de Steam - App ID: ' + currentData.appId,
    '',
    'Fuentes: ' + currentData.allSources.map(function(s) { return s.name; }).join(', '),
    'Total de manifests: ' + currentData.totalManifests,
    'Fecha: ' + new Date().toISOString(),
    '',
    'Como usar:',
    '1. Copia los archivos manifest a tu carpeta depotcache de Steam',
    '2. Usa SteamTools para importarlos',
    '',
    'Mas info: https://steamdb.info/app/' + currentData.appId,
    ''
  ].join('\n'));

  var content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(folderName + '.zip', content);

  els.downloadAllBtn.textContent = 'Descargar Todo (.zip)';
  els.downloadAllBtn.disabled = false;
}

els.fetchBtn.addEventListener('click', doFetch);
els.input.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') doFetch();
});
els.input.addEventListener('input', clearError);

var trendingLoaded = false;

function searchAppId(appId) {
  els.input.value = appId;
  doFetch();
}

async function loadTrending() {
  if (trendingLoaded) return;
  trendingLoaded = true;

  var grid = document.getElementById('trendingGrid');
  var loading = document.getElementById('trendingLoading');

  try {
    var res = await fetch(API + '/trending');
    if (!res.ok) throw new Error('Error');
    var data = await res.json();

    loading.classList.add('hidden');

    if (!data.games || data.games.length === 0) return;

    var html = '<h3 class="trending-title">Juegos en Tendencia</h3><div class="trending-cards">';

    data.games.forEach(function(g) {
      var priceStr = '';
      if (g.price === 0) {
        priceStr = '<span class="tp-free">Free to Play</span>';
      } else {
        var dollars = (g.price / 100).toFixed(2);
        if (g.discount > 0) {
          var orig = (g.originalPrice / 100).toFixed(2);
          priceStr = '<span class="tp-discount">-' + g.discount + '%</span>' +
                     '<span class="tp-original">$' + orig + '</span>' +
                     '<span class="tp-final">$' + dollars + '</span>';
        } else {
          priceStr = '<span class="tp-final">$' + dollars + '</span>';
        }
      }

      html += '<div class="tp-card" onclick="searchAppId(' + g.id + ')">' +
        '<img class="tp-img" src="' + g.image + '" alt="' + g.name.replace(/"/g, '&quot;') + '" loading="lazy">' +
        '<div class="tp-info">' +
          '<div class="tp-name">' + g.name + '</div>' +
          '<div class="tp-price">' + priceStr + '</div>' +
        '</div>' +
      '</div>';
    });

    html += '</div>';
    grid.innerHTML = html;
  } catch (e) {
    loading.classList.add('hidden');
  }
}

var welcomeObserver = new MutationObserver(function(mutations) {
  mutations.forEach(function(m) {
    if (!els.welcome.classList.contains('hidden')) {
      loadTrending();
    }
  });
});
welcomeObserver.observe(els.welcome, { attributes: true, attributeFilter: ['class'] });

if (!els.welcome.classList.contains('hidden')) {
  loadTrending();
}
