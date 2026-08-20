// ==========================================================================
// YT Studio Pro — Browser Theme Studio & Real-Time Engine
// ==========================================================================

import { BROWSER_THEMES } from '../../data/browserThemes.js';

export class ThemeStudio {
    constructor({ browserPanel, extThemesGrid, themeCatPills }) {
        this.browserPanel = browserPanel;
        this.extThemesGrid = extThemesGrid;
        this.themeCatPills = themeCatPills || [];
        this.currentThemeFilter = 'all';

        this.init();
    }

    init() {
        const savedTheme = localStorage.getItem('yt_browser_theme') || 'obsidian';
        this.applyTheme(savedTheme);

        if (this.themeCatPills) {
            this.themeCatPills.forEach(pill => {
                pill.addEventListener('click', () => {
                    this.themeCatPills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    this.currentThemeFilter = pill.getAttribute('data-theme-cat') || 'all';
                    this.render();
                });
            });
        }
    }

    applyTheme(themeKey) {
        if (!this.browserPanel) return;
        this.browserPanel.setAttribute('data-browser-theme', themeKey);
        localStorage.setItem('yt_browser_theme', themeKey);
        this.render();
    }

    render() {
        if (!this.extThemesGrid) return;
        const current = this.browserPanel?.getAttribute('data-browser-theme') || 'obsidian';
        const filtered = BROWSER_THEMES.filter(theme => {
            if (this.currentThemeFilter === 'all') return true;
            return theme.category === this.currentThemeFilter;
        });

        this.extThemesGrid.innerHTML = filtered.map(theme => {
            const isActive = theme.key === current;
            const p = theme.preview || {
                headerBg: '#14171f',
                tabActive: '#1e232e',
                tabText: '#f1f5f9',
                omnibarBg: 'rgba(255,255,255,0.06)',
                canvasBg: '#0c0e12',
                accent: '#3b82f6'
            };

            return `
                <div class="ext-theme-card ${isActive ? 'active' : ''}" data-theme="${theme.key}">
                    <div class="mini-browser-mockup">
                        <div class="mini-browser-titlebar" style="background: ${p.headerBg};">
                            <div class="mini-browser-traffic-lights">
                                <span class="mini-dot red"></span>
                                <span class="mini-dot yellow"></span>
                                <span class="mini-dot green"></span>
                            </div>
                            <div class="mini-browser-mini-tab" style="background: ${p.tabActive}; color: ${p.tabText};">
                                Tab
                            </div>
                            <div class="mini-browser-mini-omnibar" style="background: ${p.omnibarBg};">
                                <div class="mini-omnibar-pill" style="background: ${p.accent};"></div>
                            </div>
                        </div>
                        <div class="mini-browser-canvas" style="background: ${p.canvasBg};">
                            <div class="mini-canvas-search" style="background: ${p.omnibarBg}; border-color: ${p.accent}40;">
                                <div class="mini-canvas-dot" style="background: ${p.accent};"></div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div class="ext-theme-title-row">
                            <h5 class="ext-theme-name">${theme.name}</h5>
                            <span class="ext-theme-badge" style="color: ${p.accent};">${isActive ? 'Active ✓' : theme.badge}</span>
                        </div>
                        <p class="ext-theme-desc">${theme.desc}</p>
                    </div>
                </div>
            `;
        }).join('');

        this.extThemesGrid.querySelectorAll('.ext-theme-card').forEach(card => {
            card.addEventListener('click', () => {
                const k = card.getAttribute('data-theme');
                if (k) this.applyTheme(k);
            });
        });
    }
}
