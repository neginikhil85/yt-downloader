// ==========================================================================
// YT Studio Pro — Chrome-Style Extensions Menu & Action Popups Controller
// ==========================================================================

export class ExtensionsMenu {
    constructor({
        btnExtHub,
        extMenuPanel,
        extMenuList,
        extMenuCloseBtn,
        extMenuManageBtn,
        pinnedIconsContainer,
        actionPopover,
        actionPopoverIcon,
        actionPopoverTitle,
        actionPopoverOptions,
        actionPopoverClose,
        actionPopoverOpenTab,
        actionPopoverBody,
        onOpenExtensionHub,
        onCreateTab,
        getActiveTab
    }) {
        this.btnExtHub = btnExtHub;
        this.extMenuPanel = extMenuPanel;
        this.extMenuList = extMenuList;
        this.extMenuCloseBtn = extMenuCloseBtn;
        this.extMenuManageBtn = extMenuManageBtn;
        this.pinnedIconsContainer = pinnedIconsContainer;
        this.actionPopover = actionPopover;
        this.actionPopoverIcon = actionPopoverIcon;
        this.actionPopoverTitle = actionPopoverTitle;
        this.actionPopoverOptions = actionPopoverOptions;
        this.actionPopoverClose = actionPopoverClose;
        this.actionPopoverOpenTab = actionPopoverOpenTab;
        this.actionPopoverBody = actionPopoverBody;
        this.actionPopoverWebview = null;
        this.onOpenExtensionHub = onOpenExtensionHub || (() => {});
        this.onCreateTab = onCreateTab || (() => {});
        this.getActiveTab = getActiveTab || (() => null);

        this.installedExtensions = [];
        this.pinnedExtIds = this.loadPinnedExtIds();
        this.currentActionExt = null;

        this.init();
    }

    loadPinnedExtIds() {
        try {
            const raw = localStorage.getItem('yt_browser_pinned_ext_ids');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    savePinnedExtIds() {
        localStorage.setItem('yt_browser_pinned_ext_ids', JSON.stringify(this.pinnedExtIds));
    }

    init() {
        if (this.btnExtHub) {
            this.btnExtHub.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });
        }

        if (this.extMenuCloseBtn) {
            this.extMenuCloseBtn.addEventListener('click', () => this.closeMenu());
        }

        if (this.extMenuManageBtn) {
            this.extMenuManageBtn.addEventListener('click', () => {
                this.closeMenu();
                this.onOpenExtensionHub('addons-view-installed');
            });
        }

        if (this.actionPopoverOptions) {
            this.actionPopoverOptions.addEventListener('click', () => {
                if (this.currentActionExt && this.currentActionExt.optionsUrl) {
                    this.closeActionPopover();
                    this.onCreateTab(this.currentActionExt.optionsUrl, true);
                }
            });
        }

        if (this.actionPopoverClose) {
            this.actionPopoverClose.addEventListener('click', () => this.closeActionPopover());
        }

        if (this.actionPopoverOpenTab) {
            this.actionPopoverOpenTab.addEventListener('click', () => {
                if (this.currentActionExt) {
                    const targetUrl = this.currentActionExt.popupUrl || this.currentActionExt.optionsUrl;
                    if (targetUrl) {
                        this.closeActionPopover();
                        this.onCreateTab(targetUrl, true);
                    }
                }
            });
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.extMenuPanel && this.extMenuPanel.style.display !== 'none') {
                if (!this.extMenuPanel.contains(e.target) && (!this.btnExtHub || !this.btnExtHub.contains(e.target))) {
                    this.closeMenu();
                }
            }
            if (this.actionPopover && this.actionPopover.style.display !== 'none') {
                if (!this.actionPopover.contains(e.target) && !e.target.closest('.browser-pinned-ext-btn') && !e.target.closest('.ext-menu-item')) {
                    this.closeActionPopover();
                }
            }
        });

        this.loadAndRender();
    }

    async loadAndRender() {
        if (!window.electronAPI || !window.electronAPI.extensionGetInstalled) return;
        try {
            this.installedExtensions = await window.electronAPI.extensionGetInstalled();
            this.renderMenu();
            this.renderPinnedToolbar();
        } catch (e) {
            console.warn('[ExtensionsMenu] Load error:', e);
        }
    }

    toggleMenu() {
        if (!this.extMenuPanel) return;
        const isVisible = this.extMenuPanel.style.display !== 'none';
        if (isVisible) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        if (!this.extMenuPanel) return;
        this.extMenuPanel.style.display = 'flex';
        this.loadAndRender();
    }

    closeMenu() {
        if (this.extMenuPanel) this.extMenuPanel.style.display = 'none';
    }

    renderMenu() {
        if (!this.extMenuList) return;
        const activeExtensions = this.installedExtensions.filter(e => e.enabled);

        if (!activeExtensions.length) {
            this.extMenuList.innerHTML = `
                <div class="ext-menu-empty">
                    <p>No active extensions.</p>
                    <button class="ext-menu-store-link" id="btn-menu-open-store">Explore Extensions Store</button>
                </div>
            `;
            const btnStore = this.extMenuList.querySelector('#btn-menu-open-store');
            if (btnStore) {
                btnStore.addEventListener('click', () => {
                    this.closeMenu();
                    this.onOpenExtensionHub('addons-view-store');
                });
            }
            return;
        }

        this.extMenuList.innerHTML = activeExtensions.map(ext => {
            const isPinned = this.pinnedExtIds.includes(ext.id);
            const iconHtml = ext.iconDataUrl
                ? `<img src="${ext.iconDataUrl}" class="ext-menu-item-icon" alt="" />`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a1.5 1.5 0 0 0-3 0V5H6a2 2 0 0 0-2 2v4H2.5a1.5 1.5 0 0 0 0 3H4v4a2 2 0 0 0 2 2h4v1.5a1.5 1.5 0 0 0 3 0V20h4a2 2 0 0 0 2-2v-4h1.5a1.5 1.5 0 0 0 0-3z"></path></svg>`;

            const hasPopup = !!(ext.popupUrl || ext.optionsUrl);

            return `
                <div class="ext-menu-item" data-id="${ext.id}">
                    <div class="ext-menu-item-left" title="${hasPopup ? 'Click to open ' + ext.name : ext.name + ' is active'}">
                        ${iconHtml}
                        <span class="ext-menu-item-name">${ext.name}</span>
                    </div>
                    <div class="ext-menu-item-right">
                        <button class="ext-menu-pin-btn ${isPinned ? 'pinned' : ''}" data-pin-id="${ext.id}" title="${isPinned ? 'Unpin from toolbar' : 'Pin to toolbar'}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Item click to trigger action or popup
        this.extMenuList.querySelectorAll('.ext-menu-item-left').forEach(row => {
            row.addEventListener('click', () => {
                const parent = row.closest('.ext-menu-item');
                const id = parent?.getAttribute('data-id');
                const ext = this.installedExtensions.find(item => item.id === id);
                if (ext) {
                    this.triggerExtensionAction(ext);
                }
            });
        });

        // Pin toggle click
        this.extMenuList.querySelectorAll('.ext-menu-pin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-pin-id');
                this.togglePin(id);
            });
        });
    }

    togglePin(extId) {
        if (!extId) return;
        if (this.pinnedExtIds.includes(extId)) {
            this.pinnedExtIds = this.pinnedExtIds.filter(id => id !== extId);
        } else {
            this.pinnedExtIds.push(extId);
        }
        this.savePinnedExtIds();
        this.renderMenu();
        this.renderPinnedToolbar();
    }

    renderPinnedToolbar() {
        if (!this.pinnedIconsContainer) return;
        const pinnedList = this.installedExtensions.filter(e => e.enabled && this.pinnedExtIds.includes(e.id));

        this.pinnedIconsContainer.innerHTML = pinnedList.map(ext => {
            const iconHtml = ext.iconDataUrl
                ? `<img src="${ext.iconDataUrl}" class="browser-pinned-ext-img" alt="${ext.name}" />`
                : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a1.5 1.5 0 0 0-3 0V5H6a2 2 0 0 0-2 2v4H2.5a1.5 1.5 0 0 0 0 3H4v4a2 2 0 0 0 2 2h4v1.5a1.5 1.5 0 0 0 3 0V20h4a2 2 0 0 0 2-2v-4h1.5a1.5 1.5 0 0 0 0-3z"></path></svg>`;

            return `
                <button class="browser-btn browser-pinned-ext-btn" data-id="${ext.id}" title="${ext.name}">
                    ${iconHtml}
                </button>
            `;
        }).join('');

        this.pinnedIconsContainer.querySelectorAll('.browser-pinned-ext-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const ext = this.installedExtensions.find(item => item.id === id);
                if (ext) this.triggerExtensionAction(ext);
            });
        });
    }

    triggerExtensionAction(ext) {
        this.closeMenu();
        const targetUrl = ext.popupUrl || ext.optionsUrl;

        if (targetUrl) {
            this.openActionPopover(ext, targetUrl);
        } else {
            alert(`✓ ${ext.name} (v${ext.version || '1.0'}) is active and running automatically on pages.`);
        }
    }

    openActionPopover(ext, targetUrl) {
        if (!this.actionPopover) {
            this.onCreateTab(targetUrl, true);
            return;
        }

        this.currentActionExt = ext;

        if (this.actionPopoverTitle) {
            this.actionPopoverTitle.textContent = ext.name || 'Extension';
        }

        if (this.actionPopoverIcon) {
            this.actionPopoverIcon.innerHTML = ext.iconDataUrl
                ? `<img src="${ext.iconDataUrl}" width="16" height="16" style="border-radius:4px; object-fit:contain;" />`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a1.5 1.5 0 0 0-3 0V5H6a2 2 0 0 0-2 2v4H2.5a1.5 1.5 0 0 0 0 3H4v4a2 2 0 0 0 2 2h4v1.5a1.5 1.5 0 0 0 3 0V20h4a2 2 0 0 0 2-2v-4h1.5a1.5 1.5 0 0 0 0-3z"></path></svg>`;
        }

        if (this.actionPopoverOptions) {
            this.actionPopoverOptions.style.display = ext.optionsUrl ? 'inline-flex' : 'none';
        }

        // 1. Show container
        this.actionPopover.style.display = 'flex';

        // 2. Clean previous webview if any
        if (this.actionPopoverBody) {
            this.actionPopoverBody.innerHTML = '';

            // 3. Create fresh webview dynamically so Electron initializes guest WebContents
            let finalUrl = targetUrl;
            try {
                const activeTab = this.getActiveTab ? this.getActiveTab() : null;
                if (activeTab && activeTab.webviewEl && typeof activeTab.webviewEl.getWebContentsId === 'function') {
                    const wcId = activeTab.webviewEl.getWebContentsId();
                    if (wcId && !finalUrl.includes('tabId=')) {
                        finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'tabId=' + wcId;
                    }
                }
            } catch (e) {}

            const wv = document.createElement('webview');
            wv.id = 'ext-action-popover-webview';
            wv.setAttribute('partition', 'persist:main');
            wv.setAttribute('allowpopups', 'true');
            wv.className = 'ext-action-webview';
            wv.src = finalUrl;

            wv.addEventListener('console-message', (e) => {
                console.log(`[ExtPopover ${ext.name}]:`, e.message);
            });

            this.actionPopoverBody.appendChild(wv);
            this.actionPopoverWebview = wv;
        }
    }

    closeActionPopover() {
        if (this.actionPopover) {
            this.actionPopover.style.display = 'none';
        }
        if (this.actionPopoverBody) {
            this.actionPopoverBody.innerHTML = '';
        }
        this.actionPopoverWebview = null;
        this.currentActionExt = null;
    }
}
