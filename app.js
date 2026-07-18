const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const CORS_PROXY = 'https://corsproxy.io/?url=';
const API_BASE = location.origin + '/api/steam';

const appIdInput = document.getElementById('appIdInput');
const searchBtn = document.getElementById('searchBtn');
const errorEl = document.getElementById('error');
const loadingEl = document.getElementById('loading');
const resultsEl = document.getElementById('results');
const welcomeEl = document.getElementById('welcome');

const gameHeaderImage = document.getElementById('gameHeaderImage');
const gameName = document.getElementById('gameName');
const gameDeveloper = document.getElementById('gameDeveloper');
const gamePublisher = document.getElementById('gamePublisher');
const gameReleaseDate = document.getElementById('gameReleaseDate');

const infoAppId = document.getElementById('infoAppId');
const infoType = document.getElementById('infoType');
const infoState = document.getElementById('infoState');
const infoDepots = document.getElementById('infoDepots');

const officialSources = document.getElementById('officialSources');
const communitySources = document.getElementById('communitySources');
const downloadTools = document.getElementById('downloadTools');
const manifestsList = document.getElementById('manifestsList');

let currentAppId = null;
let currentGameName = null;
let currentDepots = [];

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
    var response = await fetch(steamApiUrl(appId));
    if (!response.ok) throw new Error('Error del servidor (' + response.status + ').');
    var data = await response.json();
    if (data.error) throw new Error(data.error);
    if (!data[appId] || !data[appId].success) throw new Error('Juego no encontrado. Verifica el App ID.');
    return data[appId].data;
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

function buildDepotsList(appId, gameData) {
    var depots = [];

    depots.push({
        id: appId,
        name: gameData.name,
        type: 'main',
        steamCmd: 'steamcmd +login anonymous +download_depot ' + appId + ' ' + appId + ' +quit',
        depotDownloader: 'DepotDownloader.dll -app ' + appId + ' -depot ' + appId
    });

    if (gameData.dlc && gameData.dlc.length > 0) {
        gameData.dlc.forEach(function(dlcId, index) {
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
    infoDepots.textContent = depots.length;

    var html = '<div class="depots-toolbar">';
    html += '<span class="depots-count">' + depots.length + ' depot(s) disponible(s)</span>';
    html += '<button class="btn-download-all" onclick="downloadAllZip()">Descargar Todo (.zip)</button>';
    html += '</div>';

    html += '<div class="depots-notice">';
    html += '<strong>Nota:</strong> El App ID es el depot principal del juego. ';
    html += 'Para ver TODOS los depot IDs exactos, visita <a href="https://steamdb.info/app/' + appId + '/depots/" target="_blank">SteamDB Depots</a>. ';
    html += 'Si un depot requiere licencia, usa tu usuario de Steam en el comando.';
    html += '</div>';

    depots.forEach(function(depot, index) {
        var typeLabel = depot.type === 'main' ? 'MAIN' : 'DLC';
        var typeClass = depot.type === 'main' ? 'badge-app' : 'badge-dlc';

        html += '<div class="manifest-item">';
        html += '<div class="depot-info">';
        html += '<span class="depot-name">' + depot.name + ' <span class="' + typeClass + '">' + typeLabel + '</span></span>';
        html += '<span class="depot-id">Depot ID: ' + depot.id + '</span>';
        html += '</div>';
        html += '<div class="depot-actions">';
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
        var gameData = await fetchSteamData(appId);

        hideLoading();
        currentAppId = appId;
        currentGameName = gameData.name;

        gameHeaderImage.src = 'https://cdn.akamai.steamstatic.com/steam/apps/' + appId + '/header.jpg';
        gameHeaderImage.onerror = function() {
            this.src = 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + appId + '/header.jpg';
        };

        gameName.textContent = gameData.name || 'Sin nombre';
        gameDeveloper.textContent = gameData.developors ? 'Desarrollador: ' + gameData.developors.join(', ') : '';
        gamePublisher.textContent = gameData.publishers ? 'Publisher: ' + gameData.publishers.join(', ') : '';
        gameReleaseDate.textContent = gameData.release_date ? gameData.release_date.date : '';

        infoAppId.textContent = appId;
        infoType.textContent = gameData.type || 'N/A';
        infoState.textContent = gameData.is_free ? 'Gratuito' : (gameData.price_overview ? gameData.price_overview.final_formatted : 'N/A');

        buildSources(appId);
        buildDepotsList(appId, gameData);

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
