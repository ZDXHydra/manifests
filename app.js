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
let currentItems = [];

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
    if (!bytes) return 'N/A';
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

    if (IS_LOCAL) {
        return CORS_PROXY + encodeURIComponent(url);
    }
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

async function fetchPackages(appId) {
    try {
        var response = await fetch(steamApiUrl(appId, 'packages'));
        if (!response.ok) return null;
        var data = await response.json();
        if (data.error) return null;
        if (data[appId] && data[appId].success && data[appId].data) {
            return data[appId].data;
        }
    } catch (e) {}
    return null;
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

function buildOfficialSources(appId) {
    var sources = [
        { icon: '\uD83C\uDFAE', name: 'Steam Store', type: 'official', typeLabel: 'Oficial', desc: 'Pagina oficial del juego.', url: 'https://store.steampowered.com/app/' + appId },
        { icon: '\uD83D\uDD27', name: 'SteamCMD', type: 'official', typeLabel: 'Oficial (Valve)', desc: 'Herramienta oficial para descargar depots.', url: 'https://developer.valvesoftware.com/wiki/SteamCMD' },
        { icon: '\uD83D\uDCCA', name: 'SteamDB - Depots', type: 'official', typeLabel: 'SteamDB', desc: 'Historial de depots, manifests y cambios.', url: 'https://steamdb.info/app/' + appId + '/depots/' },
        { icon: '\uD83D\uDCCA', name: 'SteamDB - Info', type: 'official', typeLabel: 'SteamDB', desc: 'Info completa del juego en SteamDB.', url: 'https://steamdb.info/app/' + appId + '/' }
    ];
    officialSources.innerHTML = sources.map(function(s) {
        return buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url);
    }).join('');
}

function buildCommunitySources(appId) {
    var sources = [
        { icon: '\uD83D\uDCD6', name: 'SteamDB Depot History', type: 'community', typeLabel: 'Comunidad', desc: 'Historial de manifest updates por branch.', url: 'https://steamdb.info/app/' + appId + '/depots/?branch=public' },
        { icon: '\uD83C\uDF10', name: 'PCGamingWiki', type: 'community', typeLabel: 'Comunidad', desc: 'Info detallada sobre versiones y archivos.', url: 'https://www.pcgamingwiki.com/wiki/App:' + appId },
        { icon: '\uD83D\uDC65', name: 'Steam Community', type: 'community', typeLabel: 'Comunidad', desc: 'Foro oficial de la comunidad.', url: 'https://steamcommunity.com/app/' + appId + '/discussions/' },
        { icon: '\uD83D\uDD0D', name: 'DepotDownloader', type: 'community', typeLabel: 'Open Source', desc: 'Herramienta para descargar depots individuales.', url: 'https://github.com/SteamRE/DepotDownloader' }
    ];
    communitySources.innerHTML = sources.map(function(s) {
        return buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url);
    }).join('');
}

function buildDownloadTools(appId) {
    var sources = [
        { icon: '\u2699\uFE0F', name: 'SteamCMD', type: 'tool', typeLabel: 'Herramienta Valve', desc: 'Descarga depots y manifests via linea de comandos.', url: 'https://developer.valvesoftware.com/wiki/SteamCMD' },
        { icon: '\uD83D\uDCE6', name: 'DepotDownloader', type: 'tool', typeLabel: 'Open Source', desc: 'Descarga depots con .NET. Soporta autenticacion.', url: 'https://github.com/SteamRE/DepotDownloader/releases' },
        { icon: '\uD83D\uDCE1', name: 'Steam API - AppList', type: 'tool', typeLabel: 'API', desc: 'Lista de todas las apps de Steam.', url: 'https://steamdb.info/api/GetAppList/' }
    ];
    downloadTools.innerHTML = sources.map(function(s) {
        return buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url);
    }).join('');
}

function buildManifestsUI(appId, gameData, packagesData) {
    var items = [];

    if (gameData.dlc && gameData.dlc.length > 0) {
        gameData.dlc.forEach(function(dlcId) {
            items.push({
                id: dlcId,
                name: 'DLC ' + dlcId,
                type: 'dlc',
                price: null,
                steamCmd: 'steamcmd +login <usuario> +download_depot ' + appId + ' ' + dlcId + ' +quit',
                depotDownloader: 'dotnet DepotDownloader.dll -app ' + appId + ' -depot ' + dlcId
            });
        });
    }

    if (packagesData && packagesData.package_groups) {
        packagesData.package_groups.forEach(function(group) {
            if (group.subs) {
                group.subs.forEach(function(sub) {
                    var alreadyExists = items.some(function(item) { return item.id === sub.packageid; });
                    if (!alreadyExists) {
                        items.push({
                            id: sub.packageid,
                            name: sub.option_text || group.title || 'Package ' + sub.packageid,
                            type: 'package',
                            price: sub.price_in_cents_with_discount,
                            steamCmd: 'steamcmd +login <usuario> +download_depot ' + appId + ' ' + sub.packageid + ' +quit',
                            depotDownloader: 'dotnet DepotDownloader.dll -app ' + appId + ' -depot ' + sub.packageid
                        });
                    }
                });
            }
        });
    }

    items.push({
        id: appId,
        name: gameData.name + ' (App Principal)',
        type: 'app',
        price: gameData.is_free ? 0 : (gameData.price_overview ? gameData.price_overview.final : null),
        steamCmd: 'steamcmd +login <usuario> +download_depot ' + appId + ' ' + appId + ' +quit',
        depotDownloader: 'dotnet DepotDownloader.dll -app ' + appId
    });

    currentItems = items;
    infoDepots.textContent = items.length;

    var html = '<div class="depots-toolbar">';
    html += '<span class="depots-count">' + items.length + ' elemento(s) disponible(s)</span>';
    html += '<button class="btn-download-all" onclick="downloadAllZip()">Descargar Todo (.zip)</button>';
    html += '</div>';

    html += '<div class="depots-notice">';
    html += '<p><strong>Nota:</strong> Valve ya no expone depot IDs via la API publica. Los IDs mostrados son package IDs. ';
    html += 'Para encontrar los depot IDs reales, visita <a href="https://steamdb.info/app/' + appId + '/depots/" target="_blank">SteamDB Depots</a>. ';
    html += 'Los comandos generados usan estos IDs como referencia.</p>';
    html += '</div>';

    items.forEach(function(item) {
        var typeLabel = item.type === 'dlc' ? 'DLC' : (item.type === 'app' ? 'APP' : 'PKG');
        var typeClass = item.type === 'dlc' ? 'badge-dlc' : (item.type === 'app' ? 'badge-app' : 'badge-pkg');
        var priceStr = item.price === 0 ? 'Gratis' : (item.price ? '$' + (item.price / 100).toFixed(2) : '');

        html += '<div class="manifest-item">';
        html += '<div class="depot-info">';
        html += '<span class="depot-name">' + item.name + ' <span class="' + typeClass + '">' + typeLabel + '</span></span>';
        html += '<span class="depot-id">ID: ' + item.id + (priceStr ? ' | ' + priceStr : '') + '</span>';
        html += '</div>';
        html += '<div class="depot-actions">';
        html += '<button class="btn-copy" onclick="copyToClipboard(this)" data-text="' + item.steamCmd.replace(/"/g, '&quot;') + '" title="Copiar comando SteamCMD">SteamCMD</button>';
        html += '<button class="btn-download" onclick="downloadItemJson(' + items.indexOf(item) + ')">Descargar .json</button>';
        html += '</div>';
        html += '</div>';
    });

    manifestsList.innerHTML = html;
}

function copyToClipboard(btn) {
    var text = btn.getAttribute('data-text');
    navigator.clipboard.writeText(text).then(function() {
        var original = btn.textContent;
        btn.textContent = 'Copiado!';
        btn.classList.add('copied');
        setTimeout(function() {
            btn.textContent = original;
            btn.classList.remove('copied');
        }, 1500);
    });
}

function downloadItemJson(index) {
    var item = currentItems[index];
    if (!item) return;
    var data = {
        appId: currentAppId,
        gameName: currentGameName,
        itemId: item.id,
        itemName: item.name,
        itemType: item.type,
        timestamp: new Date().toISOString(),
        steamCmdCommand: item.steamCmd,
        depotDownloaderCommand: item.depotDownloader,
        steamdbUrl: 'https://steamdb.info/app/' + currentAppId + '/depots/'
    };
    var json = JSON.stringify(data, null, 2);
    var safeName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadFile(safeName + '_' + item.id + '.json', json, 'application/json');
}

async function downloadAllZip() {
    if (currentItems.length === 0) return;

    if (typeof JSZip === 'undefined') {
        showError('JSZip no se cargo. Recarga la pagina.');
        return;
    }

    var zip = new JSZip();
    var folderName = 'steam_' + currentAppId + '_' + (currentGameName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
    var folder = zip.folder(folderName);

    currentItems.forEach(function(item) {
        var safeName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        var data = {
            appId: currentAppId,
            gameName: currentGameName,
            itemId: item.id,
            itemName: item.name,
            itemType: item.type,
            timestamp: new Date().toISOString(),
            steamCmdCommand: item.steamCmd,
            depotDownloaderCommand: item.depotDownloader,
            steamdbUrl: 'https://steamdb.info/app/' + currentAppId + '/depots/'
        };
        folder.file(safeName + '_' + item.id + '.json', JSON.stringify(data, null, 2));
    });

    var commands = currentItems.map(function(item) {
        return '# ' + item.name + ' (ID: ' + item.id + ')\n' +
               '# SteamCMD:\n' + item.steamCmd + '\n' +
               '# DepotDownloader:\n' + item.depotDownloader + '\n';
    }).join('\n');

    folder.file('all_commands.txt', commands);

    var readme = [
        '# Steam Depots - ' + (currentGameName || 'Unknown'),
        '# App ID: ' + currentAppId,
        '# Total items: ' + currentItems.length,
        '# Generated: ' + new Date().toISOString(),
        '',
        '## Descargar contenido:',
        '',
        '### Opcion 1: SteamCMD',
        '1. Descarga: https://developer.valvesoftware.com/wiki/SteamCMD',
        '2. Ejecuta los comandos de cada archivo JSON',
        '3. Para juegos que requieren login: steamcmd +login tu_usuario +download_depot APPID DEPOTID +quit',
        '',
        '### Opcion 2: DepotDownloader',
        '1. Descarga: https://github.com/SteamRE/DepotDownloader/releases',
        '2. Ejecuta: dotnet DepotDownloader.dll -app APPID -depot DEPOTID',
        '3. Para juegos de pago: -username tu_usuario -password tu_password',
        '',
        '### Encontrar Depot IDs reales:',
        'Los IDs de la API publica son Package IDs, no Depot IDs.',
        'Para ver los Depot IDs reales, visita: https://steamdb.info/app/' + currentAppId + '/depots/',
        '',
        '### Nota:',
        'Algunos juegos requieren autenticacion con tu cuenta de Steam.',
        'Los juegos gratuitos suelen funcionar con login anonymous.'
    ].join('\n');

    folder.file('README.txt', readme);

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
        showError('Por favor, ingresa un App ID valido (solo numeros).');
        return;
    }

    hideError();
    showLoading();

    try {
        var gameData = await fetchSteamData(appId);
        var packagesData = await fetchPackages(appId);

        hideLoading();

        currentAppId = appId;
        currentGameName = gameData.name;

        gameHeaderImage.src = 'https://cdn.akamai.steamstatic.com/steam/apps/' + appId + '/header.jpg';
        gameHeaderImage.onerror = function() {
            this.src = 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + appId + '/header.jpg';
        };

        gameName.textContent = gameData.name || 'Nombre no disponible';
        gameDeveloper.textContent = gameData.developers ? 'Desarrollador: ' + gameData.developers.join(', ') : '';
        gamePublisher.textContent = gameData.publishers ? 'Publisher: ' + gameData.publishers.join(', ') : '';
        gameReleaseDate.textContent = gameData.release_date ? gameData.release_date.date : 'Sin fecha';

        infoAppId.textContent = appId;
        infoType.textContent = gameData.type || 'N/A';
        infoState.textContent = gameData.is_free ? 'Gratuito' : (gameData.price_overview ? gameData.price_overview.final_formatted : 'N/A');

        buildOfficialSources(appId);
        buildCommunitySources(appId);
        buildDownloadTools(appId);
        buildManifestsUI(appId, gameData, packagesData);

        resultsEl.classList.remove('hidden');
        welcomeEl.classList.add('hidden');

    } catch (err) {
        hideLoading();
        showError(err.message || 'Error al buscar el juego. Intenta de nuevo.');
    }
}

searchBtn.addEventListener('click', performSearch);
appIdInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') performSearch();
});
appIdInput.addEventListener('input', hideError);
