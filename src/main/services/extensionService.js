const { app, session, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const CURATED_ADDONS = require('../config/curatedAddons');

let extensionsDir = null;
let metadataFile = null;
let installedExtensions = [];
let isInitialized = false;


function ensurePaths() {
    if (!extensionsDir) {
        try {
            const userData = (app && typeof app.isReady === 'function' && app.isReady()) ? app.getPath('userData') : path.join(require('os').homedir(), '.yt_downloader');
            extensionsDir = path.join(userData, 'extensions');
            if (!fs.existsSync(extensionsDir)) {
                fs.mkdirSync(extensionsDir, { recursive: true });
            }
            metadataFile = path.join(extensionsDir, 'extensions.json');
        } catch (e) {
            console.error('[ExtensionService] Path init error:', e);
        }
    }
}

function loadMetadata() {
    ensurePaths();
    if (metadataFile && fs.existsSync(metadataFile)) {
        try {
            const raw = fs.readFileSync(metadataFile, 'utf8');
            installedExtensions = JSON.parse(raw);
        } catch (e) {
            console.warn('[ExtensionService] Metadata read error, starting fresh:', e.message);
            installedExtensions = [];
        }
    } else {
        installedExtensions = [];
    }
    return installedExtensions;
}

function saveMetadata() {
    ensurePaths();
    if (metadataFile) {
        try {
            fs.writeFileSync(metadataFile, JSON.stringify(installedExtensions, null, 2), 'utf8');
        } catch (e) {
            console.error('[ExtensionService] Failed to save metadata:', e);
        }
    }
}

function extractZipBuffer(zipBuf, targetDir) {
    fs.mkdirSync(targetDir, { recursive: true });
    const tempZip = path.join(targetDir, 'temp_archive.zip');
    fs.writeFileSync(tempZip, zipBuf);

    if (process.platform === 'win32') {
        execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${targetDir}' -Force"`, { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
        try {
            execSync(`/usr/bin/ditto -x -k "${tempZip}" "${targetDir}"`, { stdio: 'ignore' });
        } catch (e) {
            execSync(`unzip -q -o "${tempZip}" -d "${targetDir}"`, { stdio: 'ignore' });
        }
    } else {
        execSync(`unzip -q -o "${tempZip}" -d "${targetDir}"`, { stdio: 'ignore' });
    }

    try { fs.unlinkSync(tempZip); } catch (e) { }
}

function downloadCrx(url, maxRedirects = 8) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects while downloading extension'));

        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
            rejectUnauthorized: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redir = res.headers.location;
                if (!redir.startsWith('http')) {
                    const parsed = new URL(url);
                    redir = new URL(redir, parsed.origin).href;
                }
                res.resume();
                return downloadCrx(redir, maxRedirects - 1).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Server returned HTTP ${res.statusCode}`));
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Extension download timed out'));
        });
    });
}

function parseExtensionId(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    // Match plain 32-33 character extension ID
    if (/^[a-z]{32,33}$/i.test(trimmed)) return trimmed.toLowerCase();

    // Match Chrome Web Store URL
    const urlMatch = trimmed.match(/\/detail\/(?:[^\/]+\/)?([a-z]{32,33})/i);
    if (urlMatch) return urlMatch[1].toLowerCase();

    // Match short parameter ?id=...
    const paramMatch = trimmed.match(/[?&]id=([a-z]{32,33})/i);
    if (paramMatch) return paramMatch[1].toLowerCase();

    return null;
}

function readExtensionManifest(extDir) {
    const manifestPath = path.join(extDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    try {
        const raw = fs.readFileSync(manifestPath, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

/**
 * Resolves Chrome extension i18n strings (e.g., __MSG_name__, __MSG_description__)
 * from the extension's _locales/<locale>/messages.json files.
 */
function getI18nMessage(extDir, key, defaultLocale = 'en') {
    if (!extDir || !fs.existsSync(extDir) || !key) return null;
    const localesDir = path.join(extDir, '_locales');
    if (!fs.existsSync(localesDir)) return null;

    const candidates = [];
    if (defaultLocale) {
        candidates.push(defaultLocale);
        if (defaultLocale.includes('-')) candidates.push(defaultLocale.replace('-', '_'));
        if (defaultLocale.includes('_')) candidates.push(defaultLocale.split('_')[0]);
    }
    candidates.push('en', 'en_US', 'en_GB');

    try {
        const availableLocales = fs.readdirSync(localesDir);
        for (const loc of availableLocales) {
            if (!candidates.includes(loc)) candidates.push(loc);
        }

        const lowerKey = key.toLowerCase();
        for (const locale of candidates) {
            const msgFile = path.join(localesDir, locale, 'messages.json');
            if (fs.existsSync(msgFile)) {
                try {
                    const raw = fs.readFileSync(msgFile, 'utf8');
                    const parsed = JSON.parse(raw);
                    for (const [k, val] of Object.entries(parsed)) {
                        if (k.toLowerCase() === lowerKey && val && typeof val.message === 'string') {
                            return val.message;
                        }
                    }
                } catch (e) {
                    // Try next candidate locale
                }
            }
        }
    } catch (e) { }

    return null;
}

function resolveI18nString(text, extDir, defaultLocale = 'en') {
    if (!text || typeof text !== 'string') return text;
    if (!text.includes('__MSG_')) return text;

    return text.replace(/__MSG_([A-Za-z0-9_@]+)__/g, (match, msgKey) => {
        const resolved = getI18nMessage(extDir, msgKey, defaultLocale);
        return resolved || match;
    });
}

/**
 * Automatically patches extension scripts and HTML files with a universal WebExtension & Chrome API shim.
 * Fixes missing chrome.tabs (create, get, query, update, reload), chrome.windows, chrome.webNavigation,
 * chrome.contextMenus, chrome.notifications, chrome.commands in Electron contexts.
 */
function patchExtensionCompatibility(extDir) {
    if (!extDir || !fs.existsSync(extDir)) return;

    const shimCode = `// Bruno App Universal Chrome & WebExtension Compatibility Layer
(function() {
    var g = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : {}));
    if (!g.chrome) g.chrome = {};
    var c = g.chrome;

    function makeEvent() {
        return {
            addListener: function() {},
            removeListener: function() {},
            hasListener: function() { return false; },
            hasListeners: function() { return false; }
        };
    }

    if (!c.tabs) c.tabs = {};
    var t = c.tabs;

    if (!t.query) {
        t.query = function(queryInfo, callback) {
            var res = [{
                id: 1,
                index: 0,
                active: true,
                selected: true,
                highlighted: true,
                pinned: false,
                windowId: 1,
                url: typeof window !== 'undefined' && window.location ? window.location.href : 'https://www.youtube.com/',
                title: 'Active Tab',
                status: 'complete',
                incognito: false,
                width: 1280,
                height: 800
            }];
            if (typeof callback === 'function') callback(res);
            return Promise.resolve(res);
        };
    }

    if (!t.get) {
        t.get = function(tabId, callback) {
            var res = {
                id: Number(tabId) || 1,
                index: 0,
                active: true,
                selected: true,
                highlighted: true,
                pinned: false,
                windowId: 1,
                url: typeof window !== 'undefined' && window.location ? window.location.href : 'https://www.youtube.com/',
                title: 'Active Tab',
                status: 'complete',
                incognito: false,
                width: 1280,
                height: 800
            };
            if (typeof callback === 'function') callback(res);
            return Promise.resolve(res);
        };
    }

    if (!t.getCurrent) {
        t.getCurrent = function(callback) {
            return t.get(1, callback);
        };
    }

    if (!t.create) {
        t.create = function(createProperties, callback) {
            var url = (createProperties && createProperties.url) || 'about:blank';
            try {
                if (typeof window !== 'undefined' && typeof window.open === 'function') {
                    window.open(url, '_blank');
                }
            } catch(e) {}
            var res = { id: Math.floor(Math.random() * 100000) + 10, url: url, active: true, windowId: 1 };
            if (typeof callback === 'function') callback(res);
            return Promise.resolve(res);
        };
    }

    if (!t.update) {
        t.update = function(tabId, updateProperties, callback) {
            var res = { id: Number(tabId) || 1, url: updateProperties ? updateProperties.url : '', active: true, windowId: 1 };
            if (typeof callback === 'function') callback(res);
            return Promise.resolve(res);
        };
    }

    if (!t.reload) {
        t.reload = function(tabId, reloadProperties, callback) {
            if (typeof callback === 'function') callback();
            return Promise.resolve();
        };
    }

    if (!t.remove) {
        t.remove = function(tabIds, callback) {
            if (typeof callback === 'function') callback();
            return Promise.resolve();
        };
    }

    if (!t.sendMessage) {
        t.sendMessage = function(tabId, message, options, callback) {
            if (typeof options === 'function') { callback = options; options = {}; }
            if (typeof callback === 'function') callback({});
            return Promise.resolve({});
        };
    }

    if (!t.executeScript) {
        t.executeScript = function(tabId, details, callback) {
            if (typeof details === 'function') { callback = details; details = {}; }
            if (typeof callback === 'function') callback([null]);
            return Promise.resolve([null]);
        };
    }

    if (!t.insertCSS) {
        t.insertCSS = function(tabId, details, callback) {
            if (typeof details === 'function') { callback = details; details = {}; }
            if (typeof callback === 'function') callback();
            return Promise.resolve();
        };
    }

    if (!t.onUpdated) t.onUpdated = makeEvent();
    if (!t.onActivated) t.onActivated = makeEvent();
    if (!t.onCreated) t.onCreated = makeEvent();
    if (!t.onRemoved) t.onRemoved = makeEvent();
    if (!t.onHighlighted) t.onHighlighted = makeEvent();
    if (!t.onMoved) t.onMoved = makeEvent();
    if (!t.onReplaced) t.onReplaced = makeEvent();

    if (!c.windows) c.windows = {};
    var w = c.windows;
    if (!w.getCurrent) {
        w.getCurrent = function(getInfo, callback) {
            if (typeof getInfo === 'function') { callback = getInfo; getInfo = {}; }
            var res = { id: 1, focused: true, state: 'normal', type: 'normal', width: 1280, height: 800 };
            if (typeof callback === 'function') callback(res);
            return Promise.resolve(res);
        };
    }
    if (!w.getLastFocused) {
        w.getLastFocused = function(getInfo, callback) {
            return w.getCurrent(getInfo, callback);
        };
    }
    if (!w.getAll) {
        w.getAll = function(getInfo, callback) {
            if (typeof getInfo === 'function') { callback = getInfo; getInfo = {}; }
            var res = [{ id: 1, focused: true, state: 'normal', type: 'normal', width: 1280, height: 800 }];
            if (typeof callback === 'function') callback(res);
            return Promise.resolve(res);
        };
    }
    if (!w.create) {
        w.create = function(data, callback) {
            var url = (data && data.url) || 'about:blank';
            try { if (typeof window !== 'undefined') window.open(url, '_blank'); } catch(e) {}
            var res = { id: Math.floor(Math.random() * 100000) + 10, focused: true };
            if (typeof callback === 'function') callback(res);
            return Promise.resolve(res);
        };
    }
    if (!w.onFocusChanged) w.onFocusChanged = makeEvent();
    if (!w.onCreated) w.onCreated = makeEvent();
    if (!w.onRemoved) w.onRemoved = makeEvent();

    if (!c.webNavigation) {
        c.webNavigation = {
            onBeforeNavigate: makeEvent(),
            onCommitted: makeEvent(),
            onDOMContentLoaded: makeEvent(),
            onCompleted: makeEvent(),
            onErrorOccurred: makeEvent(),
            onCreatedNavigationTarget: makeEvent(),
            onReferenceFragmentUpdated: makeEvent(),
            onHistoryStateUpdated: makeEvent(),
            getFrame: function(d, cb) { if (cb) cb(null); return Promise.resolve(null); },
            getAllFrames: function(d, cb) { if (cb) cb([]); return Promise.resolve([]); }
        };
    }

    if (!c.contextMenus) {
        c.contextMenus = {
            create: function(p, cb) { if (cb) cb(); return 1; },
            update: function(id, p, cb) { if (cb) cb(); return Promise.resolve(); },
            remove: function(id, cb) { if (cb) cb(); return Promise.resolve(); },
            removeAll: function(cb) { if (cb) cb(); return Promise.resolve(); },
            onClicked: makeEvent()
        };
    }

    if (!c.notifications) {
        c.notifications = {
            create: function(id, opt, cb) { if (typeof opt === 'function') { cb = opt; opt = {}; } if (cb) cb(id || '1'); return Promise.resolve(id || '1'); },
            update: function(id, opt, cb) { if (cb) cb(true); return Promise.resolve(true); },
            clear: function(id, cb) { if (cb) cb(true); return Promise.resolve(true); },
            onClicked: makeEvent(),
            onClosed: makeEvent(),
            onButtonClicked: makeEvent()
        };
    }

    if (!c.commands) {
        c.commands = {
            getAll: function(cb) { if (cb) cb([]); return Promise.resolve([]); },
            onCommand: makeEvent()
        };
    }

    if (g.browser) {
        g.browser.tabs = c.tabs;
        g.browser.windows = c.windows;
        if (!g.browser.webNavigation) g.browser.webNavigation = c.webNavigation;
        if (!g.browser.contextMenus) g.browser.contextMenus = c.contextMenus;
        if (!g.browser.notifications) g.browser.notifications = c.notifications;
        if (!g.browser.commands) g.browser.commands = c.commands;
    } else {
        g.browser = c;
    }
})();
`;

    try {
        function walkAndPatch(dir) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walkAndPatch(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.js')) {
                    try {
                        let content = fs.readFileSync(fullPath, 'utf8');
                        if (!content.includes('Bruno App Universal Chrome & WebExtension Compatibility Layer')) {
                            fs.writeFileSync(fullPath, shimCode + '\n' + content, 'utf8');
                        }
                    } catch (e) {}
                }
            }
        }
        walkAndPatch(extDir);

        // Apply defensive tab info fallbacks to known popup files
        const headerJs = path.join(extDir, 'button', 'header.js');
        if (fs.existsSync(headerJs)) {
            let h = fs.readFileSync(headerJs, 'utf8');
            if (h.includes('const info = await browser.runtime.sendMessage({ command: "getCurrentTabInfo", tabId });')) {
                h = h.replace(
                    'const info = await browser.runtime.sendMessage({ command: "getCurrentTabInfo", tabId });',
                    'let info = await browser.runtime.sendMessage({ command: "getCurrentTabInfo", tabId });\n  if (!info || !info.settings) { info = { disabledSite: false, url: "https://www.youtube.com", id: 1, settings: { color_themes: { popup_menu: "default_theme" }, display_menu_stats: true, show_stats: true }, paused: false, domainPaused: false, blockCountPage: 0, blockCountTotal: 100, whitelisted: false }; }'
                );
                fs.writeFileSync(headerJs, h, 'utf8');
            }
        }
        const popupJs = path.join(extDir, 'button', 'popup.js');
        if (fs.existsSync(popupJs)) {
            let p = fs.readFileSync(popupJs, 'utf8');
            if (p.includes('const info = await browser.runtime.sendMessage({ command: "getCurrentTabInfo", tabId });')) {
                p = p.replace(
                    'const info = await browser.runtime.sendMessage({ command: "getCurrentTabInfo", tabId });',
                    'let info = await browser.runtime.sendMessage({ command: "getCurrentTabInfo", tabId });\n  if (!info || !info.settings) { info = { disabledSite: false, url: "https://www.youtube.com", id: 1, settings: { color_themes: { popup_menu: "default_theme" }, display_menu_stats: true, show_stats: true }, paused: false, domainPaused: false, blockCountPage: 0, blockCountTotal: 100, whitelisted: false }; }'
                );
                fs.writeFileSync(popupJs, p, 'utf8');
            }
        }
        const popupSectionsJs = path.join(extDir, 'button', 'popup-sections.js');
        if (fs.existsSync(popupSectionsJs)) {
            let ps = fs.readFileSync(popupSectionsJs, 'utf8');
            if (ps.includes('sessionStorageSet(PAGE_INFO_KEY, pageInfo);') && !ps.includes('if (!pageInfo || !pageInfo.settings)')) {
                ps = ps.replace(
                    'sessionStorageSet(PAGE_INFO_KEY, pageInfo);',
                    'if (!pageInfo || !pageInfo.settings) { pageInfo = { disabledSite: false, url: "https://www.youtube.com", id: 1, settings: { display_menu_stats: true, show_stats: true, show_stats_total: true, display_stats: true }, paused: false, domainPaused: false, blockCountPage: 0, blockCountTotal: 100, whitelisted: false }; }\n    sessionStorageSet(PAGE_INFO_KEY, pageInfo);'
                );
                fs.writeFileSync(popupSectionsJs, ps, 'utf8');
            }
        }
    } catch (e) {
        console.warn(`[ExtensionService] Could not patch extension ${path.basename(extDir)}:`, e.message);
    }
}

/**
 * Initializes the extension service and loads all enabled extensions into the Research Browser session
 */
async function initExtensionService() {
    if (isInitialized) return;
    isInitialized = true;

    ensurePaths();
    loadMetadata();

    const targetSession = session.fromPartition('persist:main');

    for (const item of installedExtensions) {
        if (item.enabled && item.path && fs.existsSync(item.path)) {
            try {
                patchExtensionCompatibility(item.path);
                const loaded = await targetSession.loadExtension(item.path, { allowFileAccess: true });
                if (loaded && loaded.id) {
                    item.runtimeId = loaded.id;
                }
                console.log(`[ExtensionService] Loaded extension: ${item.name} (${item.id} -> runtime: ${loaded?.id})`);
            } catch (err) {
                console.warn(`[ExtensionService] Failed to load extension ${item.name}:`, err.message);
            }
        }
    }
}

function getInstalledExtensions() {
    loadMetadata();
    let metadataChanged = false;

    let loadedExtensions = [];
    try {
        const targetSession = session.fromPartition('persist:main');
        loadedExtensions = targetSession.getAllExtensions() || [];
    } catch (e) {
        console.warn('[ExtensionService] Could not query session extensions:', e);
    }

    const result = installedExtensions.map(ext => {
        let iconDataUrl = null;
        let name = ext.name;
        let description = ext.description;

        // Match loaded extension in session to get true runtime ID
        let runtimeId = ext.runtimeId || ext.id;
        if (ext.path) {
            const normalizedPath = path.normalize(ext.path).toLowerCase();
            const matched = loadedExtensions.find(le => {
                if (le.path && path.normalize(le.path).toLowerCase() === normalizedPath) return true;
                if (le.id === ext.runtimeId || le.id === ext.id) return true;
                return false;
            });
            if (matched && matched.id) {
                runtimeId = matched.id;
                if (ext.runtimeId !== matched.id) {
                    ext.runtimeId = matched.id;
                    metadataChanged = true;
                }
            }
        }

        if (ext.path && fs.existsSync(ext.path)) {
            const manifest = readExtensionManifest(ext.path);
            if (manifest) {
                const defaultLocale = manifest.default_locale || 'en';

                // Resolve localized name if needed
                if (name && name.includes('__MSG_')) {
                    const resolvedName = resolveI18nString(name, ext.path, defaultLocale);
                    if (resolvedName !== name) {
                        name = resolvedName;
                        ext.name = resolvedName;
                        metadataChanged = true;
                    }
                }

                // Resolve localized description if needed
                if (description && description.includes('__MSG_')) {
                    const resolvedDesc = resolveI18nString(description, ext.path, defaultLocale);
                    if (resolvedDesc !== description) {
                        description = resolvedDesc;
                        ext.description = resolvedDesc;
                        metadataChanged = true;
                    }
                }

                // Resolve popup and options URL using the real runtime ID
                let popupUrl = null;
                let optionsUrl = null;
                const action = manifest.action || manifest.browser_action || manifest.page_action;
                if (action && action.default_popup) {
                    popupUrl = `chrome-extension://${runtimeId}/${action.default_popup}`;
                }
                const options = (manifest.options_ui && manifest.options_ui.page) || manifest.options_page;
                if (options) {
                    optionsUrl = `chrome-extension://${runtimeId}/${options}`;
                }

                // Resolve icon
                if (manifest.icons) {
                    // Pick the largest icon available (128 > 48 > 32 > 16)
                    const sizes = Object.keys(manifest.icons).map(Number).sort((a, b) => b - a);
                    for (const size of sizes) {
                        const iconFile = manifest.icons[String(size)];
                        const resolvedIcon = path.join(ext.path, iconFile);
                        if (fs.existsSync(resolvedIcon)) {
                            try {
                                const buf = fs.readFileSync(resolvedIcon);
                                const ext2 = path.extname(iconFile).toLowerCase();
                                const mime = ext2 === '.svg' ? 'image/svg+xml' : (ext2 === '.webp' ? 'image/webp' : 'image/png');
                                iconDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
                            } catch (e) { /* ignore read errors */ }
                            break;
                        }
                    }
                }
                return { ...ext, runtimeId, name, description, iconDataUrl, popupUrl, optionsUrl };
            }
        }
        return { ...ext, runtimeId, name, description, iconDataUrl, popupUrl: null, optionsUrl: null };
    });

    if (metadataChanged) {
        saveMetadata();
    }

    return result;
}

function getCuratedAddons() {
    loadMetadata();
    return CURATED_ADDONS.map(curated => {
        const installed = installedExtensions.find(ext => ext.id === curated.id);
        return {
            ...curated,
            isInstalled: !!installed,
            isEnabled: installed ? installed.enabled : false,
            version: installed ? installed.version : null,
            installedPath: installed ? installed.path : null
        };
    });
}

/**
 * Downloads and installs an extension from Chrome Web Store
 */
async function installExtensionFromWebStore(idOrUrl) {
    ensurePaths();
    const extId = parseExtensionId(idOrUrl);
    if (!extId) {
        throw new Error('Invalid Chrome Web Store URL or Extension ID. Expected 32-character ID.');
    }

    const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=133.0.0.0&acceptformat=crx2,crx3&x=id%3D${extId}%26uc`;
    console.log(`[ExtensionService] Downloading CRX for [${extId}]...`);

    const crxBuffer = await downloadCrx(crxUrl);
    if (!crxBuffer || crxBuffer.length < 50) {
        throw new Error('Downloaded extension buffer was empty or invalid.');
    }

    // Find PKZip start offset
    const zipOffset = crxBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (zipOffset === -1) {
        throw new Error('CRX archive did not contain valid ZIP data.');
    }

    const zipBuffer = crxBuffer.slice(zipOffset);
    const targetDir = path.join(extensionsDir, extId);

    if (fs.existsSync(targetDir)) {
        try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch (e) { }
    }

    extractZipBuffer(zipBuffer, targetDir);

    const manifest = readExtensionManifest(targetDir);
    if (!manifest) {
        try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch (e) { }
        throw new Error('Extension unpacked successfully, but manifest.json was missing or invalid.');
    }

    // Apply API compatibility shim before loading into Electron
    patchExtensionCompatibility(targetDir);

    // Load into Electron Session
    const targetSession = session.fromPartition('persist:main');
    let runtimeId = extId;
    try {
        const loaded = await targetSession.loadExtension(targetDir, { allowFileAccess: true });
        if (loaded && loaded.id) {
            runtimeId = loaded.id;
        }
    } catch (loadErr) {
        console.warn('[ExtensionService] Session load notice:', loadErr.message);
    }

    const curatedMeta = CURATED_ADDONS.find(c => c.id === extId);
    const defaultLoc = manifest.default_locale || 'en';
    const rawName = curatedMeta ? curatedMeta.name : (manifest.name || extId);
    const rawDesc = curatedMeta ? curatedMeta.description : (manifest.description || 'Custom extension');
    const name = resolveI18nString(rawName, targetDir, defaultLoc);
    const description = resolveI18nString(rawDesc, targetDir, defaultLoc);
    const version = manifest.version || '1.0.0';

    const extRecord = {
        id: extId,
        runtimeId,
        name,
        description,
        version,
        path: targetDir,
        enabled: true,
        isUnpacked: false,
        category: curatedMeta ? curatedMeta.category : 'Custom Addon',
        installedAt: new Date().toISOString()
    };

    installedExtensions = installedExtensions.filter(e => e.id !== extId);
    installedExtensions.unshift(extRecord);
    saveMetadata();

    console.log(`[ExtensionService] Successfully installed & activated: ${name} (v${version}, runtime: ${runtimeId})`);
    return { success: true, extension: extRecord };
}

/**
 * Loads an unpacked extension from local disk directory
 */
async function installUnpackedExtension(targetFolderPath) {
    ensurePaths();
    if (!targetFolderPath || !fs.existsSync(targetFolderPath)) {
        throw new Error('Selected directory does not exist.');
    }

    const manifest = readExtensionManifest(targetFolderPath);
    if (!manifest) {
        throw new Error('The selected folder does not contain a valid manifest.json file.');
    }

    // Apply API compatibility shim before loading into Electron
    patchExtensionCompatibility(targetFolderPath);

    const targetSession = session.fromPartition('persist:main');
    let loadedExt = null;
    try {
        loadedExt = await targetSession.loadExtension(targetFolderPath, { allowFileAccess: true });
    } catch (loadErr) {
        throw new Error(`Failed to load unpacked extension: ${loadErr.message}`);
    }

    const defaultLoc = manifest.default_locale || 'en';
    const extId = loadedExt?.id || `unpacked_${Date.now()}`;
    const runtimeId = loadedExt?.id || extId;
    const rawName = manifest.name || path.basename(targetFolderPath);
    const rawDesc = manifest.description || 'Locally loaded unpacked extension';
    const name = resolveI18nString(rawName, targetFolderPath, defaultLoc);
    const description = resolveI18nString(rawDesc, targetFolderPath, defaultLoc);
    const version = manifest.version || '1.0.0';

    const extRecord = {
        id: extId,
        runtimeId,
        name,
        description,
        version,
        path: targetFolderPath,
        enabled: true,
        isUnpacked: true,
        category: 'Unpacked / Local',
        installedAt: new Date().toISOString()
    };

    installedExtensions = installedExtensions.filter(e => e.id !== extId);
    installedExtensions.unshift(extRecord);
    saveMetadata();

    return { success: true, extension: extRecord };
}

/**
 * Enables or disables an installed extension
 */
async function toggleExtension(extId, enabled) {
    loadMetadata();
    const item = installedExtensions.find(e => e.id === extId || e.runtimeId === extId);
    if (!item) throw new Error('Extension not found.');

    const targetSession = session.fromPartition('persist:main');

    if (enabled) {
        if (item.path && fs.existsSync(item.path)) {
            try {
                const loaded = await targetSession.loadExtension(item.path, { allowFileAccess: true });
                if (loaded && loaded.id) {
                    item.runtimeId = loaded.id;
                }
            } catch (err) {
                console.warn('[ExtensionService] Enable error:', err.message);
            }
        }
        item.enabled = true;
    } else {
        const removeId = item.runtimeId || extId;
        try {
            targetSession.removeExtension(removeId);
        } catch (err) {
            try { targetSession.removeExtension(extId); } catch(e) {}
            console.warn('[ExtensionService] Remove error:', err.message);
        }
        item.enabled = false;
    }

    saveMetadata();
    return { success: true, extension: item };
}

/**
 * Removes and deletes an installed extension
 */
function removeExtension(extId) {
    loadMetadata();
    const item = installedExtensions.find(e => e.id === extId || e.runtimeId === extId);
    if (!item) return { success: true };

    const targetSession = session.fromPartition('persist:main');
    const removeId = item.runtimeId || extId;
    try {
        targetSession.removeExtension(removeId);
    } catch (e) {
        try { targetSession.removeExtension(extId); } catch (e2) {}
    }

    if (!item.isUnpacked && item.path && fs.existsSync(item.path)) {
        try {
            fs.rmSync(item.path, { recursive: true, force: true });
        } catch (e) {
            console.warn('[ExtensionService] Delete directory error:', e.message);
        }
    }

    installedExtensions = installedExtensions.filter(e => e.id !== extId && e.runtimeId !== extId);
    saveMetadata();

    return { success: true, id: extId };
}

function openExtensionFolder(extId) {
    loadMetadata();
    const item = installedExtensions.find(e => e.id === extId);
    if (item && item.path && fs.existsSync(item.path)) {
        shell.showItemInFolder(item.path);
        return { success: true };
    }
    if (extensionsDir && fs.existsSync(extensionsDir)) {
        shell.openPath(extensionsDir);
        return { success: true };
    }
    return { success: false, error: 'Path not found' };
}

module.exports = {
    initExtensionService,
    getInstalledExtensions,
    getCuratedAddons,
    installExtensionFromWebStore,
    installUnpackedExtension,
    toggleExtension,
    removeExtension,
    openExtensionFolder
};
