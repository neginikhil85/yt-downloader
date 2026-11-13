// ==========================================================================
// YT Studio Pro — Bookmarks Manager & Library (Chrome / Edge Style Hub)
// ==========================================================================

import { escapeHtml } from '../utils.js';
import { getBrandIconHtml } from '../../data/brandIcons.js';
import { parseUrl } from './urlUtils.js';

const STORAGE_KEY = 'yt_browser_bookmarks';

export class BookmarksManager {
    constructor({ panel, btnToggle, btnPinPage, searchInput, listWrap, btnAddCurrent, btnClose, onNavigate, onCreateTab, getActivePageInfo, onBookmarksUpdated, onBeforeOpen }) {
        this.panel = panel;
        this.btnToggle = btnToggle;
        this.btnPinPage = btnPinPage;
        this.searchInput = searchInput;
        this.listWrap = listWrap;
        this.btnAddCurrent = btnAddCurrent;
        this.btnClose = btnClose;
        this.onNavigate = onNavigate || (() => {});
        this.onCreateTab = onCreateTab || (() => {});
        this.getActivePageInfo = getActivePageInfo || (() => ({ title: '', url: '' }));
        this.onBookmarksUpdated = onBookmarksUpdated || (() => {});
        this.onBeforeOpen = onBeforeOpen || (() => {});

        this.bookmarks = this.loadBookmarks();
        this.currentFilter = '';

        this.init();
    }

    loadBookmarks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);

            // Seed initial bookmarks from pinned apps if available
            const pinnedRaw = localStorage.getItem('yt_browser_pinned_apps');
            if (pinnedRaw) {
                const pinned = JSON.parse(pinnedRaw);
                if (Array.isArray(pinned) && pinned.length > 0) {
                    this.saveBookmarks(pinned);
                    return pinned;
                }
            }
            return [];
        } catch {
            return [];
        }
    }

    saveBookmarks(data = this.bookmarks) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            this.bookmarks = data;
            this.onBookmarksUpdated(this.bookmarks);
        } catch (e) {
            console.warn('[BookmarksManager] Failed to save bookmarks:', e);
        }
    }

    isBookmarked(url) {
        if (!url || url.startsWith('about:')) return false;
        const norm = parseUrl(url).toLowerCase().replace(/\/$/, '');
        return this.bookmarks.some(b => {
            const bNorm = parseUrl(b.url).toLowerCase().replace(/\/$/, '');
            return bNorm === norm;
        });
    }

    addBookmark({ title, url, folder = 'Bookmarks' }) {
        if (!url || url.startsWith('about:')) return false;
        const normalized = parseUrl(url);

        if (this.isBookmarked(normalized)) {
            return false;
        }

        const cleanTitle = (title && title.trim()) ? title.trim() : new URL(normalized).hostname.replace('www.', '');

        this.bookmarks.unshift({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: cleanTitle,
            title: cleanTitle,
            url: normalized,
            folder,
            addedAt: Date.now()
        });

        this.saveBookmarks();
        this.syncStarButton(normalized);
        if (this.isOpen()) this.render();
        return true;
    }

    removeBookmark(url) {
        if (!url) return false;
        const norm = parseUrl(url).toLowerCase().replace(/\/$/, '');
        const beforeLen = this.bookmarks.length;
        this.bookmarks = this.bookmarks.filter(b => {
            const bNorm = parseUrl(b.url).toLowerCase().replace(/\/$/, '');
            return bNorm !== norm;
        });

        if (this.bookmarks.length !== beforeLen) {
            this.saveBookmarks();
            this.syncStarButton(url);
            if (this.isOpen()) this.render();
            return true;
        }
        return false;
    }

    removeBookmarkById(id) {
        this.bookmarks = this.bookmarks.filter(b => b.id !== id);
        this.saveBookmarks();
        const active = this.getActivePageInfo();
        if (active && active.url) this.syncStarButton(active.url);
        if (this.isOpen()) this.render();
    }

    toggleBookmark(title, url) {
        if (!url || url.startsWith('about:')) return false;
        if (this.isBookmarked(url)) {
            this.removeBookmark(url);
            return false;
        } else {
            this.addBookmark({ title, url });
            return true;
        }
    }

    syncStarButton(url) {
        if (!this.btnPinPage) return;
        const bookmarked = this.isBookmarked(url);
        if (bookmarked) {
            this.btnPinPage.classList.add('pinned');
            this.btnPinPage.title = 'Edit bookmark for this tab (Ctrl+D / ⌘D)';
        } else {
            this.btnPinPage.classList.remove('pinned');
            this.btnPinPage.title = 'Bookmark / Pin site (Ctrl+D / ⌘D)';
        }
    }

    getBookmarks(filter = '') {
        const query = filter.trim().toLowerCase();
        if (!query) return this.bookmarks;
        return this.bookmarks.filter(b => 
            (b.name && b.name.toLowerCase().includes(query)) ||
            (b.title && b.title.toLowerCase().includes(query)) ||
            (b.url && b.url.toLowerCase().includes(query))
        );
    }

    init() {
        if (this.btnToggle) {
            this.btnToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        }

        if (this.btnPinPage) {
            this.btnPinPage.addEventListener('click', () => {
                const info = this.getActivePageInfo();
                if (info && info.url && !info.url.startsWith('about:')) {
                    this.toggleBookmark(info.title, info.url);
                }
            });
        }

        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.close());
        }

        if (this.btnAddCurrent) {
            this.btnAddCurrent.addEventListener('click', () => {
                const info = this.getActivePageInfo();
                if (info && info.url && !info.url.startsWith('about:')) {
                    this.addBookmark({ title: info.title, url: info.url });
                }
            });
        }

        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.currentFilter = e.target.value;
                this.render();
            });
        }

        // Close on outside click or webview focus
        document.addEventListener('click', (e) => {
            if (!this.isOpen()) return;
            if (this.panel && !this.panel.contains(e.target) && !this.btnToggle?.contains(e.target)) {
                this.close();
            }
        });
        document.addEventListener('focusin', (e) => {
            if (this.isOpen() && e.target && e.target.tagName === 'WEBVIEW') this.close();
        });

        // Re-position on window resize
        window.addEventListener('resize', () => {
            if (this.isOpen()) this.position();
        });
    }

    isOpen() {
        return this.panel && this.panel.style.display !== 'none';
    }

    position() {
        if (!this.panel || !this.btnToggle) return;
        const parent = this.panel.offsetParent || this.panel.parentElement;
        if (!parent) return;
        const btn = this.btnToggle.getBoundingClientRect();
        const box = parent.getBoundingClientRect();
        this.panel.style.top = `${btn.bottom - box.top + 6}px`;
        const idealRight = box.right - btn.right;
        const maxRight = Math.max(8, box.width - (this.panel.offsetWidth || 360) - 8);
        this.panel.style.right = `${Math.max(8, Math.min(idealRight, maxRight))}px`;
    }

    open() {
        if (!this.panel) return;
        if (this.onBeforeOpen) this.onBeforeOpen();
        this.panel.style.display = 'flex';
        this.position();
        this.currentFilter = '';
        if (this.searchInput) {
            this.searchInput.value = '';
            setTimeout(() => this.searchInput.focus(), 50);
        }
        this.render();
    }

    close() {
        if (!this.panel) return;
        this.panel.style.display = 'none';
    }

    toggle() {
        if (this.isOpen()) {
            this.close();
        } else {
            this.open();
        }
    }

    render() {
        if (!this.listWrap) return;

        const filtered = this.getBookmarks(this.currentFilter);

        if (!filtered.length) {
            this.listWrap.innerHTML = `
                <div class="panel-empty-state">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    <h4>${this.currentFilter ? 'No matching bookmarks' : 'No saved bookmarks yet'}</h4>
                    <p>${this.currentFilter ? 'Try another search term' : 'Click the Star icon or "+ Add Page" to bookmark websites'}</p>
                </div>
            `;
            return;
        }

        this.listWrap.innerHTML = `
            <div class="panel-items-sublist">
                ${filtered.map(b => `
                    <div class="bookmark-item" data-id="${b.id || ''}" data-url="${escapeHtml(b.url)}" title="${escapeHtml(b.name || b.title)} (${escapeHtml(b.url)})">
                        <span class="bookmark-item-icon">${getBrandIconHtml(b.url, b.name || b.title, false)}</span>
                        <div class="bookmark-item-details">
                            <span class="bookmark-item-title">${escapeHtml(b.name || b.title || b.url)}</span>
                            <span class="bookmark-item-url">${escapeHtml(b.url)}</span>
                        </div>
                        <button class="bookmark-item-delete" data-url="${escapeHtml(b.url)}" data-id="${b.id || ''}" title="Remove bookmark">✕</button>
                    </div>
                `).join('')}
            </div>
        `;

        // Event delegation for clicks & delete
        this.listWrap.querySelectorAll('.bookmark-item').forEach(itemEl => {
            itemEl.addEventListener('click', (e) => {
                if (e.target.closest('.bookmark-item-delete')) {
                    e.stopPropagation();
                    const deleteBtn = e.target.closest('.bookmark-item-delete');
                    const bId = deleteBtn.getAttribute('data-id');
                    const bUrl = deleteBtn.getAttribute('data-url');
                    if (bId) this.removeBookmarkById(bId);
                    else if (bUrl) this.removeBookmark(bUrl);
                    return;
                }

                const url = itemEl.getAttribute('data-url');
                if (!url) return;

                const isNewTab = e.metaKey || e.ctrlKey || e.button === 1;
                if (isNewTab) {
                    this.onCreateTab(url, true);
                } else {
                    this.onNavigate(url);
                    this.close();
                }
            });

            itemEl.addEventListener('auxclick', (e) => {
                if (e.button === 1) {
                    e.preventDefault();
                    const url = itemEl.getAttribute('data-url');
                    if (url) this.onCreateTab(url, true);
                }
            });
        });
    }
}
