// ==========================================================================
// YT Studio Pro — Browser History Manager (Chrome / Edge Style Hub)
// ==========================================================================

import { escapeHtml } from '../utils.js';
import { getBrandIconHtml } from '../../data/brandIcons.js';

const STORAGE_KEY = 'yt_browser_history';
const MAX_ENTRIES = 1000;

export class HistoryManager {
    constructor({ panel, btnToggle, searchInput, listWrap, btnClear, btnClose, onNavigate, onCreateTab, getRecentlyClosed, onBeforeOpen }) {
        this.panel = panel;
        this.btnToggle = btnToggle;
        this.searchInput = searchInput;
        this.listWrap = listWrap;
        this.btnClear = btnClear;
        this.btnClose = btnClose;
        this.onNavigate = onNavigate || (() => {});
        this.onCreateTab = onCreateTab || (() => {});
        this.getRecentlyClosed = getRecentlyClosed || (() => []);
        this.onBeforeOpen = onBeforeOpen || (() => {});

        this.entries = this.loadHistory();
        this.currentFilter = '';

        this.init();
    }

    loadHistory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    saveHistory() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries.slice(0, MAX_ENTRIES)));
        } catch (e) {
            console.warn('[HistoryManager] Failed to save history:', e);
        }
    }

    recordVisit({ url, title }) {
        if (!url || typeof url !== 'string') return;
        if (url.startsWith('about:') || url.startsWith('chrome:') || url.startsWith('javascript:')) return;

        const cleanTitle = (title && title.trim()) ? title.trim() : url;
        const now = Date.now();

        // Avoid spamming consecutive duplicates within 2 minutes for the same URL
        const existingIdx = this.entries.findIndex(item => item.url === url);
        if (existingIdx === 0 && (now - this.entries[0].timestamp) < 120000) {
            this.entries[0].title = cleanTitle;
            this.entries[0].timestamp = now;
            this.saveHistory();
            if (this.isOpen()) this.render();
            return;
        }

        if (existingIdx >= 0) {
            this.entries.splice(existingIdx, 1);
        }

        this.entries.unshift({
            id: `${now}-${Math.random().toString(36).substr(2, 5)}`,
            url,
            title: cleanTitle,
            timestamp: now
        });

        if (this.entries.length > MAX_ENTRIES) {
            this.entries.length = MAX_ENTRIES;
        }

        this.saveHistory();
        if (this.isOpen()) this.render();
    }

    deleteEntry(id) {
        this.entries = this.entries.filter(e => e.id !== id);
        this.saveHistory();
        this.render();
    }

    clearHistory() {
        if (!this.entries.length) return;
        if (confirm('Are you sure you want to clear your entire browsing history?')) {
            this.entries = [];
            this.saveHistory();
            this.render();
        }
    }

    getEntries(filter = '') {
        const query = filter.trim().toLowerCase();
        if (!query) return this.entries;
        return this.entries.filter(e => 
            (e.title && e.title.toLowerCase().includes(query)) ||
            (e.url && e.url.toLowerCase().includes(query))
        );
    }

    init() {
        if (this.btnToggle) {
            this.btnToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        }

        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.close());
        }

        if (this.btnClear) {
            this.btnClear.addEventListener('click', () => this.clearHistory());
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

    _groupEntriesByDate(items) {
        const groups = {
            today: [],
            yesterday: [],
            older: []
        };

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfYesterday = startOfToday - 86400000;

        items.forEach(item => {
            if (item.timestamp >= startOfToday) {
                groups.today.push(item);
            } else if (item.timestamp >= startOfYesterday) {
                groups.yesterday.push(item);
            } else {
                groups.older.push(item);
            }
        });

        return groups;
    }

    _formatTime(timestamp) {
        const d = new Date(timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    _formatDate(timestamp) {
        const d = new Date(timestamp);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    render() {
        if (!this.listWrap) return;

        const filtered = this.getEntries(this.currentFilter);
        const recentlyClosed = (!this.currentFilter && this.getRecentlyClosed) ? this.getRecentlyClosed() : [];

        if (!filtered.length && !recentlyClosed.length) {
            this.listWrap.innerHTML = `
                <div class="panel-empty-state">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <h4>${this.currentFilter ? 'No matching history' : 'No browsing history yet'}</h4>
                    <p>${this.currentFilter ? 'Try searching for something else' : 'Pages you visit in Research Browser will appear here'}</p>
                </div>
            `;
            return;
        }

        let html = '';

        // 1. Recently Closed Section (if available)
        if (recentlyClosed.length > 0) {
            html += `
                <div class="panel-group-header">
                    <span>Recently Closed (${recentlyClosed.length})</span>
                </div>
                <div class="panel-items-sublist">
                    ${recentlyClosed.slice(-6).reverse().map(tab => `
                        <div class="history-item recent-closed-item" data-url="${escapeHtml(tab.url)}" title="Click to reopen">
                            <span class="history-item-icon">${getBrandIconHtml(tab.url, tab.title || tab.url, false)}</span>
                            <div class="history-item-details">
                                <span class="history-item-title">${escapeHtml(tab.title || tab.url)}</span>
                                <span class="history-item-url">${escapeHtml(tab.url)}</span>
                            </div>
                            <span class="history-item-badge">Closed</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // 2. Timeline Groups
        const groups = this._groupEntriesByDate(filtered);

        const renderGroup = (title, items, showDate = false) => {
            if (!items.length) return '';
            return `
                <div class="panel-group-header">
                    <span>${title}</span>
                </div>
                <div class="panel-items-sublist">
                    ${items.map(item => `
                        <div class="history-item" data-id="${item.id}" data-url="${escapeHtml(item.url)}" title="${escapeHtml(item.title)} (${escapeHtml(item.url)})">
                            <span class="history-item-icon">${getBrandIconHtml(item.url, item.title, false)}</span>
                            <div class="history-item-details">
                                <span class="history-item-title">${escapeHtml(item.title)}</span>
                                <span class="history-item-url">${escapeHtml(item.url)}</span>
                            </div>
                            <span class="history-item-time">${showDate ? this._formatDate(item.timestamp) : this._formatTime(item.timestamp)}</span>
                            <button class="history-item-delete" data-delete-id="${item.id}" title="Remove from history">✕</button>
                        </div>
                    `).join('')}
                </div>
            `;
        };

        html += renderGroup('Today', groups.today);
        html += renderGroup('Yesterday', groups.yesterday);
        html += renderGroup('Older', groups.older, true);

        this.listWrap.innerHTML = html;

        // Event delegation for items & delete buttons
        this.listWrap.querySelectorAll('.history-item').forEach(itemEl => {
            itemEl.addEventListener('click', (e) => {
                if (e.target.closest('.history-item-delete')) {
                    e.stopPropagation();
                    const deleteId = e.target.closest('.history-item-delete').getAttribute('data-delete-id');
                    this.deleteEntry(deleteId);
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
