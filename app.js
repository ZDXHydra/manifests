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

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('es-ES');
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

function buildOfficialSources(appId, gameNameEncoded) {
    const sources = [
        {
            icon: '🎮',
            name: 'Steam Store',
            type: 'official',
            typeLabel: 'Oficial',
            desc: 'Página oficial del juego en Steam Store con toda la información del producto.',
            url: `https://store.steampowered.com/app/${appId}`
        },
        {
            icon: '📡',
            name: 'Steam Web API',
            type: 'official',
            typeLabel: 'Oficial',
            desc: 'API oficial de Steam para obtener información de depots y manifest details.',
            url: `https://store.steampowered.com/api/appdetails?appids=${appId}`
        },
        {
            icon: '🔧',
            name: 'SteamCMD',
            type: 'official',
            typeLabel: 'Oficial (Valve)',
            desc: 'Herramienta oficial de Valve para descargar depots y manifests vía línea de comandos.',
            url: 'https://developer.valvesoftware.com/wiki/SteamCMD'
        },
        {
            icon: '📊',
            name: 'SteamDB App Page',
            type: 'official',
            typeLabel: 'Oficial-adjacente',
            desc: 'Base de datos no oficial pero ampliamente reconocida. Trackea depots, manifests y cambios de precios.',
            url: `https://steamdb.info/app/${appId}/depots/`
        }
    ];

    officialSources.innerHTML = sources.map(s =>
        buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url)
    ).join('');
}

function buildCommunitySources(appId, gameNameEncoded) {
    const sources = [
        {
            icon: '📖',
            name: 'SteamDB Depot History',
            type: 'community',
            typeLabel: 'Comunidad',
            desc: 'Historial completo de cambios de depots y manifest updates en SteamDB.',
            url: `https://steamdb.info/app/${appId}/depots/?branch=public`
        },
        {
            icon: '🌐',
            name: 'PCGamingWiki',
            type: 'community',
            typeLabel: 'Comunidad',
            desc: 'Wiki comunitaria con información detallada sobre versiones, parches y archivos del juego.',
            url: `https://www.pcgamingwiki.com/wiki/App:${appId}`
        },
        {
            icon: '🖼️',
            name: 'SteamGridDB',
            type: 'community',
            typeLabel: 'Comunidad',
            desc: 'Base de datos comunitaria de arte y metadatos de juegos de Steam.',
            url: `https://steamgriddb.com/game/${appId}`
        },
        {
            icon: '👥',
            name: 'Steam Community',
            type: 'community',
            typeLabel: 'Comunidad',
            desc: 'Foro oficial de la comunidad del juego en Steam.',
            url: `https://steamcommunity.com/app/${appId}/discussions/`
        },
        {
            icon: '📋',
            name: 'Steam Store API (Info Completa)',
            type: 'community',
            typeLabel: 'Comunidad',
            desc: 'Página formateada con toda la información del juego desde la API de Steam.',
            url: `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic,price_overview`
        },
        {
            icon: '🔍',
            name: 'Depot Downloader (GitHub)',
            type: 'community',
            typeLabel: 'Open Source',
            desc: 'Herramienta open-source para descargar depots individuales de Steam.',
            url: 'https://github.com/SteamRE/DepotDownloader'
        }
    ];

    communitySources.innerHTML = sources.map(s =>
        buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url)
    ).join('');
}

function buildDownloadTools(appId) {
    const sources = [
        {
            icon: '⚙️',
            name: 'SteamCMD - Descargar Depot',
            type: 'tool',
            typeLabel: 'Herramienta Valve',
            desc: `Comando para descargar el depot principal: steamcmd +login anonymous +download_depot ${appId} ${appId} +quit`,
            url: 'https://developer.valvesoftware.com/wiki/SteamCMD#Running_SteamCMD'
        },
        {
            icon: '📦',
            name: 'DepotDownloader',
            type: 'tool',
            typeLabel: 'Open Source',
            desc: 'Descarga depots específicos de Steam. Requiere autenticación para algunos juegos.',
            url: `https://github.com/SteamRE/DepotDownloader/releases`
        },
        {
            icon: '🗃️',
            name: 'Steam Manifest Viewer',
            type: 'tool',
            typeLabel: 'Herramienta',
            desc: 'Herramientas de la comunidad para inspeccionar archivos manifest de Steam.',
            url: 'https://github.com/nickspaargaren/steam-manifest'
        },
        {
            icon: '📡',
            name: 'Steam API - GetAppList',
            type: 'tool',
            typeLabel: 'API',
            desc: 'Lista completa de aplicaciones de Steam para verificar App IDs.',
            url: 'https://steamdb.info/api/GetAppList/'
        }
    ];

    downloadTools.innerHTML = sources.map(s =>
        buildSourceCard(s.icon, s.name, s.type, s.typeLabel, s.desc, s.url)
    ).join('');
}

function steamApiUrl(appId, filters = '') {
    let url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=spanish`;
    if (filters) url += `&filters=${filters}`;

    if (IS_LOCAL) {
        return CORS_PROXY + encodeURIComponent(url);
    }
    return API_BASE + `?appid=${appId}${filters ? '&filters=' + filters : ''}`;
}

async function fetchSteamData(appId) {
    const url = steamApiUrl(appId);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Error del servidor (${response.status}). Intenta de nuevo.`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error);
    }

    if (!data[appId] || !data[appId].success) {
        throw new Error('No se encontró el juego. Verifica que el App ID sea correcto.');
    }

    return data[appId].data;
}

async function fetchDepots(appId) {
    try {
        const url = steamApiUrl(appId, 'depots');
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
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
    const appId = appIdInput.value.trim();

    if (!appId || isNaN(appId) || appId <= 0) {
        showError('Por favor, ingresa un App ID válido (solo números).');
        return;
    }

    hideError();
    showLoading();

    try {
        const gameData = await fetchSteamData(appId);

        hideLoading();

        gameHeaderImage.src = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
        gameHeaderImage.onerror = function() {
            this.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
        };

        gameName.textContent = gameData.name || 'Nombre no disponible';
        gameDeveloper.textContent = gameData.developers ? `Desarrollador: ${gameData.developers.join(', ')}` : '';
        gamePublisher.textContent = gameData.publishers ? `Publisher: ${gameData.publishers.join(', ')}` : '';
        gameReleaseDate.textContent = gameData.release_date ? gameData.release_date.date : 'Sin fecha';

        infoAppId.textContent = appId;
        infoType.textContent = gameData.type || 'N/A';
        infoState.textContent = gameData.is_free ? 'Gratuito' : (gameData.price_overview ? gameData.price_overview.final_formatted : 'N/A');

        const gameNameEncoded = encodeURIComponent(gameData.name);

        buildOfficialSources(appId, gameNameEncoded);
        buildCommunitySources(appId, gameNameEncoded);
        buildDownloadTools(appId);

        const depots = await fetchDepots(appId);

        if (depots && Object.keys(depots).length > 0) {
            const depotEntries = Object.entries(depots).filter(([id]) => id !== '228980');
            infoDepots.textContent = depotEntries.length;

            if (depotEntries.length > 0) {
                manifestsList.innerHTML = depotEntries.map(([depotId, depot]) => {
                    const depotName = depot.name || `Depot ${depotId}`;
                    const depotSize = depot.maxsize ? formatBytes(depot.maxsize) : 'Tamaño no disponible';

                    return `
                        <div class="manifest-item">
                            <div class="depot-info">
                                <span class="depot-name">${depotName}</span>
                                <span class="depot-id">Depot ID: ${depotId}</span>
                            </div>
                            <span class="depot-size">${depotSize}</span>
                        </div>
                    `;
                }).join('');
            } else {
                manifestsList.innerHTML = '<div class="no-depots">No se encontraron depots disponibles para este juego.</div>';
            }
        } else {
            infoDepots.textContent = 'N/A';
            manifestsList.innerHTML = '<div class="no-depots">La información de depots no está disponible vía la API pública.<br>Visita <a href="https://steamdb.info/app/' + appId + '/depots/" target="_blank">SteamDB</a> para ver los depots.</div>';
        }

        resultsEl.classList.remove('hidden');
        welcomeEl.classList.add('hidden');

    } catch (err) {
        hideLoading();
        showError(err.message || 'Error al buscar el juego. Intenta de nuevo.');
    }
}

searchBtn.addEventListener('click', performSearch);
appIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

appIdInput.addEventListener('input', () => {
    hideError();
});
