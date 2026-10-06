// ==========================================================================
// Chrome Web Store Compatibility Preload (Research Browser webviews only)
//
// 1. Presents Google Chrome userAgentData brands & headers so the Web Store
//    renders the full desktop listing (instead of "Item unavailable").
// 2. Full chrome.webstorePrivate implementation wired to Bruno's CRX installer
//    so the native "Add to Chrome" button installs extensions seamlessly.
// 3. Full chrome.management implementation wired to Bruno's extension service
//    so the native "Remove from Chrome" button uninstalls extensions seamlessly.
// 4. State-aware floating pill as companion helper (Trusted-Types compliant).
// 5. In-place UI updates — zero reloads needed.
// ==========================================================================

const isStoreHost = typeof location !== 'undefined' &&
    (location.hostname === 'chromewebstore.google.com' || location.hostname === 'chrome.google.com');

if (!isStoreHost) {
    // Hard no-op on non-store origins to keep normal browsing untouched.
} else {
    const { ipcRenderer } = require('electron');

    const CHROME_MAJOR = '133';
    const CHROME_FULL = '133.0.6943.142';

    // ---------------------------------------------------------------------
    // 1. Present Google Chrome branded userAgentData
    // ---------------------------------------------------------------------
    try {
        const uad = navigator.userAgentData;
        if (uad && Array.isArray(uad.brands)) {
            const hasChrome = uad.brands.some(b => b && b.brand === 'Google Chrome');
            if (!hasChrome) {
                const brands = uad.brands
                    .filter(b => b && b.brand !== 'Chromium')
                    .concat([
                        { brand: 'Chromium', version: CHROME_MAJOR },
                        { brand: 'Google Chrome', version: CHROME_MAJOR }
                    ]);

                const fullVersionList = brands.map(b => ({
                    brand: b.brand,
                    version: b.brand === 'Not A(Brand' ? '8.0.0.0' : CHROME_FULL
                }));

                const detectedPlatform = navigator.userAgent.includes('Windows')
                    ? 'Windows'
                    : (navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux');

                Object.defineProperty(uad, 'brands', {
                    get: () => brands.map(b => ({ ...b })),
                    configurable: true
                });

                Object.defineProperty(uad, 'platform', {
                    get: () => detectedPlatform,
                    configurable: true
                });

                const originalHighEntropy = uad.getHighEntropyValues.bind(uad);
                Object.defineProperty(uad, 'getHighEntropyValues', {
                    value: function (hints) {
                        return originalHighEntropy(hints).then(values => {
                            const patched = { ...values, brands: brands.map(b => ({ ...b })), platform: detectedPlatform };
                            if ('fullVersionList' in patched) {
                                patched.fullVersionList = fullVersionList.map(b => ({ ...b }));
                            }
                            if ('uaFullVersion' in patched) {
                                patched.uaFullVersion = CHROME_FULL;
                            }
                            return patched;
                        });
                    },
                    configurable: true,
                    writable: true
                });
            }
        }

        // Clean up Node globals so remote web scripts never detect or conflict with them
        if (typeof window !== 'undefined') {
            try { delete window.require; } catch (_) {}
            try { delete window.module; } catch (_) {}
            try { delete window.exports; } catch (_) {}
        }
    } catch (e) {
        console.warn('[WebStoreCompat] Brand patch skipped:', e && e.message);
    }

    // ---------------------------------------------------------------------
    // 2. Installed Extensions State Cache & Event Emitters
    // ---------------------------------------------------------------------
    let installedCache = [];
    let cacheReadyPromise = null;

    const mgmtEvents = {
        onInstalled: new Set(),
        onUninstalled: new Set(),
        onEnabled: new Set(),
        onDisabled: new Set()
    };

    function createEventDispatcher(set) {
        return {
            addListener: fn => { if (typeof fn === 'function') set.add(fn); },
            removeListener: fn => { set.delete(fn); },
            hasListener: fn => set.has(fn)
        };
    }

    async function syncInstalledCache() {
        try {
            const list = await ipcRenderer.invoke('extension:get-installed');
            installedCache = Array.isArray(list) ? list : [];
        } catch (e) {
            installedCache = [];
        }
        return installedCache;
    }

    cacheReadyPromise = syncInstalledCache();

    function parseExtensionId() {
        const m = location.pathname.match(/\/detail\/(?:[^/]+\/)?([a-z]{32,33})/i);
        return m ? m[1].toLowerCase() : null;
    }

    function isExtensionInstalled(extId) {
        if (!extId) return false;
        return installedCache.some(e => e && (e.id === extId || e.runtimeId === extId));
    }

    function isExtensionEnabled(extId) {
        if (!extId) return false;
        const found = installedCache.find(e => e && (e.id === extId || e.runtimeId === extId));
        return found ? found.enabled !== false : false;
    }

    // ---------------------------------------------------------------------
    // 3. chrome.management API Implementation (Enables "Remove from Chrome")
    // ---------------------------------------------------------------------
    if (!window.chrome) window.chrome = {};

    window.chrome.management = {
        getAll: async function (cb) {
            await syncInstalledCache();
            const list = installedCache.map(e => ({
                id: e.id,
                name: e.name || 'Extension',
                shortName: e.name || 'Extension',
                description: e.description || '',
                version: e.version || '1.0.0',
                enabled: e.enabled !== false,
                installType: 'normal',
                type: 'extension',
                isApp: false
            }));
            if (typeof cb === 'function') cb(list);
            return list;
        },

        get: async function (id, cb) {
            await syncInstalledCache();
            const found = installedCache.find(e => e && (e.id === id || e.runtimeId === id));
            const record = found ? {
                id: found.id,
                name: found.name,
                enabled: found.enabled !== false,
                installType: 'normal',
                type: 'extension'
            } : null;
            if (typeof cb === 'function') cb(record);
            return record;
        },

        uninstall: async function (id, options, cb) {
            if (typeof options === 'function') {
                cb = options;
                options = {};
            }
            const targetId = id || parseExtensionId();
            if (!targetId) {
                if (typeof cb === 'function') cb();
                return;
            }

            try {
                await ipcRenderer.invoke('extension:remove', targetId);
            } catch (err) {
                console.warn('[WebStoreCompat] chrome.management.uninstall error:', err && err.message);
            }

            await syncInstalledCache();
            mgmtEvents.onUninstalled.forEach(fn => {
                try { fn(targetId); } catch (_) {}
            });

            refreshAllUI();
            if (typeof cb === 'function') cb();
        },

        setEnabled: async function (id, enabled, cb) {
            const targetId = id || parseExtensionId();
            try {
                await ipcRenderer.invoke('extension:toggle', { id: targetId, enabled: !!enabled });
            } catch (err) {
                console.warn('[WebStoreCompat] chrome.management.setEnabled error:', err && err.message);
            }

            await syncInstalledCache();
            const eventSet = enabled ? mgmtEvents.onEnabled : mgmtEvents.onDisabled;
            eventSet.forEach(fn => {
                try { fn({ id: targetId }); } catch (_) {}
            });

            refreshAllUI();
            if (typeof cb === 'function') cb();
        },

        onInstalled: createEventDispatcher(mgmtEvents.onInstalled),
        onUninstalled: createEventDispatcher(mgmtEvents.onUninstalled),
        onEnabled: createEventDispatcher(mgmtEvents.onEnabled),
        onDisabled: createEventDispatcher(mgmtEvents.onDisabled)
    };

    // ---------------------------------------------------------------------
    // 4. chrome.webstorePrivate API Implementation (Enables "Add to Chrome")
    // ---------------------------------------------------------------------
    const done = (cb, val) => {
        if (typeof cb === 'function') cb(val);
        return Promise.resolve(val);
    };

    window.chrome.webstorePrivate = {
        getExtensionStatus: async function (id, manifest, cb) {
            if (typeof manifest === 'function') {
                cb = manifest;
                manifest = null;
            }
            await (cacheReadyPromise || syncInstalledCache());

            let status = 'installable';
            if (isExtensionInstalled(id)) {
                status = isExtensionEnabled(id) ? 'enabled' : 'disabled';
            }

            if (typeof cb === 'function') cb(status);
            return status;
        },

        beginInstallWithManifest3: async function (details, cb) {
            const extId = (details && details.id) || parseExtensionId();
            if (!extId) {
                return done(cb, 'user_cancelled');
            }

            try {
                const res = await ipcRenderer.invoke('extension:install', extId);
                if (!res || res.success === false) {
                    throw new Error((res && res.error) || 'Install failed');
                }

                await syncInstalledCache();
                mgmtEvents.onInstalled.forEach(fn => {
                    try { fn({ id: extId }); } catch (_) {}
                });

                refreshAllUI();
                // Empty string communicates SUCCESS in Chrome webstorePrivate API
                return done(cb, '');
            } catch (err) {
                console.warn('[WebStoreCompat] beginInstallWithManifest3 failed:', err && err.message);
                return done(cb, 'user_cancelled');
            }
        },

        completeInstall: async function (id, cb) {
            await syncInstalledCache();
            refreshAllUI();
            return done(cb);
        },

        getBrowserLogin: cb => done(cb, { login: '' }),
        getStoreLogin: cb => done(cb, ''),
        setStoreLogin: (login, cb) => done(cb, true),
        getWebGLStatus: cb => done(cb, 'webgl_allowed'),
        getIsLauncherEnabled: cb => done(cb, true),
        isInIncognitoMode: cb => done(cb, false),
        getReferrerChain: cb => done(cb, ''),
        isPendingCustodianApproval: (id, cb) => done(cb, false),
        install: async function (id, cb) {
            try {
                await ipcRenderer.invoke('extension:install', id);
                await syncInstalledCache();
                refreshAllUI();
            } catch (_) {}
            return done(cb);
        }
    };

    // ---------------------------------------------------------------------
    // 5. Trusted-Types Compliant State-Aware Companion Pill
    // ---------------------------------------------------------------------
    const PILL_ID = 'yt-webstore-installer-pill';

    try {
        Object.defineProperty(window, '__yt_cws_preload_active', {
            value: true,
            configurable: false,
            writable: false
        });
    } catch (_) { /* non-fatal */ }

    let currentExtId = null;

    function ensurePill() {
        let pill = document.getElementById(PILL_ID);
        if (pill) return pill;

        pill = document.createElement('div');
        pill.id = PILL_ID;
        pill.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;' +
            'background:#0f172a;border:1px solid rgba(255,255,255,0.18);border-radius:12px;' +
            'padding:10px 16px;display:flex;align-items:center;gap:12px;' +
            'box-shadow:0 10px 30px rgba(0,0,0,0.55);color:#f8fafc;font-size:13px;' +
            'font-family:-apple-system,BlinkMacSystemFont,sans-serif;user-select:none;';

        const labelWrap = document.createElement('div');
        labelWrap.style.cssText = 'display:flex;align-items:center;gap:6px;font-weight:600;';

        // Safe SVG puzzle icon without innerHTML to respect CSP Trusted Types
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', '#60a5fa');
        svg.setAttribute('stroke-width', '2');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a1.5 1.5 0 0 0-3 0V5H6a2 2 0 0 0-2 2v4H2.5a1.5 1.5 0 0 0 0 3H4v4a2 2 0 0 0 2 2h4v1.5a1.5 1.5 0 0 0 3 0V20h4a2 2 0 0 0 2-2v-4h1.5a1.5 1.5 0 0 0 0-3z');
        svg.appendChild(path);

        const titleSpan = document.createElement('span');
        titleSpan.textContent = 'Research Browser';

        labelWrap.appendChild(svg);
        labelWrap.appendChild(titleSpan);

        const mainBtn = document.createElement('button');
        mainBtn.id = 'btn-inject-install-ext';
        mainBtn.style.cssText = 'background:#2563eb;color:#fff;border:none;padding:6px 14px;' +
            'border-radius:6px;font-weight:600;cursor:pointer;font-size:12.5px;';

        const removeBtn = document.createElement('button');
        removeBtn.id = 'btn-inject-remove-ext';
        removeBtn.textContent = 'Remove';
        removeBtn.style.cssText = 'background:transparent;color:#94a3b8;border:none;' +
            'font-size:11.5px;cursor:pointer;display:none;text-decoration:underline;';

        pill.appendChild(labelWrap);
        pill.appendChild(mainBtn);
        pill.appendChild(removeBtn);

        document.body.appendChild(pill);
        return pill;
    }

    function paintPill(isInstalled, isEnabled) {
        const pill = ensurePill();
        const main = pill.querySelector('#btn-inject-install-ext');
        const remove = pill.querySelector('#btn-inject-remove-ext');
        if (!main || !remove) return;

        main.disabled = false;
        main.style.cursor = 'pointer';
        remove.style.display = 'none';

        if (!isInstalled) {
            main.textContent = 'Add to Research Browser';
            main.style.background = '#2563eb';
            main.onclick = () => runInstall(main);
        } else if (isEnabled) {
            main.textContent = '✓ Added';
            main.style.background = '#065f46';
            main.style.cursor = 'default';
            main.disabled = true;
            remove.style.display = 'inline';
            remove.onclick = () => runRemove(remove);
        } else {
            main.textContent = 'Enable';
            main.style.background = '#b45309';
            main.onclick = () => runToggle(main);
        }
    }

    async function runInstall(btn) {
        if (!currentExtId) return;
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Installing…';
            btn.style.background = '#475569';
        }

        try {
            const res = await ipcRenderer.invoke('extension:install', currentExtId);
            if (!res || res.success === false) throw new Error((res && res.error) || 'Install failed');
            await syncInstalledCache();
            mgmtEvents.onInstalled.forEach(fn => { try { fn({ id: currentExtId }); } catch (_) {} });
            refreshAllUI();
        } catch (e) {
            if (btn) {
                btn.textContent = 'Failed — Retry';
                btn.style.background = '#b91c1c';
                btn.disabled = false;
                btn.onclick = () => runInstall(btn);
            }
            console.warn('[WebStoreCompat] Install failed:', e && e.message);
        }
    }

    async function runToggle(btn) {
        if (!currentExtId) return;
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Enabling…';
        }
        try {
            await ipcRenderer.invoke('extension:toggle', { id: currentExtId, enabled: true });
            await syncInstalledCache();
            mgmtEvents.onEnabled.forEach(fn => { try { fn({ id: currentExtId }); } catch (_) {} });
            refreshAllUI();
        } catch (e) {
            console.warn('[WebStoreCompat] Enable failed:', e && e.message);
        }
    }

    async function runRemove(btn) {
        if (!currentExtId) return;
        if (btn) btn.textContent = 'Removing…';
        try {
            await ipcRenderer.invoke('extension:remove', currentExtId);
            await syncInstalledCache();
            mgmtEvents.onUninstalled.forEach(fn => { try { fn(currentExtId); } catch (_) {} });
            refreshAllUI();
        } catch (e) {
            console.warn('[WebStoreCompat] Remove failed:', e && e.message);
        }
    }

    async function refreshAllUI() {
        const extId = parseExtensionId();
        currentExtId = extId;
        if (!extId) {
            const pill = document.getElementById(PILL_ID);
            if (pill) pill.remove();
            return;
        }

        await syncInstalledCache();
        const installed = isExtensionInstalled(extId);
        const enabled = isExtensionEnabled(extId);

        paintPill(installed, enabled);
    }

    // ---------------------------------------------------------------------
    // 6. Navigation Watcher (Single Page App route listener)
    // ---------------------------------------------------------------------
    function watchNavigation() {
        let lastPath = location.pathname;
        setInterval(() => {
            if (location.pathname !== lastPath) {
                lastPath = location.pathname;
                refreshAllUI();
            }
        }, 500);

        window.addEventListener('popstate', refreshAllUI);

        ipcRenderer.on('extensions:changed', async () => {
            await syncInstalledCache();
            refreshAllUI();
        });
    }

    function init() {
        if (!document.body) return;
        refreshAllUI();
        watchNavigation();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
}
