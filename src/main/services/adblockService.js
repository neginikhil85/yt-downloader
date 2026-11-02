// ==========================================================================
// Research Browser — Session-level Adblocker (EasyList / uBlock filter engine)
//
// Uses @ghostery/adblocker-electron with its pre-compiled EasyList +
// EasyPrivacy + uBlock Origin filter bundle (`assets/adblock-engine.bin`).
// ==========================================================================

const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let ElectronBlocker = null;
let fullLists = [];
let parseDomain = null;
try {
    ({ ElectronBlocker, fullLists } = require('@ghostery/adblocker-electron'));
    ({ parse: parseDomain } = require('tldts-experimental'));
} catch (err) {
    console.warn('[Adblock] Module unavailable, running without filter engine:', err.message);
}

let blocker = null;
let browserSession = null;
let enabled = true;
let youtubeHeadersHook = null;
let ready = false;
let initPromise = null;

/**
 * Exact port of uBlock Origin's Oct 2026 `quick-fixes.txt` lines 31-37
 * (`trusted-edit-inbound-object` on `JSON.stringify` + `serverContract` GVS
 * backoff recovery).
 *
 * Why this is needed alongside `assets/adblock-engine.bin`:
 * Ghostery's compiled asset snapshot has the 2024 `trusted-json-edit-xhr-request`
 * rules (Scripts 9-12) which only hook XMLHttpRequest. YouTube now sends
 * `/youtubei/v1/player` via `fetch()` (`JSON.stringify`), so without the
 * `JSON.stringify` rules from uBlock's current `quick-fixes.txt`, YouTube's
 * GVS backoff stalls playback at `0:00 / 0:00` with "Experiencing interruptions?".
 */
const UBO_YOUTUBE_QUICKFIX_2026 = `
(function () {
    if (window.__uboYtQuickFix2026) return;
    window.__uboYtQuickFix2026 = true;

    // uBlock Origin quick-fixes.txt lines 32-37: trusted-edit-inbound-object on JSON.stringify
    const origStringify = JSON.stringify;
    JSON.stringify = new Proxy(origStringify, {
        apply(target, thisArg, args) {
            try {
                const obj = args && args[0];
                if (obj && typeof obj === 'object' && obj.attestationRequest && obj.context && obj.context.client) {
                    const ua = String(obj.context.client.userAgent || '');
                    if (ua.includes('channel') && obj.context.client.clientName === 'WEB') {
                        obj.context.client.clientScreen = 'CHANNEL';
                    }
                    if (ua.includes('lactmilli')) {
                        obj.params = '8AUB';
                    }
                    if (ua.includes('yahi')) {
                        obj.params = 'YAHI';
                    }
                    if (ua.includes('instream') && obj.playbackContext && obj.playbackContext.contentPlaybackContext) {
                        obj.playbackContext.contentPlaybackContext.adPlaybackContext = { adType: 'AD_TYPE_INSTREAM' };
                    }
                    if (/channel|lactmilli|instream/.test(ua) && obj.playbackContext && obj.playbackContext.contentPlaybackContext) {
                        obj.playbackContext.contentPlaybackContext.lactMilliseconds = String(Date.now());
                    }
                    if (/adunit|channel|lactmilli|instream|inline|yahi|eafg/.test(ua) && obj.playbackContext && obj.playbackContext.contentPlaybackContext) {
                        const ref = String(obj.playbackContext.contentPlaybackContext.referer || '');
                        obj.playbackContext.contentPlaybackContext.referer = ref.replace(/(?:#reloadxhr)?$/, '#reloadxhr');
                    }
                }
            } catch (_) {}
            return Reflect.apply(target, thisArg, args);
        }
    });

    // uBlock Origin quick-fixes.txt line 31: GVS backoff ("Experiencing interruptions?") recovery
    if (location.href.startsWith('https://www.youtube.com/tv#/')) return;

    const tokens = ['channel', 'lactmilli', 'inline', 'yahi'];
    let reloadTriggered = false;
    let remainingTokens = tokens;
    let baseUa = null;

    const getBaseUa = () => {
        if (!baseUa) {
            const cur = window.ytcfg?.data_?.INNERTUBE_CONTEXT?.client?.userAgent;
            if (cur && typeof cur === 'string') baseUa = cur;
        }
        return baseUa;
    };

    const applyUaToken = (token) => {
        const orig = getBaseUa();
        if (!orig || !window.ytcfg?.data_?.INNERTUBE_CONTEXT?.client) return;
        if (token) {
            const m = orig.match?.(/Mozilla\\/5\\.0 \\([^)]+/)?.[0];
            window.ytcfg.data_.INNERTUBE_CONTEXT.client.userAgent = m ? orig.replace?.(m, m + '; ' + token) : orig;
        } else {
            window.ytcfg.data_.INNERTUBE_CONTEXT.client.userAgent = orig;
        }
    };

    const getPlayerState = () => {
        const player = document.getElementById('movie_player');
        return {
            player,
            response: player?.getPlayerResponse?.(),
            stats: player?.getStatsForNerds?.(),
            progress: player?.getProgressState?.(),
            buffer: player?.getPlayerStateObject?.()?.isBuffering
        };
    };

    const isStalledByGvs = (buffer, stats, list) =>
        buffer && stats?.buffer_health_seconds === '0.00 s' && stats?.resolution === '0x0' && list.length > 0;

    const markStalled = () => {
        const { player, response, stats, buffer } = getPlayerState();
        if (player && isStalledByGvs(buffer, stats, remainingTokens)) {
            if (response?.playbackTracking?.videostatsPlaybackUrl?.baseUrl?.includes?.('reloadxhr')) {
                remainingTokens = remainingTokens.slice(1);
            }
            reloadTriggered = true;
            queueMicrotask(() => {
                try { checkAndRecover(); } catch (_) {}
            });
        }
    };

    const checkAndRecover = () => {
        if (
            window.ytInitialData?.topbar?.desktopTopbarRenderer?.logo?.topbarLogoRenderer?.iconImage?.iconType === 'YOUTUBE_PREMIUM_LOGO' ||
            document.getElementById('masthead')?.attributes?.['logo-type']?.value === 'YOUTUBE_PREMIUM_LOGO'
        ) {
            return;
        }
        const { player, response, stats, progress, buffer } = getPlayerState();
        if (player && (window.location.href.includes('/watch?') || window.location.href.includes('/embed/'))) {
            if ((progress && progress.duration > 0 && (progress.loaded < progress.duration || progress.duration - progress.current > 1)) || response?.videoDetails?.isLive) {
                if (stats && !stats?.debug_info?.startsWith?.('SSAP, AD')) {
                    const params = new URLSearchParams(window.location.search);
                    const videoId = response?.videoDetails?.videoId;
                    const startSeconds = response?.playerConfig?.playbackStartConfig?.startSeconds || parseInt(params.get('t'), 10) || 0;
                    const errorScreen = response?.playabilityStatus?.errorScreen;
                    const errorText = origStringify(
                        errorScreen?.playerErrorMessageRenderer?.subreason?.runs ||
                        errorScreen?.playerInterstitialRenderer?.content?.interstitialViewModel?.description?.commandRuns
                    );
                    if (
                        response?.playabilityStatus?.status === 'UNPLAYABLE' &&
                        !errorScreen?.playerErrorMessageRenderer?.playerCaptchaViewModel &&
                        errorText?.includes?.('WEB_PAGE_TYPE_UNKNOWN') &&
                        errorText?.includes?.('https://support.google.com/youtube/answer/3037019')
                    ) {
                        remainingTokens = remainingTokens.slice(1);
                        if (remainingTokens.length > 0) applyUaToken(remainingTokens[0]);
                        else applyUaToken('');
                        reloadTriggered = false;
                        player.loadVideoById(videoId, startSeconds);
                    } else if (remainingTokens.length === 0) {
                        reloadTriggered = false;
                        applyUaToken('');
                    } else if (isStalledByGvs(buffer, stats, remainingTokens) && reloadTriggered) {
                        applyUaToken(remainingTokens[0]);
                        reloadTriggered = false;
                        player.loadVideoById(videoId, startSeconds);
                    }
                    return;
                }
                if (stats && progress.duration > 0) {
                    player.seekTo?.(progress.duration);
                }
            }
        } else {
            remainingTokens = tokens;
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        checkAndRecover();
        new MutationObserver(() => checkAndRecover()).observe(document, { childList: true, subtree: true });
    });

    window.Map.prototype.has = new Proxy(window.Map.prototype.has, {
        apply(target, thisArg, args) {
            if (args?.[0] === 'onSnackbarMessage' && !reloadTriggered) {
                markStalled();
            }
            return Reflect.apply(target, thisArg, args);
        }
    });

    window.Array.prototype.push = new Proxy(window.Array.prototype.push, {
        apply(target, thisArg, args) {
            const item = args?.[0];
            if (
                item &&
                typeof item === 'object' &&
                item.constructor?.name === 'Uint8Array' &&
                item.buffer?.byteLength === item.length &&
                (item.length === 105 || item.length === 104)
            ) {
                markStalled();
            }
            return Reflect.apply(target, thisArg, args);
        }
    });

    window.Promise.prototype.then = new Proxy(window.Promise.prototype.then, {
        apply(target, thisArg, args) {
            const fn = args?.[0];
            if (typeof fn === 'function' && fn.toString().includes('onAbnormalityDetected')) {
                args[0] = function () {};
            }
            return Reflect.apply(target, thisArg, args);
        }
    });
})();
`;

function getCachePath() {
    try {
        return path.join(app.getPath('userData'), 'adblock-engine-v3.bin');
    } catch (_) {
        return path.join(require('os').homedir(), '.yt_downloader', 'adblock-engine-v3.bin');
    }
}

function getBundledEnginePath() {
    return path.join(__dirname, '..', '..', '..', 'assets', 'adblock-engine.bin');
}

// Load the pre-bundled EasyList + uBlock engine synchronously so `blocker` is
// ready at 0ms before any window or <webview> is created.
if (ElectronBlocker) {
    try {
        const bundledPath = getBundledEnginePath();
        if (fs.existsSync(bundledPath)) {
            blocker = ElectronBlocker.deserialize(fs.readFileSync(bundledPath));
            ready = true;
        }
    } catch (e) {
        console.warn('[Adblock] Bundled engine load notice:', e.message);
    }
}

/**
 * Cloudflare / bot-management endpoints must never be filtered.
 */
function isBotProtectionRequest(url) {
    if (!url) return false;
    const lower = url.toLowerCase();

    if (lower.includes('/cdn-cgi/')) return true;
    if (lower.includes('cdn-cgi/challenge-platform')) return true;
    if (lower.includes('challenges.cloudflare.com')) return true;
    if (lower.includes('turnstile')) return true;
    if (lower.includes('cf-turnstile')) return true;

    try {
        const host = new URL(url).hostname.toLowerCase();
        if (
            host === 'challenges.cloudflare.com' ||
            host.endsWith('.challenges.cloudflare.com') ||
            host === 'cdn-cgi.cloudflare.com' ||
            host === 'cloudflareinsights.com' ||
            host.endsWith('.cloudflareinsights.com') ||
            host === 'static.cloudflareinsights.com'
        ) {
            return true;
        }
    } catch (_) {}

    return false;
}

function isYouTubeUrl(url) {
    if (!url) return false;
    try {
        const host = new URL(url).hostname.toLowerCase();
        return (
            host === 'youtube.com' ||
            host.endsWith('.youtube.com') ||
            host === 'youtu.be' ||
            host === 'youtube-nocookie.com' ||
            host.endsWith('.youtube-nocookie.com')
        );
    } catch (_) {
        return false;
    }
}

function registerSyncCosmeticsListener() {
    try {
        ipcMain.removeAllListeners('adblock:get-sync-cosmetics');
        ipcMain.on('adblock:get-sync-cosmetics', (event, url) => {
            if (!enabled || !url || isBotProtectionRequest(url)) {
                event.returnValue = { scripts: [], styles: '' };
                return;
            }
            try {
                let scripts = [];
                let styles = '';

                if (blocker) {
                    const parsed = parseDomain ? parseDomain(url) : {};
                    const hostname = parsed.hostname || '';
                    const domain = parsed.domain || '';
                    const res = blocker.getCosmeticsFilters({
                        domain,
                        hostname,
                        url,
                        getBaseRules: true,
                        getInjectionRules: true,
                        getExtendedRules: false,
                        getRulesFromHostname: true,
                        getRulesFromDOM: false
                    });
                    if (res && res.active !== false) {
                        scripts = Array.isArray(res.scripts) ? [...res.scripts] : [];
                        styles = res.styles || '';
                    }
                }

                if (isYouTubeUrl(url)) {
                    // Replace Ghostery's 2024 XHR-only serverContract scripts (8-12)
                    // with uBlock Origin's current 2026 fetch/JSON.stringify version.
                    scripts = scripts.filter(
                        (s) => !s.includes('serverContract') && !s.includes('jsonEditXhrRequestFn')
                    );
                    scripts.push(UBO_YOUTUBE_QUICKFIX_2026);
                }

                if (styles && event.sender && !event.sender.isDestroyed()) {
                    event.sender.insertCSS(styles, { cssOrigin: 'user' }).catch(() => {});
                }

                event.returnValue = { scripts, styles };
            } catch (e) {
                event.returnValue = { scripts: [], styles: '' };
            }
        });
    } catch (e) {
        console.warn('[Adblock] Sync listener registration notice:', e.message);
    }
}

registerSyncCosmeticsListener();

function attachNetworkHandlers() {
    if (!browserSession || !blocker) return;

    browserSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
        if (!enabled || isBotProtectionRequest(details.url)) {
            callback({});
            return;
        }
        blocker.onBeforeRequest(details, callback);
    });

    browserSession.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
        if (typeof youtubeHeadersHook === 'function') {
            youtubeHeadersHook(details);
        }
        callback({ responseHeaders: details.responseHeaders });
    });
}

function attachHeadersOnly() {
    if (!browserSession) return;
    browserSession.webRequest.onBeforeRequest(null);
    browserSession.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
        if (typeof youtubeHeadersHook === 'function') {
            youtubeHeadersHook(details);
        }
        callback({ responseHeaders: details.responseHeaders });
    });
}

function guardCosmeticIpc() {
    if (!blocker) return;
    try {
        ipcMain.removeHandler('@ghostery/adblocker/is-mutation-observer-enabled');
        ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', async (event) => {
            if (!enabled || !blocker) return false;
            return blocker.onIsMutationObserverEnabled(event);
        });

        ipcMain.removeHandler('@ghostery/adblocker/inject-cosmetic-filters');
        ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', async (event, url, msg) => {
            if (!enabled || isBotProtectionRequest(url)) return;
            if (msg === undefined) return;
            return blocker.onInjectCosmeticFilters(event, url, msg);
        });

        registerSyncCosmeticsListener();
    } catch (e) {
        console.warn('[Adblock] Cosmetic guard skipped:', e.message);
    }
}

/**
 * @param {Electron.Session} session
 * @param {{ applyYoutubeHeaders?: (details: any) => void }} [options]
 */
async function initAdblockService(session, options = {}) {
    if (initPromise) return initPromise;

    browserSession = session;
    youtubeHeadersHook = options.applyYoutubeHeaders || null;

    if (!ElectronBlocker) {
        attachHeadersOnly();
        return false;
    }

    initPromise = (async () => {
        if (!blocker) {
            const cachePath = getCachePath();
            const caching = {
                path: cachePath,
                read: async (p) => fs.promises.readFile(p),
                write: async (p, data) => {
                    await fs.promises.mkdir(path.dirname(p), { recursive: true });
                    await fs.promises.writeFile(p, data);
                }
            };

            try {
                blocker = await ElectronBlocker.fromLists(fetch, fullLists, {
                    enableCompression: true,
                    loadCosmeticFilters: true,
                    loadNetworkFilters: true
                }, caching);
            } catch (err) {
                console.warn('[Adblock] fullLists failed, using ads+tracking prebuilt:', err.message);
                blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, caching);
            }
        }

        if (typeof browserSession.registerPreloadScript !== 'function') {
            browserSession.registerPreloadScript = () => 'bruno-preload-shim';
            browserSession.unregisterPreloadScript = () => {};
        }

        guardCosmeticIpc();
        attachNetworkHandlers();

        ready = true;
        console.log(`[Adblock] Engine ready (enabled=${enabled})`);
        return true;
    })().catch((err) => {
        console.error('[Adblock] Init failed:', err);
        ready = false;
        attachHeadersOnly();
        throw err;
    });

    return initPromise;
}

function isAdblockEnabled() {
    return enabled;
}

function isAdblockReady() {
    return ready;
}

function setAdblockEnabled(next) {
    enabled = !!next;

    if (!ready || !browserSession || !blocker) {
        return { success: true, enabled, ready: false };
    }

    if (enabled) {
        guardCosmeticIpc();
        attachNetworkHandlers();
    } else {
        attachHeadersOnly();
    }

    return { success: true, enabled, ready: true };
}

module.exports = {
    initAdblockService,
    isAdblockEnabled,
    isAdblockReady,
    setAdblockEnabled
};
