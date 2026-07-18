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
let depotDataMap = {};

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
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return size.toFixed(2) + ' ' + units[i];
}

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadDepotJson(depotId, depot) {
    const data = {
        appId: currentAppId,
        gameName: currentGameName,
        depotId: depotId,
        depotName: depot.name || 'Depot ' + depotId,
        maxSize: depot.maxsize || null,
        maxSizeFormatted: depot.maxsize ? formatBytes(depot.maxsize) : 'N/A',
        config: depot.config || {},
        branching: depot.branches || {},
        timestamp: new Date().toISOString(),
        steamCmdCommand: 'steamcmd +login anonymous +download_depot ' + currentAppId + ' ' + depotId + ' +quit',
        depotDownloaderCommand: 'dotnet DepotDownloader.dll -app ' + currentAppId + ' -depot ' + depotId
    };
    const json = JSON.stringify(data, null, 2);
    const safeName = (depot.name || 'depot_' + depotId).replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadFile(safeName + '_' + depotId + '.json', json, 'application/json');
}

async function downloadAllDepotsZip() {
    if (currentDepots.length === 0) return;

    if (typeof JSZip === 'undefined') {
        showError('JSZip no se cargo. Recarga la pagina e intenta de nuevo.');
        return;
    }

    const zip = new JSZip();
    const folder = zip.folder('depots_' + currentAppId + '_' + (currentGameName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_'));

    currentDepots.forEach(function(entry) {
        const depotId = entry[0];
        const depot = entry[1];
        const depotName = depot.name || 'depot_' + depotId;
        const safeName = depotName.replace(/[^a-zA-Z0-9_-]/g, '_');

        const data = {
            appId: currentAppId,
            gameName: currentGameName,
            depotId: depotId,
            depotName: depotName,
            maxSize: depot.maxsize || null,
            maxSizeFormatted: depot.maxsize ? formatBytes(depot.maxsize) : 'N/A',
            config: depot.config || {},
            branching: depot.branches || {},
            timestamp: new Date().toISOString(),
            steamCmdCommand: 'steamcmd +login anonymous +download_depot ' + currentAppId + ' ' + depotId + ' +quit',
            depotDownloaderCommand: 'dotnet DepotDownloader.dll -app ' + currentAppId + ' -depot ' + depotId
        };

        folder.file(safeName + '_' + depotId + '.json', JSON.stringify(data, null, 2));
    });

    const readme = [
        '# Steam Depots - ' + (currentGameName || 'Unknown'),
        '# App ID: ' + currentAppId,
        '# Total Depots: ' + currentDepots.length,
        '# Generated: ' + new Date().toISOString(),
        '',
        '## Descargar contenido real de los depots:',
        '',
        '### Opcion 1: SteamCMD',
        '1. Descarga SteamCMD de: https://developer.valvesoftware.com/wiki/SteamCMD',
        '2. Ejecuta el comando de cada depot en su archivo JSON',
        '',
        '### Opcion 2: DepotDownloader',
        '1. Descarga de: https://github.com/SteamRE/DepotDownloader/releases',
        '2. Ejecuta: dotnet DepotDownloader.dll -app ' + currentAppId + ' -depot <DEPOT_ID>',
        '',
        '### Nota:',
        'Algunos juegos requieren autenticacion con tu cuenta de Steam.',
        'Los juegos gratuitos suelen funcionar con login anonymous.'
    ].join('\n');

    folder.file('README.txt', readme);

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'depots_' + currentAppId + '.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function buildSourceCard(icon, name, type, typeLabel, desc, url) {
    return `
        <div class="source-card">
            <div class="source-header">
                <div class="source-icon">${icon}</div>
                <div>
                    <div class="source-name">${name}</div>
                    <span class="source-type type-${type}">${typeLabel}</span>
                </div>
            </div>
            <div class="source-desc">${desc}</div>
            <a href="${url}" target="_blank" rel="noopener noreferrer">Ir a fuente</a>
        </div>
    `;
}

function buildOfficialSources(appId) {
    const sources = [
        {
            icon: '\uD83C\uDFAE',
            name: 'Steam Store',
            type: 'official',
            typeLabel: 'Oficial',
            desc: 'Pagina oficial del juego en Steam Store.',
            url: 'https://store.steampowered.com/app/' + appId
        },
        {
            icon: '\uD83D\uDCE1',
            name: 'Steam Web API',
            type: 'official',
            typeLabel: 'Oficial',
            desc: 'API oficial de Steam para informacion de depots.',
            url: 'https://store.steampowered.com/api/appdetails?appids=' + appId
        },
        {
            icon: '\uD83D\uDD27',
            name: 'SteamCMD',
            type: 'official',
            typeLabel: 'Oficial (Valve)',
            desc: 'Herramienta oficial de Valve para descargar depots y manifests.',
            url: 'https://developer.valvesoftware.com/wiki/SteamCMD'
        },
        {
            icon: '\uD83D\uDCCA',
            name: 'SteamDB App Page',
            type: 'official',
            typeLabel: 'Oficial-adjacente',
            desc: 'Base de datos que trackea depots, manifests y cambios de precios.',
            url: 'https://steamdb.info/app/' + appId + '/depots/'
        }
    ];

    officialSources.innerHTML = sources.map(function(s) {
        return buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url);
    }).join('');
}

function buildCommunitySources(appId) {
    var sources = [
        {
            icon: '\uD83D\uDCD6',
            name: 'SteamDB Depot History',
            type: 'community',
            typeLabel: 'Comunidad',
            desc: 'Historial completo de cambios de depots y manifest updates.',
            url: 'https://steamdb.info/app/' + appId + '/depots/?branch=public'
        },
        {
            icon: '\uD83C\uDF10',
            name: 'PCGamingWiki',
            type: 'community',
            typeLabel: 'Comunidad',
            desc: 'Wiki comunitaria con info detallada sobre versiones y archivos.',
            url: 'https://www.pcgamingwiki.com/wiki/App:' + appId
        },
        {
            icon: '\uD83D\uDDBC\uFE0F',
            name: 'SteamGridDB',
            type: 'community',
            typeLabel: 'Comunidad',
            desc: 'Base de datos comunitaria de arte y metadatos de juegos.',
            url: 'https://steamgriddb.com/game/' + appId
        },
        {
            icon: '\uD83D\uDC65',
            name: 'Steam Community',
            type: 'community',
            typeLabel: 'Comunidad',
            desc: 'Foro oficial de la comunidad del juego en Steam.',
            url: 'https://steamcommunity.com/app/' + appId + '/discussions/'
        },
        {
            icon: '\uD83D\uDCCB',
            name: 'Steam Store API (Info Completa)',
            type: 'community',
            typeLabel: 'Comunidad',
            desc: 'Pagina formateada con toda la info del juego desde la API.',
            url: 'https://store.steampowered.com/api/appdetails?appids=' + appId + '&filters=basic,price_overview'
        },
        {
            icon: '\uD83D\uDD0D',
            name: 'Depot Downloader (GitHub)',
            type: 'community',
            typeLabel: 'Open Source',
            desc: 'Herramienta open-source para descargar depots individuales.',
            url: 'https://github.com/SteamRE/DepotDownloader'
        }
    ];

    communitySources.innerHTML = sources.map(function(s) {
        return buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url);
    }).join('');
}

function buildDownloadTools(appId) {
    var sources = [
        {
            icon: '\u2699\uFE0F',
            name: 'SteamCMD - Descargar Depot',
            type: 'tool',
            typeLabel: 'Herramienta Valve',
            desc: 'Comando: steamcmd +login anonymous +download_depot ' + appId + ' ' + appId + ' +quit',
            url: 'https://developer.valvesoftware.com/wiki/SteamCMD#Running_SteamCMD'
        },
        {
            icon: '\uD83D\uDCE6',
            name: 'DepotDownloader',
            type: 'tool',
            typeLabel: 'Open Source',
            desc: 'Descarga depots especificos de Steam. Requiere autenticacion.',
            url: 'https://github.com/SteamRE/DepotDownloader/releases'
        },
        {
            icon: '\uD83D\uDDC2\uFE0F',
            name: 'Steam Manifest Viewer',
            type: 'tool',
            typeLabel: 'Herramienta',
            desc: 'Herramientas de la comunidad para inspeccionar archivos manifest.',
            url: 'https://github.com/nickspaargaren/steam-manifest'
        },
        {
            icon: '\uD83D\uDCE1',
            name: 'Steam API - GetAppList',
            type: 'tool',
            typeLabel: 'API',
            desc: 'Lista completa de aplicaciones de Steam para verificar App IDs.',
            url: 'https://steamdb.info/api/GetAppList/'
        }
    ];

    downloadTools.innerHTML = sources.map(function(s) {
        return buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url);
    }).join('');
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
    var url = steamApiUrl(appId);
    var response = await fetch(url);

    if (!response.ok) {
        throw new Error('Error del servidor (' + response.status + '). Intenta de nuevo.');
    }

    var data = await response.json();

    if (data.error) {
        throw new Error(data.error);
    }

    if (!data[appId] || !data[appId].success) {
        throw new Error('No se encontro el juego. Verifica que el App ID sea correcto.');
    }

    return data[appId].data;
}

async function fetchDepots(appId) {
    try {
        var url = steamApiUrl(appId, 'depots');
        var response = await fetch(url);
        if (!response.ok) return null;

        var data = await response.json();
        if (data.error) return null;

        if (data[appId] && data[appId].success && data[appId].data && data[appId].data.depots) {
            return data[appId].data.depots;
        }
    } catch (e) {
        console.warn('No se pudieron obtener depots:', e);
    }
    return null;
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

        var depots = await fetchDepots(appId);

        if (depots && Object.keys(depots).length > 0) {
            var depotEntries = Object.entries(depots).filter(function(entry) { return entry[0] !== '228980'; });
            currentDepots = depotEntries;
            depotDataMap = {};
            depotEntries.forEach(function(entry) { depotDataMap[entry[0]] = entry[1]; });
            infoDepots.textContent = depotEntries.length;

            if (depotEntries.length > 0) {
                var html = '<div class="depots-toolbar">';
                html += '<span class="depots-count">' + depotEntries.length + ' depot(s) encontrado(s)</span>';
                html += '<button class="btn-download-all" onclick="downloadAllDepotsZip()">Descargar Todos (.zip)</button>';
                html += '</div>';

                html += depotEntries.map(function(entry) {
                    var depotId = entry[0];
                    var depot = entry[1];
                    var depotName = depot.name || 'Depot ' + depotId;
                    var depotSize = depot.maxsize ? formatBytes(depot.maxsize) : 'Tamano no disponible';
                    var isDLC = depot.config && depot.config.installonly;

                    html += '<div class="manifest-item">';
                    html += '<div class="depot-info">';
                    html += '<span class="depot-name">' + depotName + (isDLC ? ' <span class="badge-dlc">DLC</span>' : '') + '</span>';
                    html += '<span class="depot-id">Depot ID: ' + depotId + '</span>';
                    if (depot.config && depot.config.launch) {
                        html += '<span class="depot-config">Config: ' + JSON.stringify(depot.config).substring(0, 80) + '...</span>';
                    }
                    html += '</div>';
                    html += '<div class="depot-actions">';
                    html += '<span class="depot-size">' + depotSize + '</span>';
                    html += '<button class="btn-download" onclick="downloadDepotJson(\'' + depotId + '\', depotDataMap[\'' + depotId + '\'])">Descargar .json</button>';
                    html += '</div>';
                    html += '</div>';
                }).join('');

                manifestsList.innerHTML = html;
            } else {
                manifestsList.innerHTML = '<div class="no-depots">No se encontraron depots disponibles para este juego.</div>';
            }
        } else {
            currentDepots = [];
            infoDepots.textContent = 'N/A';
            manifestsList.innerHTML = '<div class="no-depots">La informacion de depots no esta disponible via la API publica.<br>Visita <a href="https://steamdb.info/app/' + appId + '/depots/" target="_blank">SteamDB</a> para ver los depots.</div>';
        }

        resultsEl.classList.remove('hidden');
        welcomeEl.classList.add('hidden');

    } catch (err) {
        hideLoading();
        showError(err.message || 'Error al buscar el juego. Intenta de nuevo.');
    }
}

searchBtn.addEventListener('click', performSearch);
appIdInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        performSearch();
    }
});

appIdInput.addEventListener('input', function() {
    hideError();
});
