// ==========================================================================
// YT Studio Pro — Top Sites & Bookmarks Bar Controller
// ==========================================================================

import { DEFAULT_PINNED_APPS } from '../../data/defaultShortcuts.js';
import { getBrandIconHtml } from '../../data/brandIcons.js';
import { parseUrl } from './urlUtils.js';

export class TopSitesController {
    constructor({ pinnedBar, homeAppsGrid, pinAppModal, pinModalTitle, btnClosePinModal, btnPinCancel, btnPinSave, pinNameInput, pinUrlInput, homeBtnAddPin, btnPinPage, onNavigate, onCreateTab }) {
        this.pinnedBar = pinnedBar;
        this.homeAppsGrid = homeAppsGrid;
        this.pinAppModal = pinAppModal;
        this.pinModalTitle = pinModalTitle;
        this.btnClosePinModal = btnClosePinModal;
        this.btnPinCancel = btnPinCancel;
        this.btnPinSave = btnPinSave;
        this.pinNameInput = pinNameInput;
        this.pinUrlInput = pinUrlInput;
        this.homeBtnAddPin = homeBtnAddPin;
        this.btnPinPage = btnPinPage;
        this.onNavigate = onNavigate || (() => {});
        this.onCreateTab = onCreateTab || null;

        this.editingPinIndex = -1;
        this.pinnedApps = this.loadPinnedApps();

        this.init();
    }

    loadPinnedApps() {
        try {
            const raw = localStorage.getItem('yt_browser_pinned_apps');
            return raw ? JSON.parse(raw) : DEFAULT_PINNED_APPS;
        } catch {
            return DEFAULT_PINNED_APPS;
        }
    }

    savePinnedApps() {
        localStorage.setItem('yt_browser_pinned_apps', JSON.stringify(this.pinnedApps));
    }

    init() {
        if (this.btnClosePinModal) this.btnClosePinModal.addEventListener('click', () => this.closePinModal());
        if (this.btnPinCancel) this.btnPinCancel.addEventListener('click', () => this.closePinModal());
        if (this.homeBtnAddPin) this.homeBtnAddPin.addEventListener('click', () => this.openPinModal());
        if (this.btnPinPage) this.btnPinPage.addEventListener('click', () => this.togglePinCurrentPage());

        if (this.btnPinSave) {
            this.btnPinSave.addEventListener('click', () => {
                const name = this.pinNameInput ? this.pinNameInput.value.trim() : '';
                const url = this.pinUrlInput ? this.pinUrlInput.value.trim() : '';
                if (url) {
                    if (this.editingPinIndex >= 0 && this.editingPinIndex < this.pinnedApps.length) {
                        const normalized = parseUrl(url);
                        this.pinnedApps[this.editingPinIndex] = {
                            name: name || new URL(normalized).hostname.replace('www.', ''),
                            url: normalized
                        };
                        this.savePinnedApps();
                        this.render();
                    } else {
                        this.addPinnedApp(name, url);
                    }
                    this.closePinModal();
                }
            });
        }

        this.render();
    }

    render() {
        if (this.pinnedBar) {
            this.pinnedBar.innerHTML = this.pinnedApps.map((app, idx) => `
                <button class="pinned-app-chip" data-index="${idx}" title="${app.name} (${app.url})">
                    <span class="pinned-app-icon-wrap">${getBrandIconHtml(app.url, app.name, false)}</span>
                    <span class="pinned-app-name">${app.name}</span>
                </button>
            `).join('') + `
                <button class="btn-add-pin-chip" id="btn-add-pinned-bar" title="Pin custom web app">+ Add</button>
            `;

            this.pinnedBar.querySelectorAll('.pinned-app-chip').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(btn.getAttribute('data-index'), 10);
                    const app = this.pinnedApps[idx];
                    if (!app) return;
                    const isNewTab = e.metaKey || e.ctrlKey;
                    if (isNewTab && this.onCreateTab) {
                        this.onCreateTab(app.url, true);
                    } else {
                        this.onNavigate(app.url);
                    }
                });
                btn.addEventListener('auxclick', (e) => {
                    if (e.button === 1) {
                        e.preventDefault();
                        const idx = parseInt(btn.getAttribute('data-index'), 10);
                        const app = this.pinnedApps[idx];
                        if (app && this.onCreateTab) this.onCreateTab(app.url, true);
                    }
                });
            });

            const btnAddBar = document.getElementById('btn-add-pinned-bar');
            if (btnAddBar) btnAddBar.addEventListener('click', () => this.openPinModal());
        }

        if (this.homeAppsGrid) {
            this.homeAppsGrid.innerHTML = this.pinnedApps.map((app, idx) => `
                <div class="home-app-card" data-index="${idx}" title="${app.name}">
                    <div class="home-app-actions">
                        <button class="home-app-action-btn edit" data-edit-index="${idx}" title="Edit Shortcut">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="home-app-action-btn delete" data-delete-index="${idx}" title="Remove Shortcut">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    ${getBrandIconHtml(app.url, app.name, true)}
                    <span class="home-app-name">${app.name}</span>
                </div>
            `).join('');

            this.homeAppsGrid.querySelectorAll('.home-app-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.home-app-action-btn.delete')) {
                        e.stopPropagation();
                        const delIdx = parseInt(e.target.closest('.home-app-action-btn.delete').getAttribute('data-delete-index'), 10);
                        this.removePinnedApp(delIdx);
                        return;
                    }
                    if (e.target.closest('.home-app-action-btn.edit')) {
                        e.stopPropagation();
                        const editIdx = parseInt(e.target.closest('.home-app-action-btn.edit').getAttribute('data-edit-index'), 10);
                        const app = this.pinnedApps[editIdx];
                        if (app) this.openPinModal(app.url, app.name, editIdx);
                        return;
                    }
                    const idx = parseInt(card.getAttribute('data-index'), 10);
                    const app = this.pinnedApps[idx];
                    if (!app) return;
                    const isNewTab = e.metaKey || e.ctrlKey;
                    if (isNewTab && this.onCreateTab) {
                        this.onCreateTab(app.url, true);
                    } else {
                        this.onNavigate(app.url);
                    }
                });
                card.addEventListener('auxclick', (e) => {
                    if (e.button === 1) {
                        e.preventDefault();
                        const idx = parseInt(card.getAttribute('data-index'), 10);
                        const app = this.pinnedApps[idx];
                        if (app && this.onCreateTab) this.onCreateTab(app.url, true);
                    }
                });
            });
        }
    }

    addPinnedApp(name, url) {
        if (!url) return;
        const normalized = parseUrl(url);
        this.pinnedApps.push({
            name: name || new URL(normalized).hostname.replace('www.', ''),
            url: normalized
        });
        this.savePinnedApps();
        this.render();
    }

    removePinnedApp(index) {
        this.pinnedApps.splice(index, 1);
        this.savePinnedApps();
        this.render();
    }

    togglePin(currentTitle, currentUrl) {
        if (!currentUrl || currentUrl === 'about:home') return;

        const existingIdx = this.pinnedApps.findIndex(a => a.url === currentUrl);
        if (existingIdx >= 0) {
            this.removePinnedApp(existingIdx);
            if (this.btnPinPage) this.btnPinPage.classList.remove('pinned');
        } else {
            this.addPinnedApp(currentTitle || 'Page', currentUrl);
            if (this.btnPinPage) this.btnPinPage.classList.add('pinned');
        }
    }

    openPinModal(initialUrl = '', initialName = '', editIndex = -1) {
        if (!this.pinAppModal) return;
        this.editingPinIndex = editIndex;
        if (this.pinModalTitle) {
            this.pinModalTitle.textContent = editIndex >= 0 ? '✏️ Edit Web App / Shortcut' : '📌 Pin Web App / Shortcut';
        }
        if (this.pinNameInput) this.pinNameInput.value = initialName;
        if (this.pinUrlInput) this.pinUrlInput.value = initialUrl;
        this.pinAppModal.style.display = 'flex';
        if (this.pinNameInput) this.pinNameInput.focus();
    }

    closePinModal() {
        if (this.pinAppModal) this.pinAppModal.style.display = 'none';
        this.editingPinIndex = -1;
    }
}
