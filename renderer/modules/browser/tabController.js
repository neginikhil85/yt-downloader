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
            if (e.url) this.createTab(e.url, true);
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
}
