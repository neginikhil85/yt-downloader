import { ThemeStudio } from './themeStudio.js';
import { TopSitesController } from './topSitesController.js';
import { AddonsController } from './addonsController.js';
import { FindInPageController } from './findInPage.js';
import { QuickToolsController } from './quickToolsController.js';
import { TabController } from './tabController.js';
import { ExtensionsMenu } from './extensionsMenu.js';
import { createLoadingBar } from './loadingBar.js';
import { DownloadsPanel } from './downloadsPanel.js';
import { ShortcutsHelp, resolveShortcut, shortcutHint } from './shortcuts.js';

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

export function initBrowserManager() {
    // 1. DOM Elements Query
    const tabsContainer = document.getElementById('browser-tabs-scroll');
    const btnNewTab = document.getElementById('browser-btn-new-tab');
    const webviewsContainer = document.getElementById('browser-webview-container');
    const homeDashboard = document.getElementById('browser-home-dashboard');
    const addonsDashboard = document.getElementById('browser-addons-dashboard');
    const homeAppsGrid = document.getElementById('home-apps-grid');
    const pinnedBar = document.getElementById('browser-pinned-bar');
    
    const urlInput = document.getElementById('browser-url-input');
    const btnGo = document.getElementById('browser-btn-go');
    const btnBack = document.getElementById('browser-btn-back');
    const btnForward = document.getElementById('browser-btn-forward');
    const btnReload = document.getElementById('browser-btn-reload');
    const loadingBar = createLoadingBar(document.getElementById('browser-loading-bar'));
    const btnHome = document.getElementById('browser-btn-home');
    const btnFullscreen = document.getElementById('browser-btn-fullscreen');
    const btnPinPage = document.getElementById('browser-btn-pin-page');
    const btnCopyUrl = document.getElementById('browser-btn-copy-url');
    const btnThemeStudio = document.getElementById('browser-btn-theme-studio');
    const btnExtHub = document.getElementById('browser-btn-ext-hub');
    const btnExtensions = document.getElementById('browser-btn-extensions');
    const btnDownloads = document.getElementById('browser-btn-downloads');
    const downloadsPanelEl = document.getElementById('browser-downloads-panel');
    const shortcutsOverlay = document.getElementById('browser-shortcuts-overlay');
    const extBtnShortcuts = document.getElementById('ext-btn-shortcuts');
    const browserPanel = document.getElementById('view-browser');
    const activeCountBadge = document.getElementById('ext-active-count-badge');

    // Chrome-Style Extensions Menu & Action Popover Elements
    const pinnedIconsContainer = document.getElementById('browser-pinned-ext-icons');
    const extMenuPanel = document.getElementById('browser-extensions-menu-panel');
    const extMenuList = document.getElementById('ext-menu-list');
    const extMenuCloseBtn = document.getElementById('ext-menu-close-btn');
    const extMenuManageBtn = document.getElementById('ext-menu-manage-btn');
    const actionPopover = document.getElementById('browser-ext-action-popover');
    const actionPopoverIcon = document.getElementById('ext-action-popover-icon');
    const actionPopoverTitle = document.getElementById('ext-action-popover-title');
    const actionPopoverOptions = document.getElementById('ext-action-popover-options');
    const actionPopoverClose = document.getElementById('ext-action-popover-close');
    const actionPopoverOpenTab = document.getElementById('ext-action-popover-open-tab');
    const actionPopoverBody = document.getElementById('ext-action-popover-body');

    // Quick Popover Elements
    const extPanel = document.getElementById('browser-extensions-panel');
    const extCloseBtn = document.getElementById('ext-close-btn');
    const extToggleAdblock = document.getElementById('ext-toggle-adblock');
    const extToggleDarkmode = document.getElementById('ext-toggle-darkmode');
    const extBtnReader = document.getElementById('ext-btn-reader');
    const extBtnPip = document.getElementById('ext-btn-pip');
    const extUaSelect = document.getElementById('ext-ua-select');
    const extBtnDevtools = document.getElementById('ext-btn-devtools');
    const extBtnInjectJs = document.getElementById('ext-btn-inject-js');
    const extBtnClearCache = document.getElementById('ext-btn-clear-cache');
    const extBtnHardReload = document.getElementById('ext-btn-hard-reload');

    // Add-ons & Themes Dashboard Elements
    const btnOpenWebstore = document.getElementById('btn-open-chromewebstore');
    const btnHeroWebstore = document.getElementById('btn-hero-chromewebstore');
    const addonsNavBtns = document.querySelectorAll('.addons-nav-btn');
    const addonsTabContents = document.querySelectorAll('.addons-tab-content');
    const extCuratedGrid = document.getElementById('ext-curated-grid');
    const extInstalledList = document.getElementById('ext-installed-list');
    const extThemesGrid = document.getElementById('ext-themes-grid');
    const extInstalledPill = document.getElementById('ext-installed-count-pill');
    const extMarketSearch = document.getElementById('ext-market-search');
    const extCatPills = document.querySelectorAll('.addons-cat-pill');
    const extSideloadInput = document.getElementById('ext-sideload-input');
    const extSideloadBtn = document.getElementById('ext-sideload-btn');
    const extSideloadStatus = document.getElementById('ext-sideload-status');
    const extBtnSideloadFolder = document.getElementById('ext-btn-sideload-folder');
    const extBtnQuickUnpack = document.getElementById('ext-btn-quick-unpack');

    // Find in Page Elements
    const findBar = document.getElementById('browser-find-bar');
    const findInput = document.getElementById('browser-find-input');
    const findCount = document.getElementById('browser-find-count');
    const findPrev = document.getElementById('browser-find-prev');
    const findNext = document.getElementById('browser-find-next');
    const findClose = document.getElementById('browser-find-close');

    // Modals
    const pinAppModal = document.getElementById('pin-app-modal');
    const pinModalTitle = document.getElementById('pin-modal-title');
    const btnClosePinModal = document.getElementById('btn-close-pin-modal');
    const btnPinCancel = document.getElementById('btn-pin-cancel');
    const btnPinSave = document.getElementById('btn-pin-save');
    const pinNameInput = document.getElementById('pin-name-input');
    const pinUrlInput = document.getElementById('pin-url-input');

    const scriptModal = document.getElementById('script-inject-modal');
    const btnCloseScriptModal = document.getElementById('btn-close-script-modal');
    const btnScriptCancel = document.getElementById('btn-script-cancel');
    const btnScriptRun = document.getElementById('btn-script-run');
    const scriptTextarea = document.getElementById('script-inject-textarea');

    const homeSearchInput = document.getElementById('home-search-input');
    const homeSearchBtn = document.getElementById('home-search-btn');
    const homeBtnAddPin = document.getElementById('home-btn-add-pin');
    const themeCatPills = document.querySelectorAll('.theme-cat-pill');

    if (!tabsContainer || !webviewsContainer) return;

    // 2. Initialize Sub-Controllers
    const themeStudio = new ThemeStudio({
        browserPanel,
        extThemesGrid,
        themeCatPills
    });

    let tabController;

    const topSites = new TopSitesController({
        pinnedBar,
        homeAppsGrid,
        pinAppModal,
        pinModalTitle,
        btnClosePinModal,
        btnPinCancel,
        btnPinSave,
        pinNameInput,
        pinUrlInput,
        homeBtnAddPin,
        onNavigate: (url) => tabController && tabController.navigateActiveTab(url),
        onCreateTab: (url, activate) => tabController && tabController.createTab(url, activate)
    });

    let extensionsMenu;

    const addonsController = new AddonsController({
        extCuratedGrid,
        extInstalledList,
        extInstalledPill,
        activeCountBadge,
        extMarketSearch,
        extCatPills,
        extSideloadInput,
        extSideloadBtn,
        extSideloadStatus,
        extBtnSideloadFolder,
        extBtnQuickUnpack,
        addonsNavBtns,
        addonsTabContents,
        onOpenTab: (url, activate) => tabController && tabController.createTab(url, activate),
        onExtensionInstalled: () => extensionsMenu && extensionsMenu.loadAndRender(),
        onExtensionsUpdated: () => extensionsMenu && extensionsMenu.loadAndRender()
    });

    const findInPage = new FindInPageController({
        findBar,
        findInput,
        findCount,
        findPrev,
        findNext,
        findClose,
        getActiveWebview: () => tabController?.getActiveTab()?.webviewEl || null
    });

    const quickTools = new QuickToolsController({
        extPanel,
        btnExtensions,
        extCloseBtn,
        extToggleAdblock,
        extToggleDarkmode,
        extBtnReader,
        extBtnPip,
        extUaSelect,
        extBtnDevtools,
        extBtnInjectJs,
        extBtnClearCache,
        extBtnHardReload,
        scriptModal,
        btnCloseScriptModal,
        btnScriptCancel,
        btnScriptRun,
        scriptTextarea,
        getActiveTab: () => tabController?.getActiveTab() || null,
        getAllTabs: () => tabController?.getAllTabs() || []
    });

    tabController = new TabController({
        tabsContainer,
        webviewsContainer,
        homeDashboard,
        addonsDashboard,
        urlInput,
        btnBack,
        btnForward,
        quickTools,
        findInPage,
        onTabChanged: (activeTab) => {
            if (btnPinPage && activeTab) {
                const isPinned = topSites.pinnedApps.some(a => a.url === activeTab.url);
                btnPinPage.classList.toggle('pinned', isPinned);
            }
        },
        onLoadingChanged: (isLoading, { instant = false } = {}) => {
            if (btnReload) {
                btnReload.classList.toggle('loading', isLoading);
                    btnReload.title = isLoading
                        ? 'Stop loading this page (Esc)'
                        : `Reload page (${shortcutHint('reload')})`;
                }
            if (isLoading) loadingBar.start();
            else if (instant) loadingBar.reset();
            else loadingBar.done();
        },
        onOpenAddonsDashboard: () => {
            addonsController.loadInstalled();
            addonsController.renderCurated();
            themeStudio.render();
            if (extensionsMenu) extensionsMenu.loadAndRender();
        }
    });

    function openExtensionHub(targetTab = 'addons-view-store') {
        const existingTab = tabController.getAllTabs().find(t => t.url === 'about:addons');
        if (existingTab) {
            tabController.switchTab(existingTab.id);
        } else {
            tabController.createTab('about:addons', true);
        }
        addonsController.switchTab(targetTab);
        addonsController.loadInstalled();
        themeStudio.render();
        if (extensionsMenu) extensionsMenu.loadAndRender();
    }

    extensionsMenu = new ExtensionsMenu({
        btnExtHub,
        extMenuPanel,
        extMenuList,
        extMenuCloseBtn,
        extMenuManageBtn,
        activeCountBadge,
        pinnedIconsContainer,
        actionPopover,
        actionPopoverIcon,
        actionPopoverTitle,
        actionPopoverOptions,
        actionPopoverClose,
        actionPopoverOpenTab,
        actionPopoverBody,
        onOpenExtensionHub: (tab) => openExtensionHub(tab),
        onCreateTab: (url, activate) => tabController && tabController.createTab(url, activate),
        getActiveTab: () => tabController?.getActiveTab() || null
    });

    // Real-time synchronization of extensions across the entire application (Web Store, sideload, uninstalled, toggled)
    if (window.electronAPI && window.electronAPI.onExtensionsChanged) {
        window.electronAPI.onExtensionsChanged(async () => {
            if (addonsController) await addonsController.loadInstalled();
            if (extensionsMenu) await extensionsMenu.loadAndRender();
        });
    }

    // Chrome-like address bar: a new tab puts the caret in the URL bar, and the
    // first click into the bar selects the whole URL so typing replaces it.
    function focusUrlBar() {
        if (!urlInput) return;
        requestAnimationFrame(() => {
            urlInput.focus();
            urlInput.select();
        });
    }

    function openNewTab() {
        tabController.createTab('about:home', true);
        focusUrlBar();
    }

    // 3. UI Action Bindings
    if (btnNewTab) {
        btnNewTab.addEventListener('click', openNewTab);
    }

    if (urlInput) {
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const openInNewTab = e.altKey || (e.metaKey && e.shiftKey) || (e.ctrlKey && e.shiftKey);
                if (openInNewTab) {
                    tabController.createTab(urlInput.value, true);
                } else {
                    tabController.navigateActiveTab(urlInput.value);
                }
                urlInput.blur();
            } else if (e.key === 'Escape') {
                tabController.syncUrlInput();
                urlInput.select();
            }
        });
        urlInput.addEventListener('focus', () => urlInput.select());

        let selectAllOnMouseUp = false;
        urlInput.addEventListener('mousedown', () => {
            selectAllOnMouseUp = document.activeElement !== urlInput;
        });
        urlInput.addEventListener('mouseup', (e) => {
            // Keep a drag-selection the user made; otherwise select everything.
            if (selectAllOnMouseUp && urlInput.selectionStart === urlInput.selectionEnd) {
                e.preventDefault();
                urlInput.select();
            }
            selectAllOnMouseUp = false;
        });
    }

    if (btnGo) {
        btnGo.addEventListener('click', (e) => {
            const isNewTab = e.metaKey || e.ctrlKey;
            if (isNewTab) {
                tabController.createTab(urlInput.value, true);
            } else {
                tabController.navigateActiveTab(urlInput.value);
            }
        });
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            const activeTab = tabController.getActiveTab();
            if (activeTab && activeTab.webviewEl && activeTab.webviewEl.canGoBack()) {
                activeTab.webviewEl.goBack();
            }
        });
    }

    if (btnForward) {
        btnForward.addEventListener('click', () => {
            const activeTab = tabController.getActiveTab();
            if (activeTab && activeTab.webviewEl && activeTab.webviewEl.canGoForward()) {
                activeTab.webviewEl.goForward();
            }
        });
    }

    if (btnReload) {
        btnReload.addEventListener('click', () => {
            const activeTab = tabController.getActiveTab();
            if (!activeTab || !activeTab.webviewEl) return;
            if (activeTab.loading && activeTab.webviewEl.stop) {
                activeTab.webviewEl.stop();
            } else if (activeTab.webviewEl.reload) {
                activeTab.webviewEl.reload();
            }
        });
    }

    if (btnHome) {
        btnHome.addEventListener('click', () => {
            tabController.navigateActiveTab('about:home');
        });
    }

    function toggleBrowserFullscreen() {
        if (!browserPanel) return;
        if (!document.fullscreenElement) {
            if (browserPanel.requestFullscreen) browserPanel.requestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }

    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', toggleBrowserFullscreen);
    }

    document.addEventListener('fullscreenchange', () => {
        if (browserPanel) {
            if (document.fullscreenElement === browserPanel) {
                browserPanel.classList.add('in-fullscreen');
            } else {
                browserPanel.classList.remove('in-fullscreen');
            }
        }
    });

    if (btnCopyUrl) {
        btnCopyUrl.addEventListener('click', async () => {
            const activeTab = tabController.getActiveTab();
            const textToCopy = (activeTab && activeTab.url) ? activeTab.url : (urlInput ? urlInput.value : '');
            if (textToCopy) {
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    const origTitle = btnCopyUrl.title;
                    btnCopyUrl.title = '✓ Copied!';
                    btnCopyUrl.style.color = '#34d399';
                    setTimeout(() => {
                        btnCopyUrl.title = origTitle;
                        btnCopyUrl.style.color = '';
                    }, 1600);
                } catch (e) {
                    console.error('Copy failed:', e);
                }
            }
        });
    }

    if (btnThemeStudio) {
        btnThemeStudio.addEventListener('click', () => openExtensionHub('addons-view-themes'));
    }

    if (btnOpenWebstore) {
        btnOpenWebstore.addEventListener('click', () => tabController.createTab('https://chromewebstore.google.com/', true));
    }

    if (btnHeroWebstore) {
        btnHeroWebstore.addEventListener('click', () => tabController.createTab('https://chromewebstore.google.com/', true));
    }

    // Home Dashboard Search Input
    if (homeSearchInput) {
        homeSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const openInNewTab = e.altKey || (e.metaKey && e.shiftKey) || (e.ctrlKey && e.shiftKey);
                if (openInNewTab) {
                    tabController.createTab(homeSearchInput.value, true);
                } else {
                    tabController.navigateActiveTab(homeSearchInput.value);
                }
            }
        });
    }
    if (homeSearchBtn) {
        homeSearchBtn.addEventListener('click', (e) => {
            if (homeSearchInput) {
                const isNewTab = e.metaKey || e.ctrlKey;
                if (isNewTab) {
                    tabController.createTab(homeSearchInput.value, true);
                } else {
                    tabController.navigateActiveTab(homeSearchInput.value);
                }
            }
        });
    }

    // 4. Downloads panel, shortcuts help & keyboard shortcuts
    const downloadsPanel = new DownloadsPanel({ button: btnDownloads, panel: downloadsPanelEl });
    const shortcutsHelp = new ShortcutsHelp(shortcutsOverlay);

    if (extBtnShortcuts) {
        extBtnShortcuts.addEventListener('click', () => {
            if (extPanel) extPanel.classList.remove('open');
            shortcutsHelp.open();
        });
    }

    let zoomToast = null;
    let zoomToastTimer = null;
    function showZoomToast(factor) {
        if (!browserPanel) return;
        if (!zoomToast) {
            zoomToast = document.createElement('div');
            zoomToast.className = 'browser-zoom-toast';
            browserPanel.appendChild(zoomToast);
        }
        zoomToast.textContent = `Zoom ${Math.round(factor * 100)}%`;
        zoomToast.classList.add('visible');
        clearTimeout(zoomToastTimer);
        zoomToastTimer = setTimeout(() => zoomToast.classList.remove('visible'), 1200);
    }

    function zoomActiveTab(direction) {
        const wv = tabController.getActiveTab()?.webviewEl;
        if (!wv || !wv.getZoomFactor || !wv.setZoomFactor) return;
        let factor = 1;
        if (direction !== 0) {
            const current = wv.getZoomFactor();
            factor = direction > 0
                ? (ZOOM_STEPS.find(z => z > current + 0.001) || ZOOM_STEPS[ZOOM_STEPS.length - 1])
                : ([...ZOOM_STEPS].reverse().find(z => z < current - 0.001) || ZOOM_STEPS[0]);
        }
        wv.setZoomFactor(factor);
        showZoomToast(factor);
    }

    function closeTopmostOverlay() {
        if (shortcutsHelp.isOpen()) { shortcutsHelp.close(); return true; }
        if (downloadsPanel.isOpen && downloadsPanel.panel && downloadsPanel.isOpen()) { downloadsPanel.close(); return true; }
        if (findBar && findBar.style.display !== 'none') { findInPage.close(); return true; }
        return false;
    }

    /** Runs a browser shortcut action. Returns false if it did nothing. */
    function runShortcut(id, key) {
        const activeTab = tabController.getActiveTab();
        const wv = activeTab && activeTab.url !== 'about:home' && activeTab.url !== 'about:addons'
            ? activeTab.webviewEl : null;

        switch (id) {
            case 'newTab': openNewTab(); break;
            case 'closeTab': if (tabController.activeTabId) tabController.closeTab(tabController.activeTabId); break;
            case 'reopenTab': tabController.reopenClosedTab(); break;
            case 'nextTab': tabController.selectRelativeTab(1); break;
            case 'prevTab': tabController.selectRelativeTab(-1); break;
            case 'goToTab': {
                const target = tabController.getAllTabs()[parseInt(key, 10) - 1];
                if (target) tabController.switchTab(target.id);
                break;
            }
            case 'lastTab': {
                const tabs = tabController.getAllTabs();
                if (tabs.length) tabController.switchTab(tabs[tabs.length - 1].id);
                break;
            }
            case 'focusAddress': focusUrlBar(); break;
            case 'back': if (wv && wv.canGoBack()) wv.goBack(); break;
            case 'forward': if (wv && wv.canGoForward()) wv.goForward(); break;
            case 'reload': if (wv) wv.reload(); break;
            case 'hardReload': if (wv) wv.reloadIgnoringCache(); break;
            case 'stop':
                if (closeTopmostOverlay()) break;
                if (activeTab && activeTab.loading && wv) { wv.stop(); break; }
                return false;
            case 'home': tabController.navigateActiveTab('about:home'); break;
            case 'find': findInPage.open(); break;
            case 'findNext':
            case 'findPrev':
                if (!findBar || findBar.style.display === 'none') findInPage.open();
                else findInPage.execute(id === 'findNext', true);
                break;
            case 'zoomIn': zoomActiveTab(1); break;
            case 'zoomOut': zoomActiveTab(-1); break;
            case 'zoomReset': zoomActiveTab(0); break;
            case 'bookmark': if (activeTab) topSites.togglePin(activeTab.title, activeTab.url); break;
            case 'print': if (wv && wv.print) wv.print().catch(() => {}); break;
            case 'devtools': if (wv) quickTools.openDevTools(); break;
            case 'fullscreen': toggleBrowserFullscreen(); break;
            case 'downloads': downloadsPanel.toggle(); break;
            case 'shortcutsHelp': shortcutsHelp.toggle(); break;
            default: return false;
        }
        return true;
    }

    const isBrowserVisible = () => browserPanel && browserPanel.classList.contains('active');

    // Keys pressed while the app UI (address bar, tabs, panels) has focus
    document.addEventListener('keydown', (e) => {
        if (!isBrowserVisible()) return;
        const id = resolveShortcut(e);
        if (id && runShortcut(id, e.key)) e.preventDefault();
    });

    // Keys pressed while focus is inside a web page (forwarded by main.js)
    if (window.electronAPI && window.electronAPI.onBrowserShortcut) {
        window.electronAPI.onBrowserShortcut(({ id, key }) => {
            if (isBrowserVisible()) runShortcut(id, key);
        });
    }

    // 5. Initial Boot
    tabController.createTab('about:home', true);
}