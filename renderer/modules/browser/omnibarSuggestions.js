// ==========================================================================
// YT Studio Pro — Omnibar Smart Suggestions & Autocomplete Dropdown
// ==========================================================================

import { escapeHtml } from '../utils.js';
import { getBrandIconHtml } from '../../data/brandIcons.js';
import { parseUrl } from './urlUtils.js';

export class OmnibarSuggestions {
    constructor({ input, container, historyManager, bookmarksManager, onNavigate, onCreateTab, onBeforeOpen }) {
        this.input = input;
        this.container = container;
        this.historyManager = historyManager;
        this.bookmarksManager = bookmarksManager;
        this.onNavigate = onNavigate || (() => {});
        this.onCreateTab = onCreateTab || (() => {});
        this.onBeforeOpen = onBeforeOpen || (() => {});

        this.selectedIndex = -1;
        this.suggestions = [];

        this.init();
    }

    init() {
        if (!this.input || !this.container) return;

        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('focus', () => {
            if (this.input.value.trim().length >= 2) {
                this.handleInput();
            }
        });

        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Close on blur, outside click, or webview focus
        document.addEventListener('click', (e) => {
            if (!this.isOpen()) return;
            if (!this.container.contains(e.target) && e.target !== this.input) {
                this.close();
            }
        });
        document.addEventListener('focusin', (e) => {
            if (this.isOpen() && e.target && e.target.tagName === 'WEBVIEW') {
                this.close();
            }
        });
    }

    isOpen() {
        return this.container && this.container.style.display !== 'none';
    }

    close() {
        if (!this.container) return;
        this.container.style.display = 'none';
        this.selectedIndex = -1;
        this.suggestions = [];
    }

    handleInput() {
        const query = this.input.value.trim();
        if (!query || query.length < 1) {
            this.close();
            return;
        }

        this.generateSuggestions(query);
    }

    generateSuggestions(query) {
        const list = [];
        const qLower = query.toLowerCase();

        // 1. Check if it's already a full/direct URL
        const isUrlLike = qLower.includes('.') || qLower.startsWith('http://') || qLower.startsWith('https://') || qLower.startsWith('localhost');
        if (isUrlLike) {
            const parsed = parseUrl(query);
            list.push({
                type: 'direct',
                title: parsed,
                url: parsed,
                badge: 'Open URL',
                icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>'
            });
        }

        // 2. Query Bookmarks
        if (this.bookmarksManager) {
            const bMatches = this.bookmarksManager.getBookmarks(query).slice(0, 3);
            bMatches.forEach(b => {
                list.push({
                    type: 'bookmark',
                    title: b.name || b.title || b.url,
                    url: b.url,
                    badge: 'Bookmark',
                    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
                });
            });
        }

        // 3. Query History
        if (this.historyManager) {
            const hMatches = this.historyManager.getEntries(query);
            // Deduplicate with bookmarks
            hMatches.forEach(h => {
                if (list.length >= 7) return;
                const alreadyPresent = list.some(item => item.url.toLowerCase() === h.url.toLowerCase());
                if (!alreadyPresent) {
                    list.push({
                        type: 'history',
                        title: h.title || h.url,
                        url: h.url,
                        badge: 'History',
                        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
                    });
                }
            });
        }

        // 4. Default Search Query Row
        list.push({
            type: 'search',
            title: query,
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            badge: 'Google Search',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
        });

        this.suggestions = list;
        this.selectedIndex = -1;
        this.render();
    }

    render() {
        if (!this.suggestions.length) {
            this.close();
            return;
        }

        this.container.innerHTML = this.suggestions.map((item, idx) => `
            <div class="omnibar-suggestion-item ${idx === this.selectedIndex ? 'selected' : ''}" data-index="${idx}">
                <span class="suggestion-icon">${item.icon}</span>
                <div class="suggestion-text">
                    <span class="suggestion-title">${escapeHtml(item.title)}</span>
                    ${item.type !== 'search' ? `<span class="suggestion-url">${escapeHtml(item.url)}</span>` : ''}
                </div>
                <span class="suggestion-badge badge-${item.type}">${item.badge}</span>
            </div>
        `).join('');

        if (this.onBeforeOpen) this.onBeforeOpen();
        this.container.style.display = 'block';

        this.container.querySelectorAll('.omnibar-suggestion-item').forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = parseInt(el.getAttribute('data-index'), 10);
                const item = this.suggestions[idx];
                if (!item) return;

                const isNewTab = e.metaKey || e.ctrlKey || e.button === 1;
                if (isNewTab) {
                    this.onCreateTab(item.url, true);
                } else {
                    this.onNavigate(item.url);
                }
                this.close();
            });
        });
    }

    handleKeydown(e) {
        if (!this.isOpen() || !this.suggestions.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
            this.updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
            this.updateSelection();
        } else if (e.key === 'Enter') {
            if (this.selectedIndex >= 0 && this.selectedIndex < this.suggestions.length) {
                e.preventDefault();
                const item = this.suggestions[this.selectedIndex];
                const isNewTab = e.metaKey || e.ctrlKey;
                if (isNewTab) {
                    this.onCreateTab(item.url, true);
                } else {
                    this.onNavigate(item.url);
                }
                this.close();
            }
        } else if (e.key === 'Escape') {
            this.close();
        }
    }

    updateSelection() {
        const items = this.container.querySelectorAll('.omnibar-suggestion-item');
        items.forEach((item, idx) => {
            if (idx === this.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }
}
