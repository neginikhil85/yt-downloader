// ==========================================================================
// YT Studio Pro — Multi-Tab & Webview Lifecycle Controller
// ==========================================================================

import { getBrandIconHtml } from '../../data/brandIcons.js';
import { isHomeUrl, isAddonsUrl, parseUrl } from './urlUtils.js';

export class TabController {
    constructor({
        tabsContainer,
        webviewsContainer,
        homeDashboard,
        addonsDashboard,
        urlInput,
        btnBack,
        btnForward,
        quickTools,
        findInPage,
        onTabChanged,
        onOpenAddonsDashboard
    }) {
        this.tabsContainer = tabsContainer;
        this.webviewsContainer = webviewsContainer;
        this.homeDashboard = homeDashboard;
        this.addonsDashboard = addonsDashboard;
        this.urlInput = urlInput;
        this.btnBack = btnBack;
        this.btnForward = btnForward;
        this.quickTools = quickTools;
        this.findInPage = findInPage;
        this.onTabChanged = onTabChanged || (() => {});
        this.onOpenAddonsDashboard = onOpenAddonsDashboard || (() => {});

        this.tabs = [];
        this.activeTabId = null;
        this.tabIdCounter = 1;
    }

    createTab(initialUrl = 'about:home', activate = true) {
        const tabId = `tab-${this.tabIdCounter++}`;
        let finalUrl = parseUrl(initialUrl);
        if (isAddonsUrl(initialUrl)) finalUrl = 'about:addons';

        const isHome = isHomeUrl(finalUrl);
        const isAddons = isAddonsUrl(finalUrl);

        // Create Webview Element
        const webview = document.createElement('webview');
        webview.id = `webview-${tabId}`;
        webview.setAttribute('partition', 'persist:main');
        webview.setAttribute('allowpopups', 'true');

        const isGoogleAuth = finalUrl.includes('accounts.google.com') || finalUrl.includes('accounts.youtube.com') || finalUrl.includes('oauth2.googleapis.com');
        const ua = isGoogleAuth
            ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            : (this.quickTools ? this.quickTools.getUserAgent() : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');

        webview.setAttribute('useragent', ua);
        webview.className = 'browser-webview';
        webview.src = (isHome || isAddons) ? 'about:blank' : finalUrl;

        this.webviewsContainer.appendChild(webview);

        let defaultTitle = 'New Tab';
        if (isAddons) defaultTitle = 'Add-ons & Themes';
        else if (!isHome) defaultTitle = 'Loading...';

        const tabData = {
            id: tabId,
            url: isAddons ? 'about:addons' : (isHome ? 'about:home' : finalUrl),
            title: defaultTitle,
            loading: !isHome && !isAddons,
            canGoBack: false,
            canGoForward: false,
            isAudioMuted: false,
            webviewEl: webview,
            tabEl: null
        };

        // Create Tab Element in Header
        const tabEl = document.createElement('div');
        tabEl.className = 'browser-tab';
        tabEl.id = `header-tab-${tabId}`;
        tabEl.innerHTML = `
            <div class="tab-favicon-container">
                ${getBrandIconHtml(tabData.url, tabData.title)}
            </div>
            <span class="tab-title">${tabData.title}</span>
            <span class="tab-audio-icon" style="display: none;" title="Audio playing — Click to mute">🔊</span>
            <button class="tab-close-btn" title="Close Tab (⌘W / Ctrl+W)">✕</button>
        `;

        tabData.tabEl = tabEl;
        this.tabsContainer.appendChild(tabEl);
        this.tabs.push(tabData);

        // Tab Event Listeners
        tabEl.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close-btn')) {
                e.stopPropagation();
                this.closeTab(tabId);
                return;
            }
            if (e.target.closest('.tab-audio-icon')) {
                e.stopPropagation();
                this.toggleTabAudio(tabId);
                return;
            }
            this.switchTab(tabId);
        });

        // Middle-click to close tab
        tabEl.addEventListener('auxclick', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                this.closeTab(tabId);
            }
        });

        this.setupWebviewEvents(tabData);

        if (activate) {
            this.switchTab(tabId);
        }

        this.tabsContainer.scrollLeft = this.tabsContainer.scrollWidth;
        return tabData;
    }

    toggleTabAudio(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab && tab.webviewEl && tab.webviewEl.setAudioMuted) {
            tab.isAudioMuted = !tab.isAudioMuted;
            tab.webviewEl.setAudioMuted(tab.isAudioMuted);
            const audioIcon = tab.tabEl?.querySelector('.tab-audio-icon');
            if (audioIcon) {
                audioIcon.textContent = tab.isAudioMuted ? '🔇' : '🔊';
                audioIcon.title = tab.isAudioMuted ? 'Muted — Click to unmute' : 'Audio playing — Click to mute';
            }
        }
    }

    switchTab(tabId) {
        if (!tabId) return;
        this.activeTabId = tabId;

        this.tabs.forEach(t => {
            const isActive = t.id === tabId;
            t.tabEl?.classList.toggle('active', isActive);
            if (t.webviewEl) {
                t.webviewEl.classList.toggle('active', isActive);
            }
        });

        const activeTab = this.tabs.find(t => t.id === tabId);
        if (!activeTab) return;

        if (isAddonsUrl(activeTab.url)) {
            if (this.homeDashboard) this.homeDashboard.style.display = 'none';
            if (this.addonsDashboard) this.addonsDashboard.style.display = 'flex';
            if (this.urlInput) {
                this.urlInput.value = 'about:addons';
                this.urlInput.placeholder = 'Search Google or enter address...';
            }
            this.onOpenAddonsDashboard();
        } else if (isHomeUrl(activeTab.url)) {
            if (this.homeDashboard) this.homeDashboard.style.display = 'flex';
            if (this.addonsDashboard) this.addonsDashboard.style.display = 'none';
            if (this.urlInput) {
                this.urlInput.value = '';
                this.urlInput.placeholder = 'Search Google or enter address...';
            }
        } else {
            if (this.homeDashboard) this.homeDashboard.style.display = 'none';
            if (this.addonsDashboard) this.addonsDashboard.style.display = 'none';
            if (this.urlInput) this.urlInput.value = activeTab.url;
        }

        this.updateControlsState();
        activeTab.tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        this.onTabChanged(activeTab);
    }

    closeTab(tabId) {
        const index = this.tabs.findIndex(t => t.id === tabId);
        if (index === -1) return;

        const [removedTab] = this.tabs.splice(index, 1);
        removedTab.tabEl?.remove();
        removedTab.webviewEl?.remove();

        if (this.tabs.length === 0) {
            this.createTab('about:home', true);
            return;
        }

        if (this.activeTabId === tabId) {
            const nextTab = this.tabs[Math.min(index, this.tabs.length - 1)];
            if (nextTab) this.switchTab(nextTab.id);
        }
    }

    setupWebviewEvents(tabData) {
        const wv = tabData.webviewEl;

        wv.addEventListener('did-start-loading', () => {
            tabData.loading = true;
            if (tabData.id === this.activeTabId) this.updateControlsState();
        });

        wv.addEventListener('dom-ready', () => {
            this._injectLinkHandler(wv);
        });

        wv.addEventListener('did-stop-loading', () => {
            tabData.loading = false;
            const currentUrl = wv.getURL();
            if (currentUrl && currentUrl !== 'about:blank') {
                tabData.url = currentUrl;
            }
            if (tabData.id === this.activeTabId) {
                if (this.urlInput) {
                    if (isAddonsUrl(tabData.url)) {
                        this.urlInput.value = 'about:addons';
                    } else if (isHomeUrl(tabData.url)) {
                        this.urlInput.value = '';
                        this.urlInput.placeholder = 'Search Google or enter address...';
                    } else {
                        this.urlInput.value = tabData.url;
                    }
                }
                this.updateControlsState();
            }
            if (this.quickTools) this.quickTools.applyInjections(wv);

            this._injectLinkHandler(wv);
            // Inject 1-click install helper on Chrome Web Store extension pages
            this._injectWebstoreHelper(wv, currentUrl);
        });

        // SPA navigation within Chrome Web Store (client-side routing)
        wv.addEventListener('did-navigate-in-page', (e) => {
            if (e.url) {
                tabData.url = e.url;
                if (tabData.id === this.activeTabId && this.urlInput) {
                    this.urlInput.value = e.url;
                }
                this._injectLinkHandler(wv);
                this._injectWebstoreHelper(wv, e.url);
            }
        });

        wv.addEventListener('console-message', async (e) => {
            if (e.message && e.message.startsWith('[YT_BROWSER_OPEN_LINK]:')) {
                try {
                    const raw = e.message.replace('[YT_BROWSER_OPEN_LINK]:', '').trim();
                    const payload = JSON.parse(raw);
                    if (payload && payload.url) {
                        this.createTab(payload.url, payload.activate !== false);
                    }
                } catch (err) {
                    console.warn('[TabController] Open link error:', err);
                }
                return;
            }

            if (e.message && e.message.startsWith('[YT_BROWSER_INSTALL_EXTENSION]:')) {
                const extId = e.message.replace('[YT_BROWSER_INSTALL_EXTENSION]:', '').trim();
                if (extId && window.electronAPI && window.electronAPI.extensionInstall) {
                    try {
                        const res = await window.electronAPI.extensionInstall(extId);
                        if (res && res.success) {
                            wv.executeJavaScript(`
                                (function() {
                                    const btn = document.getElementById('btn-inject-install-ext');
                                    if (btn) {
                                        btn.style.background = '#10b981';
                                        btn.textContent = '✓ Installed & Active';
                                    }
                                })();
                            `).catch(() => {});
                            const extName = res.extension?.name || 'Extension';
                            const extVer = res.extension?.version || '1.0';
                            alert(`✓ Successfully installed ${extName} (v${extVer}) into Research Browser!`);
                        } else {
                            const errMsg = res?.error || 'Failed';
                            wv.executeJavaScript(`
                                (function() {
                                    const btn = document.getElementById('btn-inject-install-ext');
                                    if (btn) {
                                        btn.disabled = false;
                                        btn.style.background = '#ef4444';
                                        btn.textContent = '✕ Install notice: ${errMsg.replace(/'/g, "\\'")}';
                                    }
                                })();
                            `).catch(() => {});
                        }
                    } catch (err) {
                        alert('Install Error: ' + err.message);
                    }
                }
            }
        });

        wv.addEventListener('page-title-updated', (e) => {
            tabData.title = e.title || 'Untitled';
            if (tabData.tabEl) {
                const titleSpan = tabData.tabEl.querySelector('.tab-title');
                if (titleSpan) titleSpan.textContent = tabData.title;
            }
        });

        wv.addEventListener('page-favicon-updated', () => {
            if (tabData.tabEl) {
                const favBox = tabData.tabEl.querySelector('.tab-favicon-container');
                if (favBox) favBox.innerHTML = getBrandIconHtml(tabData.url, tabData.title);
            }
        });

        wv.addEventListener('media-started-playing', () => {
            const audioIcon = tabData.tabEl?.querySelector('.tab-audio-icon');
            if (audioIcon) audioIcon.style.display = 'inline-block';
        });

        wv.addEventListener('media-paused', () => {
            const audioIcon = tabData.tabEl?.querySelector('.tab-audio-icon');
            if (audioIcon) audioIcon.style.display = 'none';
        });

        wv.addEventListener('new-window', (e) => {
            e.preventDefault();
            if (e.url) {
                const activate = e.disposition !== 'background-tab';
                this.createTab(e.url, activate);
            }
        });

        wv.addEventListener('found-in-page', (e) => {
            if (this.findInPage && e.result) {
                this.findInPage.handleFoundInPageResult(e.result);
            }
        });
    }

    navigateActiveTab(inputUrl) {
        const activeTab = this.tabs.find(t => t.id === this.activeTabId);
        if (!activeTab) return;

        const target = parseUrl(inputUrl);
        activeTab.url = target;

        if (isAddonsUrl(target)) {
            activeTab.url = 'about:addons';
            if (this.homeDashboard) this.homeDashboard.style.display = 'none';
            if (this.addonsDashboard) this.addonsDashboard.style.display = 'flex';
            if (this.urlInput) this.urlInput.value = 'about:addons';
            if (activeTab.tabEl) {
                const titleSpan = activeTab.tabEl.querySelector('.tab-title');
                if (titleSpan) titleSpan.textContent = 'Add-ons & Themes';
                const favBox = activeTab.tabEl.querySelector('.tab-favicon-container');
                if (favBox) favBox.innerHTML = getBrandIconHtml('about:addons', 'Add-ons & Themes');
            }
            if (activeTab.webviewEl && activeTab.webviewEl.src !== 'about:blank') {
                activeTab.webviewEl.src = 'about:blank';
            }
            this.onOpenAddonsDashboard();
        } else if (isHomeUrl(target)) {
            if (this.homeDashboard) this.homeDashboard.style.display = 'flex';
            if (this.addonsDashboard) this.addonsDashboard.style.display = 'none';
            activeTab.url = 'about:home';
            if (this.urlInput) {
                this.urlInput.value = '';
                this.urlInput.placeholder = 'Search Google or enter address...';
            }
            if (activeTab.tabEl) {
                const titleSpan = activeTab.tabEl.querySelector('.tab-title');
                if (titleSpan) titleSpan.textContent = 'New Tab';
                const favBox = activeTab.tabEl.querySelector('.tab-favicon-container');
                if (favBox) favBox.innerHTML = getBrandIconHtml('about:home', 'New Tab');
            }
            if (activeTab.webviewEl && activeTab.webviewEl.src !== 'about:blank') {
                activeTab.webviewEl.src = 'about:blank';
            }
        } else {
            if (this.homeDashboard) this.homeDashboard.style.display = 'none';
            if (this.addonsDashboard) this.addonsDashboard.style.display = 'none';
            if (this.urlInput) this.urlInput.value = target;
            if (activeTab.webviewEl) {
                activeTab.webviewEl.src = target;
            }
        }
        this.updateControlsState();
        this.onTabChanged(activeTab);
    }

    updateControlsState() {
        const activeTab = this.tabs.find(t => t.id === this.activeTabId);
        if (!activeTab || !activeTab.webviewEl) return;

        try {
            if (this.btnBack) this.btnBack.disabled = !activeTab.webviewEl.canGoBack();
            if (this.btnForward) this.btnForward.disabled = !activeTab.webviewEl.canGoForward();
        } catch {
            if (this.btnBack) this.btnBack.disabled = true;
            if (this.btnForward) this.btnForward.disabled = true;
        }
    }

    getActiveTab() {
        return this.tabs.find(t => t.id === this.activeTabId) || null;
    }

    getAllTabs() {
        return this.tabs;
    }

    _injectWebstoreHelper(wv, url) {
        if (!url || !url.includes('chromewebstore.google.com/detail/')) return;

        // Flexible regex: extension IDs are typically 32 chars but some are 33
        const match = url.match(/\/detail\/(?:[^\/]+\/)?([a-z]{32,33})/i);
        if (!match) return;

        const extId = match[1];
        const helperScript = `
            (function() {
                // Remove any existing pill (SPA re-navigation)
                const existing = document.getElementById('yt-webstore-installer-pill');
                if (existing) existing.remove();

                const pill = document.createElement('div');
                pill.id = 'yt-webstore-installer-pill';
                pill.style.cssText = 'position:fixed; bottom:28px; right:28px; z-index:2147483647; background:#0f172a; border:1px solid rgba(255,255,255,0.15); border-radius:14px; padding:14px 20px; display:flex; align-items:center; gap:14px; box-shadow:0 12px 40px rgba(0,0,0,0.5); font-family:-apple-system,BlinkMacSystemFont,sans-serif; color:#f8fafc; font-size:13.5px; backdrop-filter:blur(12px);';
                pill.innerHTML = '<div style="display:flex;align-items:center;gap:8px;font-weight:600;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a1.5 1.5 0 0 0-3 0V5H6a2 2 0 0 0-2 2v4H2.5a1.5 1.5 0 0 0 0 3H4v4a2 2 0 0 0 2 2h4v1.5a1.5 1.5 0 0 0 3 0V20h4a2 2 0 0 0 2-2v-4h1.5a1.5 1.5 0 0 0 0-3z"/></svg><span>Add to Research Browser</span></div><button id="btn-inject-install-ext" style="background:#2563eb;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;transition:all 0.15s ease;">Install Now</button>';
                document.body.appendChild(pill);

                document.getElementById('btn-inject-install-ext').addEventListener('click', function() {
                    this.disabled = true;
                    this.textContent = 'Installing...';
                    this.style.background = '#475569';
                    console.log('[YT_BROWSER_INSTALL_EXTENSION]:${extId}');
                });
            })();
        `;

        // Delay slightly for SPA pages to finish rendering
        setTimeout(() => {
            wv.executeJavaScript(helperScript).catch(() => {});
        }, 800);
    }

    _injectLinkHandler(wv) {
        if (!wv) return;
        const linkScript = `
            (function() {
                if (window.__yt_link_capture_injected) return;
                window.__yt_link_capture_injected = true;

                function getClosestAnchor(el) {
                    while (el && el !== document && el !== document.body) {
                        if (el.tagName && el.tagName.toLowerCase() === 'a' && el.href) {
                            return el;
                        }
                        el = el.parentElement || el.parentNode;
                    }
                    return null;
                }

                function onLinkInteraction(e) {
                    const isMiddle = e.button === 1;
                    const isModifier = (e.metaKey || e.ctrlKey || isMiddle);
                    const isShift = e.shiftKey;

                    // Only intercept if a modifier key or middle click is involved
                    if (!isModifier && !isShift) return;

                    const anchor = getClosestAnchor(e.target);
                    if (!anchor) return;

                    const href = anchor.href;
                    if (!href || href.startsWith('javascript:') || href === '#' || href.startsWith('#')) return;

                    e.preventDefault();
                    e.stopPropagation();

                    const activate = isShift ? true : true;
                    console.log('[YT_BROWSER_OPEN_LINK]:' + JSON.stringify({ url: href, activate }));
                }

                document.addEventListener('click', onLinkInteraction, true);
                document.addEventListener('auxclick', onLinkInteraction, true);
            })();
        `;
        wv.executeJavaScript(linkScript).catch(() => {});
    }
}
