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
  copyAllBtn: document.getElementById('copyAllBtn'),
};

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function setError(msg) { els.error.textContent = msg; show(els.error); }
function clearError() { hide(els.error); }

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
    var err = await res.json().catch(function() { return { error: 'Error del servidor' }; });
    throw new Error(err.error || 'Error al buscar manifests');
  }
  return await res.json();
}

async function doFetch() {
  var appId = els.input.value.trim();
  if (!appId || isNaN(appId) || appId <= 0) {
    setError('Ingresa un App ID valido (solo numeros).');
    return;
  }

  clearError();
  hide(els.results);
  hide(els.welcome);
  show(els.loading);

  try {
    var [gameInfo, manifests] = await Promise.all([
      fetchGameInfo(appId),
      fetchManifests(appId)
    ]);

    hide(els.loading);

    if (!manifests.found) {
      setError('App ID ' + appId + ' no encontrado en ManifestHub. ' +
        (manifests.errors.length > 0 ? 'Detalles: ' + manifests.errors.join('; ') : '') +
        ' Prueba buscar el ID en SteamDB: https://steamdb.info/app/' + appId);
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
    els.sourceInfo.textContent = 'Fuente: ' + manifests.primarySource +
      (manifests.sources.length > 1 ? ' (+ ' + (manifests.sources.length - 1) + ' mas)' : '');

    renderFiles(manifests.allFiles);

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

  var html = '';

  if (manifests.length > 0) {
    html += '<div class="file-section">';
    html += '<h4 class="file-section-title">Manifest Files <span class="file-badge">' + manifests.length + '</span></h4>';
    manifests.forEach(function(f) {
      html += buildFileRow(f, 'manifest');
    });
    html += '</div>';
  }

  if (luaFiles.length > 0) {
    html += '<div class="file-section">';
    html += '<h4 class="file-section-title">Lua Scripts <span class="file-badge">' + luaFiles.length + '</span></h4>';
    luaFiles.forEach(function(f) {
      html += buildFileRow(f, 'lua');
    });
    html += '</div>';
  }

  if (vdfFiles.length > 0) {
    html += '<div class="file-section">';
    html += '<h4 class="file-section-title">Key / VDF Files <span class="file-badge">' + vdfFiles.length + '</span></h4>';
    vdfFiles.forEach(function(f) {
      html += buildFileRow(f, 'vdf');
    });
    html += '</div>';
  }

  if (jsonFiles.length > 0) {
    html += '<div class="file-section">';
    html += '<h4 class="file-section-title">JSON Config <span class="file-badge">' + jsonFiles.length + '</span></h4>';
    jsonFiles.forEach(function(f) {
      html += buildFileRow(f, 'json');
    });
    html += '</div>';
  }

  els.fileList.innerHTML = html;
}

function buildFileRow(f, type) {
  var icon = type === 'manifest' ? '\uD83D\uDCE6' : type === 'lua' ? '\uD83D\uDCDC' : type === 'vdf' ? '\uD83D\uDD11' : '\uD83D\uDCC4';
  var sizeStr = f.size ? formatBytes(f.size) : '';
  var escapedUrl = f.rawUrl.replace(/'/g, "\\'");

  return '<div class="file-row file-type-' + type + '">' +
    '<div class="file-info">' +
      '<span class="file-icon">' + icon + '</span>' +
      '<div class="file-details">' +
        '<span class="file-name">' + f.name + '</span>' +
        '<span class="file-meta">' + sizeStr + (f.sha ? ' · ' + f.sha.substring(0, 8) : '') + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="file-actions">' +
      '<button class="btn-dl" onclick="downloadFile(\'' + escapedUrl + '\', \'' + f.name.replace(/'/g, "\\'") + '\')" title="Descargar">Descargar</button>' +
      '<button class="btn-github" onclick="window.open(\'' + f.htmlUrl + '\', \'_blank\')" title="Ver en GitHub">GitHub</button>' +
    '</div>' +
  '</div>';
}

async function downloadAll() {
  if (!currentData || !currentData.allFiles.length) return;

  if (typeof JSZip === 'undefined') {
    setError('JSZip no se cargo. Recarga la pagina.');
    return;
  }

  var zip = new JSZip();
  var folderName = currentData.appId + '_manifests';
  var folder = zip.folder(folderName);
  var manifests = currentData.allFiles.filter(function(f) { return f.isManifest || f.isLua || f.isVdf; });

  els.downloadAllBtn.textContent = 'Descargando...';
  els.downloadAllBtn.disabled = true;

  for (var i = 0; i < manifests.length; i++) {
    var f = manifests[i];
    try {
      var res = await fetch(API + '/download?url=' + encodeURIComponent(f.rawUrl) + '&name=' + encodeURIComponent(f.name));
      if (res.ok) {
        var blob = await res.blob();
        folder.file(f.name, blob);
      } else {
        folder.file(f.name + '.error.txt', 'Download failed: HTTP ' + res.status);
      }
    } catch (e) {
      folder.file(f.name + '.error.txt', 'Error: ' + e.message);
    }
  }

  folder.file('info.json', JSON.stringify({
    appId: currentData.appId,
    source: currentData.primarySource,
    totalManifests: currentData.totalManifests,
    timestamp: new Date().toISOString()
  }, null, 2));

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
