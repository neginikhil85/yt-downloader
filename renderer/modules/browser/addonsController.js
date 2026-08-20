// ==========================================================================
// YT Studio Pro — Chrome Extension Hub & Add-ons Controller
// ==========================================================================

import { CURATED_ADDONS_DATA } from '../../data/curatedAddons.js';

export class AddonsController {
    constructor({
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
        onExtensionInstalled,
        onOpenTab
    }) {
        this.extCuratedGrid = extCuratedGrid;
        this.extInstalledList = extInstalledList;
        this.extInstalledPill = extInstalledPill;
        this.activeCountBadge = activeCountBadge;
        this.extMarketSearch = extMarketSearch;
        this.extCatPills = extCatPills || [];
        this.extSideloadInput = extSideloadInput;
        this.extSideloadBtn = extSideloadBtn;
        this.extSideloadStatus = extSideloadStatus;
        this.extBtnSideloadFolder = extBtnSideloadFolder;
        this.extBtnQuickUnpack = extBtnQuickUnpack;
        this.addonsNavBtns = addonsNavBtns || [];
        this.addonsTabContents = addonsTabContents || [];
        this.onExtensionInstalled = onExtensionInstalled || (() => {});
        this.onOpenTab = onOpenTab || (() => {});

        this.installedExtensionsList = [];
        this.currentMarketFilter = 'all';

        this.init();
    }

    init() {
        if (this.extMarketSearch) {
            this.extMarketSearch.addEventListener('input', () => this.renderCurated());
        }

        this.extCatPills.forEach(pill => {
            pill.addEventListener('click', () => {
                this.extCatPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.currentMarketFilter = pill.getAttribute('data-cat') || 'all';
                this.renderCurated();
            });
        });

        this.addonsNavBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-target');
                if (target) this.switchTab(target);
            });
        });

        if (this.extSideloadBtn) {
            this.extSideloadBtn.addEventListener('click', () => this.handleSideloadUrl());
        }

        const handleUnpack = () => this.handleUnpackFolder();
        if (this.extBtnSideloadFolder) this.extBtnSideloadFolder.addEventListener('click', handleUnpack);
        if (this.extBtnQuickUnpack) this.extBtnQuickUnpack.addEventListener('click', handleUnpack);

        this.loadInstalled();
    }

    switchTab(viewId) {
        this.addonsNavBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-target') === viewId);
        });
        this.addonsTabContents.forEach(view => {
            view.classList.toggle('active', view.id === viewId);
        });
    }

    async loadInstalled() {
        if (!window.electronAPI || !window.electronAPI.extensionGetInstalled) return;
        try {
            this.installedExtensionsList = await window.electronAPI.extensionGetInstalled();
            this.updateBadges();
            this.renderInstalled();
            this.renderCurated();
        } catch (e) {
            console.warn('[ExtensionHub] Load error:', e);
        }
    }

    updateBadges() {
        const activeCount = this.installedExtensionsList.filter(e => e.enabled).length;
        if (this.activeCountBadge) {
            this.activeCountBadge.textContent = activeCount;
            this.activeCountBadge.style.display = activeCount > 0 ? 'inline-block' : 'none';
        }
        if (this.extInstalledPill) {
            this.extInstalledPill.textContent = this.installedExtensionsList.length;
        }
    }

    renderCurated() {
        if (!this.extCuratedGrid) return;
        const query = (this.extMarketSearch?.value || '').toLowerCase().trim();

        const filtered = CURATED_ADDONS_DATA.filter(addon => {
            const matchesCat = this.currentMarketFilter === 'all' || addon.category === this.currentMarketFilter;
            const matchesQuery = !query || addon.name.toLowerCase().includes(query) || addon.description.toLowerCase().includes(query) || addon.category.toLowerCase().includes(query);
            return matchesCat && matchesQuery;
        });

        this.extCuratedGrid.innerHTML = filtered.map(addon => {
            const installed = this.installedExtensionsList.find(e => e.id === addon.id);
            const isInstalled = !!installed;

            return `
                <div class="ext-addon-card">
                    <div class="ext-card-top">
                        <div class="ext-addon-icon-wrap">
                            ${addon.iconSvg}
                        </div>
                        <div class="ext-card-info">
                            <div class="ext-card-title-row">
                                <h5 class="ext-addon-name">${addon.name}</h5>
                                <span class="ext-addon-badge">${addon.badge}</span>
                            </div>
                            <div class="ext-addon-author-row">
                                <span>by ${addon.author}</span>
                                <span>•</span>
                                <span class="ext-addon-rating">${addon.rating || '★ 4.8'}</span>
                            </div>
                            <p class="ext-addon-desc">${addon.description}</p>
                        </div>
                    </div>
                    <div class="ext-card-footer">
                        <span class="ext-addon-cat-tag">${addon.category}</span>
                        ${isInstalled 
                            ? `<span class="ext-btn-installed">✓ Installed</span>`
                            : `<button class="ext-btn-install" data-ext-id="${addon.id}">＋ Add to Browser</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        this.extCuratedGrid.querySelectorAll('.ext-btn-install').forEach(btn => {
            btn.addEventListener('click', async () => {
                const extId = btn.getAttribute('data-ext-id');
                if (!extId) return;
                btn.disabled = true;
                btn.textContent = 'Installing...';
                try {
                    const res = await window.electronAPI.extensionInstall(extId);
                    if (res && res.success) {
                        btn.outerHTML = `<span class="ext-btn-installed">✓ Installed</span>`;
                        await this.loadInstalled();
                        this.onExtensionInstalled(res.extension);
                    } else {
                        btn.disabled = false;
                        btn.textContent = '＋ Add to Browser';
                        alert('Install notice: ' + (res?.error || 'Failed'));
                    }
                } catch (err) {
                    btn.disabled = false;
                    btn.textContent = '＋ Add to Browser';
                    alert('Install Error: ' + err.message);
                }
            });
        });
    }

    renderInstalled() {
        if (!this.extInstalledList) return;
        if (!this.installedExtensionsList.length) {
            this.extInstalledList.innerHTML = `
                <div style="text-align: center; padding: 48px 20px; color: #64748b;">
                    <div style="font-size: 32px; margin-bottom: 10px;">🧩</div>
                    <div style="font-size: 13.5px; font-weight: 500; color: #94a3b8;">No Extensions Installed Yet</div>
                    <div style="font-size: 12px; margin-top: 4px;">Browse the Addon Store or sideload any Chrome Web Store extension.</div>
                </div>
            `;
            return;
        }

        this.extInstalledList.innerHTML = this.installedExtensionsList.map(ext => {
            const iconHtml = ext.iconDataUrl
                ? `<img src="${ext.iconDataUrl}" width="36" height="36" style="border-radius:8px; object-fit:contain;" alt="${ext.name}" />`
                : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--br-text-muted, #64748b)" stroke-width="1.5"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a1.5 1.5 0 0 0-3 0V5H6a2 2 0 0 0-2 2v4H2.5a1.5 1.5 0 0 0 0 3H4v4a2 2 0 0 0 2 2h4v1.5a1.5 1.5 0 0 0 3 0V20h4a2 2 0 0 0 2-2v-4h1.5a1.5 1.5 0 0 0 0-3z"/></svg>`;

                const launchUrl = ext.popupUrl || ext.optionsUrl;
                const launchBtn = launchUrl ? `
                    <button class="ext-icon-btn launch" data-action="launch" data-url="${launchUrl}" title="Open Extension Interface">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </button>
                ` : '';

                return `
                <div class="ext-installed-item">
                    <div class="ext-item-left">
                        <div class="ext-item-icon">${iconHtml}</div>
                        <div>
                            <div class="ext-item-name-row">
                                <span class="ext-item-name">${ext.name}</span>
                                <span class="ext-item-version">v${ext.version || '1.0'}</span>
                                ${ext.isUnpacked ? `<span class="ext-addon-badge">Local</span>` : ''}
                            </div>
                            <div class="ext-item-desc">${ext.description || 'Chromium extension runtime component'}</div>
                        </div>
                    </div>
                    <div class="ext-item-actions">
                        ${launchBtn}
                        <button class="ext-icon-btn" data-action="folder" data-id="${ext.id}" title="Open Extension Folder">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        </button>
                        <button class="ext-icon-btn delete" data-action="delete" data-id="${ext.id}" title="Remove Extension">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                        <label class="ext-switch" title="Toggle Extension">
                            <input type="checkbox" data-action="toggle" data-id="${ext.id}" ${ext.enabled ? 'checked' : ''}>
                            <span class="ext-slider"></span>
                        </label>
                    </div>
                </div>
            `;
        }).join('');

        this.extInstalledList.querySelectorAll('[data-action="launch"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.getAttribute('data-url');
                if (url && this.onOpenTab) this.onOpenTab(url, true);
            });
        });

        this.extInstalledList.querySelectorAll('[data-action="toggle"]').forEach(input => {
            input.addEventListener('change', async (e) => {
                const id = input.getAttribute('data-id');
                const enabled = e.target.checked;
                await window.electronAPI.extensionToggle(id, enabled);
                await this.loadInstalled();
            });
        });

        this.extInstalledList.querySelectorAll('[data-action="folder"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (id) await window.electronAPI.extensionOpenFolder(id);
            });
        });

        this.extInstalledList.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (id && confirm('Are you sure you want to remove this extension?')) {
                    await window.electronAPI.extensionRemove(id);
                    await this.loadInstalled();
                }
            });
        });
    }

    async handleSideloadUrl() {
        const val = this.extSideloadInput?.value || '';
        if (!val.trim()) return;

        if (this.extSideloadStatus) {
            this.extSideloadStatus.style.display = 'block';
            this.extSideloadStatus.className = 'addons-sideload-msg loading';
            this.extSideloadStatus.textContent = '⏳ Downloading CRX & Unpacking Extension from Chrome Web Store...';
        }

        if (this.extSideloadBtn) this.extSideloadBtn.disabled = true;

        try {
            const res = await window.electronAPI.extensionInstall(val.trim());
            if (res && res.success) {
                if (this.extSideloadStatus) {
                    this.extSideloadStatus.className = 'addons-sideload-msg success';
                    this.extSideloadStatus.textContent = `✓ Successfully installed & activated: ${res.extension.name} (v${res.extension.version})`;
                }
                if (this.extSideloadInput) this.extSideloadInput.value = '';
                await this.loadInstalled();
                this.onExtensionInstalled(res.extension);
            } else {
                if (this.extSideloadStatus) {
                    this.extSideloadStatus.className = 'addons-sideload-msg error';
                    this.extSideloadStatus.textContent = `✕ Install Failed: ${res?.error || 'Unknown error'}`;
                }
            }
        } catch (err) {
            if (this.extSideloadStatus) {
                this.extSideloadStatus.className = 'addons-sideload-msg error';
                this.extSideloadStatus.textContent = `✕ Error: ${err.message}`;
            }
        } finally {
            if (this.extSideloadBtn) this.extSideloadBtn.disabled = false;
        }
    }

    async handleUnpackFolder() {
        try {
            const res = await window.electronAPI.extensionInstallUnpacked();
            if (res && res.success) {
                alert(`✓ Loaded unpacked extension: ${res.extension.name}`);
                await this.loadInstalled();
                this.switchTab('addons-view-installed');
                this.onExtensionInstalled(res.extension);
            } else if (res && res.error) {
                alert('Unpacked Load Notice: ' + res.error);
            }
        } catch (err) {
            alert('Load Unpacked Error: ' + err.message);
        }
    }
}
