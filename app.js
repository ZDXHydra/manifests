var IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
var CORS_PROXY = 'https://corsproxy.io/?url=';
var API_BASE = location.origin + '/api/steam';
var MANIFESTS_API = location.origin + '/api/manifests';
var DOWNLOAD_API = location.origin + '/api/download-manifest';

var appIdInput = document.getElementById('appIdInput');
var searchBtn = document.getElementById('searchBtn');
var errorEl = document.getElementById('error');
var loadingEl = document.getElementById('loading');
var resultsEl = document.getElementById('results');
var welcomeEl = document.getElementById('welcome');

var gameHeaderImage = document.getElementById('gameHeaderImage');
var gameName = document.getElementById('gameName');
var gameDeveloper = document.getElementById('gameDeveloper');
var gamePublisher = document.getElementById('gamePublisher');
var gameReleaseDate = document.getElementById('gameReleaseDate');

var infoAppId = document.getElementById('infoAppId');
var infoType = document.getElementById('infoType');
var infoState = document.getElementById('infoState');
var infoDepots = document.getElementById('infoDepots');

var officialSources = document.getElementById('officialSources');
var communitySources = document.getElementById('communitySources');
var downloadTools = document.getElementById('downloadTools');
var manifestsList = document.getElementById('manifestsList');

var currentAppId = null;
var currentGameName = null;
var currentDepots = [];
var manifestResults = [];

function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
}

function hideError() {
    errorEl.classList.add('hidden');
}

function showLoading() {
    loadingEl.classList.remove('hidden');
    resultsEl.classList.add('hidden');
    welcomeEl.classList.add('hidden');
}

function hideLoading() {
    loadingEl.classList.add('hidden');
}

function formatBytes(bytes) {
    if (!bytes) return '';
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = 0;
    var size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return size.toFixed(2) + ' ' + units[i];
}

function downloadFile(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function steamApiUrl(appId, filters) {
    var url = 'https://store.steampowered.com/api/appdetails?appids=' + appId + '&l=spanish';
    if (filters) url += '&filters=' + filters;
    if (IS_LOCAL) return CORS_PROXY + encodeURIComponent(url);
    return API_BASE + '?appid=' + appId + (filters ? '&filters=' + filters : '');
}

async function fetchSteamData(appId) {
    var url = steamApiUrl(appId);
    var response = await fetch(url);
    if (!response.ok) throw new Error('Error del servidor (' + response.status + ').');
    var data = await response.json();
    if (data.error) throw new Error(data.error);
    if (!data[appId] || !data[appId].success) throw new Error('Juego no encontrado. Verifica el App ID.');
    return data[appId].data;
}

async function fetchManifests(appId) {
    if (IS_LOCAL) {
        return null;
    }
    try {
        var response = await fetch(MANIFESTS_API + '?appid=' + appId);
        if (!response.ok) {
            var err = await response.json();
            throw new Error(err.error || 'Error al buscar manifests');
        }
        return await response.json();
    } catch (err) {
        console.warn('Error fetching manifests:', err);
        return null;
    }
}

function buildSourceCard(icon, name, type, typeLabel, desc, url) {
    return '<div class="source-card">' +
        '<div class="source-header">' +
            '<div class="source-icon">' + icon + '</div>' +
            '<div>' +
                '<div class="source-name">' + name + '</div>' +
                '<span class="source-type type-' + type + '">' + typeLabel + '</span>' +
            '</div>' +
        '</div>' +
        '<div class="source-desc">' + desc + '</div>' +
        '<a href="' + url + '" target="_blank" rel="noopener noreferrer">Ir a fuente</a>' +
    '</div>';
}

function buildSources(appId) {
    officialSources.innerHTML = [
        { icon: '\uD83C\uDFAE', name: 'Steam Store', type: 'official', typeLabel: 'Oficial', desc: 'Pagina oficial del juego.', url: 'https://store.steampowered.com/app/' + appId },
        { icon: '\uD83D\uDCCA', name: 'SteamDB - Depots', type: 'official', typeLabel: 'SteamDB', desc: 'Lista completa de depots con IDs y manifests.', url: 'https://steamdb.info/app/' + appId + '/depots/' },
        { icon: '\uD83D\uDCCA', name: 'SteamDB - Info', type: 'official', typeLabel: 'SteamDB', desc: 'Info completa del juego.', url: 'https://steamdb.info/app/' + appId + '/' },
    ].map(function(s) { return buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url); }).join('');

    communitySources.innerHTML = [
        { icon: '\uD83D\uDD0D', name: 'DepotDownloader', type: 'community', typeLabel: 'Open Source', desc: 'Descarga depots individuales con .NET.', url: 'https://github.com/SteamRE/DepotDownloader' },
        { icon: '\uD83C\uDF10', name: 'PCGamingWiki', type: 'community', typeLabel: 'Comunidad', desc: 'Info detallada sobre versiones.', url: 'https://www.pcgamingwiki.com/wiki/App:' + appId },
    ].map(function(s) { return buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url); }).join('');

    downloadTools.innerHTML = [
        { icon: '\u2699\uFE0F', name: 'SteamCMD', type: 'tool', typeLabel: 'Valve', desc: 'Herramienta oficial para descargar depots.', url: 'https://developer.valvesoftware.com/wiki/SteamCMD' },
        { icon: '\uD83D\uDCE6', name: 'DepotDownloader', type: 'tool', typeLabel: 'Open Source', desc: 'Alternativa con soporte .NET.', url: 'https://github.com/SteamRE/DepotDownloader/releases' },
    ].map(function(s) { return buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url); }).join('');
}

function copyCommand(btn) {
    var text = btn.getAttribute('data-cmd');
    navigator.clipboard.writeText(text).then(function() {
        var orig = btn.textContent;
        btn.textContent = 'Copiado!';
        btn.classList.add('copied');
        setTimeout(function() {
            btn.textContent = orig;
            btn.classList.remove('copied');
        }, 1500);
    });
}

function downloadManifestFile(depotId, manifestUrl) {
    var fullUrl = DOWNLOAD_API + '?depotId=' + depotId + '&url=' + encodeURIComponent(manifestUrl);
    var a = document.createElement('a');
    a.href = fullUrl;
    a.download = 'depot_' + depotId + '.manifest';
    a.click();
}

function buildDepotsList(appId, gameData, manifestsData) {
    var depots = [];
    var manifestMap = {};

    if (manifestsData && manifestsData.results) {
        manifestsData.results.forEach(function(r) {
            manifestMap[r.depotId] = r;
        });
    }

    depots.push({
        id: appId,
        name: gameData.name,
        type: 'main',
        steamCmd: 'steamcmd +login anonymous +download_depot ' + appId + ' ' + appId + ' +quit',
        depotDownloader: 'DepotDownloader.dll -app ' + appId + ' -depot ' + appId
    });

    if (gameData.dlc && gameData.dlc.length > 0) {
        gameData.dlc.forEach(function(dlcId) {
            depots.push({
                id: dlcId,
                name: 'DLC ' + dlcId,
                type: 'dlc',
                steamCmd: 'steamcmd +login <tu_usuario> +download_depot ' + appId + ' ' + dlcId + ' +quit',
                depotDownloader: 'DepotDownloader.dll -app ' + appId + ' -depot ' + dlcId
            });
        });
    }

    currentDepots = depots;
    manifestResults = manifestsData ? manifestsData.results : [];
    infoDepots.textContent = depots.length;

    var cdnInfo = manifestsData ? manifestsData.cdnServer : null;
    var successCount = manifestResults.filter(function(r) { return r.downloadable; }).length;

    var html = '<div class="depots-toolbar">';
    html += '<span class="depots-count">' + depots.length + ' depot(s) encontrado(s)';
    if (cdnInfo) {
        html += ' | CDN: ' + cdnInfo;
    }
    if (successCount > 0) {
        html += ' | <span class="manifests-found">' + successCount + ' manifest(s) listo(s) para descargar</span>';
    }
    html += '</span>';
    html += '<button class="btn-download-all" onclick="downloadAllZip()">Descargar Todo (.zip)</button>';
    html += '</div>';

    if (successCount > 0) {
        html += '<div class="depots-notice depots-notice-success">';
        html += '<strong>\u2705 Manifests disponibles:</strong> Se encontraron archivos .manifest descargables desde los servidores CDN de Steam. ';
        html += 'Haz clic en "Descargar .manifest" para obtener el archivo.';
        html += '</div>';
    } else {
        html += '<div class="depots-notice">';
        html += '<strong>\u2139\uFE0F Nota:</strong> Los manifests de Steam requieren autenticacion y IDs especificos no disponibles via API publica. ';
        html += 'Para obtener los .manifest reales, usa <a href="https://steamdb.info/app/' + appId + '/depots/" target="_blank">SteamDB</a> para ver los Depot IDs exactos, ';
        html += 'luego usa SteamCMD o DepotDownloader para descargarlos.';
        html += '</div>';
    }

    depots.forEach(function(depot, index) {
        var typeLabel = depot.type === 'main' ? 'MAIN' : 'DLC';
        var typeClass = depot.type === 'main' ? 'badge-app' : 'badge-dlc';

        var manifestInfo = manifestMap[depot.id];

        html += '<div class="manifest-item">';
        html += '<div class="depot-info">';
        html += '<span class="depot-name">' + depot.name + ' <span class="' + typeClass + '">' + typeLabel + '</span></span>';
        html += '<span class="depot-id">Depot ID: ' + depot.id + '</span>';

        if (manifestInfo) {
            if (manifestInfo.downloadable) {
                html += '<span class="depot-status depot-status-ok">\u2705 Manifest disponible (' + (manifestInfo.contentLength ? formatBytes(manifestInfo.contentLength) : 'tama\u00F1o desconocido') + ')</span>';
            } else if (manifestInfo.error) {
                html += '<span class="depot-status depot-status-error">\u274C ' + manifestInfo.error + '</span>';
            }
        }

        html += '</div>';
        html += '<div class="depot-actions">';

        if (manifestInfo && manifestInfo.downloadable && manifestInfo.url) {
            html += '<button class="btn-download-manifest" onclick="downloadManifestFile(' + depot.id + ', \'' + manifestInfo.url.replace(/'/g, "\\'") + '\')">Descargar .manifest</button>';
        }

        html += '<button class="btn-copy" data-cmd="' + depot.steamCmd.replace(/"/g, '&quot;') + '" onclick="copyCommand(this)">Copiar CMD</button>';
        html += '<button class="btn-download" onclick="downloadItemJson(' + index + ')">.json</button>';
        html += '</div>';
        html += '</div>';
    });

    manifestsList.innerHTML = html;
}

function downloadItemJson(index) {
    var depot = currentDepots[index];
    if (!depot) return;
    var manifestInfo = manifestResults.find(function(r) { return r.depotId === depot.id; });
    var data = {
        appId: currentAppId,
        gameName: currentGameName,
        depotId: depot.id,
        depotName: depot.name,
        depotType: depot.type,
        timestamp: new Date().toISOString(),
        commands: {
            steamCmd: depot.steamCmd,
            depotDownloader: depot.depotDownloader
        },
        manifest: manifestInfo || null,
        steamDbDepots: 'https://steamdb.info/app/' + currentAppId + '/depots/'
    };
    downloadFile(depot.name.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + depot.id + '.json', JSON.stringify(data, null, 2), 'application/json');
}

async function downloadAllZip() {
    if (currentDepots.length === 0) return;
    if (typeof JSZip === 'undefined') {
        showError('JSZip no se cargo. Recarga la pagina.');
        return;
    }

    var zip = new JSZip();
    var folderName = 'steam_' + currentAppId + '_' + (currentGameName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
    var folder = zip.folder(folderName);

    var downloadable = manifestResults.filter(function(r) { return r.downloadable; });

    if (downloadable.length > 0) {
        var manifestFolder = folder.folder('manifests');
        for (var i = 0; i < downloadable.length; i++) {
            var m = downloadable[i];
            try {
                var res = await fetch(DOWNLOAD_API + '?depotId=' + m.depotId + '&url=' + encodeURIComponent(m.url));
                if (res.ok) {
                    var blob = await res.blob();
                    manifestFolder.file('depot_' + m.depotId + '.manifest', blob);
                }
            } catch (e) {
                manifestFolder.file('depot_' + m.depotId + '_ERROR.txt', 'Error: ' + e.message);
            }
        }
    }

    currentDepots.forEach(function(depot) {
        var safeName = depot.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        var data = {
            appId: currentAppId,
            gameName: currentGameName,
            depotId: depot.id,
            depotName: depot.name,
            depotType: depot.type,
            timestamp: new Date().toISOString(),
            commands: {
                steamCmd: depot.steamCmd,
                depotDownloader: depot.depotDownloader
            },
            steamDbDepots: 'https://steamdb.info/app/' + currentAppId + '/depots/'
        };
        folder.file(safeName + '_' + depot.id + '.json', JSON.stringify(data, null, 2));
    });

    var allCommands = currentDepots.map(function(d) {
        return '# ' + d.name + ' (ID: ' + d.id + ')\n' + d.steamCmd + '\n';
    }).join('\n');

    folder.file('all_commands.txt', allCommands);

    folder.file('README.txt', [
        '# Steam Depots - ' + (currentGameName || 'Unknown'),
        '# App ID: ' + currentAppId,
        '# Depots: ' + currentDepots.length,
        '',
        '## Descargar con SteamCMD:',
        '1. Descarga SteamCMD: https://developer.valvesoftware.com/wiki/SteamCMD',
        '2. Abre SteamCMD y ejecuta: login anonymous',
        '3. Luego: download_depot ' + currentAppId + ' ' + currentAppId,
        '4. Los archivos se guardan en: steamapps/content/app_' + currentAppId,
        '',
        '## Descargar con DepotDownloader:',
        '1. Descarga: https://github.com/SteamRE/DepotDownloader/releases',
        '2. Ejecuta: dotnet DepotDownloader.dll -app ' + currentAppId + ' -depot ' + currentAppId,
        '',
        '## Para DLCs, usa el ID del DLC como depot ID.',
        '## Si falla, busca los IDs exactos en: https://steamdb.info/app/' + currentAppId + '/depots/',
        ''
    ].join('\n'));

    var content = await zip.generateAsync({ type: 'blob' });
    var url = URL.createObjectURL(content);
    var a = document.createElement('a');
    a.href = url;
    a.download = folderName + '.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function performSearch() {
    var appId = appIdInput.value.trim();
    if (!appId || isNaN(appId) || appId <= 0) {
        showError('Ingresa un App ID valido (solo numeros).');
        return;
    }

    hideError();
    showLoading();

    try {
        var gameDataPromise = fetchSteamData(appId);
        var manifestsPromise = fetchManifests(appId);

        var results = await Promise.all([gameDataPromise, manifestsPromise]);
        var gameData = results[0];
        var manifestsData = results[1];

        hideLoading();
        currentAppId = appId;
        currentGameName = gameData.name;

        gameHeaderImage.src = 'https://cdn.akamai.steamstatic.com/steam/apps/' + appId + '/header.jpg';
        gameHeaderImage.onerror = function() {
            this.src = 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + appId + '/header.jpg';
        };

        gameName.textContent = gameData.name || 'Sin nombre';
        gameDeveloper.textContent = gameData.developers ? 'Desarrollador: ' + gameData.developers.join(', ') : '';
        gamePublisher.textContent = gameData.publishers ? 'Publisher: ' + gameData.publishers.join(', ') : '';
        gameReleaseDate.textContent = gameData.release_date ? gameData.release_date.date : '';

        infoAppId.textContent = appId;
        infoType.textContent = gameData.type || 'N/A';
        infoState.textContent = gameData.is_free ? 'Gratuito' : (gameData.price_overview ? gameData.price_overview.final_formatted : 'N/A');

        buildSources(appId);
        buildDepotsList(appId, gameData, manifestsData);

        resultsEl.classList.remove('hidden');
        welcomeEl.classList.add('hidden');

    } catch (err) {
        hideLoading();
        showError(err.message || 'Error al buscar.');
    }
}

searchBtn.addEventListener('click', performSearch);
appIdInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') performSearch();
});
appIdInput.addEventListener('input', hideError);
