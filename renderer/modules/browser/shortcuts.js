// ==========================================================================
// YT Studio Pro — Research Browser keyboard shortcuts
// Shared key table: ../../data/browserShortcuts.json (also used by main.js).
// ==========================================================================

import config from '../../data/browserShortcuts.json' with { type: 'json' };

const isMac = /Mac/i.test(navigator.platform || navigator.userAgent || '');
const normalizeKey = (key) => (key && key.length === 1 ? key.toUpperCase() : key);

export const SHORTCUT_GROUPS = config.groups;

function splitCombo(combo) {
    if (combo.endsWith('++')) return { mods: combo.slice(0, -2), key: '+' };
    const i = combo.lastIndexOf('+');
    return i < 0 ? { mods: '', key: combo } : { mods: combo.slice(0, i), key: combo.slice(i + 1) };
}

function parseCombo(combo) {
    const { mods, key } = splitCombo(combo);
    const set = new Set(mods ? mods.split('+') : []);
    return {
        key: normalizeKey(key),
        ctrl: set.has('Ctrl') || (set.has('Mod') && !isMac),
        meta: set.has('Meta') || (set.has('Mod') && isMac),
        shift: set.has('Shift'),
        alt: set.has('Alt')
    };
}

const bindings = [];
for (const group of SHORTCUT_GROUPS) {
    for (const sc of group.shortcuts) {
        for (const combo of sc.keys) bindings.push({ id: sc.id, combo: parseCombo(combo) });
    }
}

/** Maps a KeyboardEvent to a shortcut action id (or null). */
export function resolveShortcut(e) {
    const key = normalizeKey(e.key);
    const hit = bindings.find(({ combo: c }) =>
        c.key === key && c.ctrl === e.ctrlKey && c.meta === e.metaKey &&
        c.shift === e.shiftKey && c.alt === e.altKey);
    return hit ? hit.id : null;
}

const KEY_LABELS = isMac
    ? { Mod: '⌘', Ctrl: '⌃', Shift: '⇧', Alt: '⌥', Meta: '⌘' }
    : { Mod: 'Ctrl', Ctrl: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Meta: 'Win' };
const NAMED_KEYS = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    PageUp: 'PgUp', PageDown: 'PgDn', Escape: 'Esc', '=': '+'
};

/** "Mod+Shift+T" -> "Ctrl+Shift+T" (Windows) or "⌘⇧T" (macOS). */
export function formatCombo(combo) {
    const { mods, key } = splitCombo(combo);
    const parts = (mods ? mods.split('+') : []).map(m => KEY_LABELS[m] || m);
    parts.push(NAMED_KEYS[key] || (key.length === 1 ? key.toUpperCase() : key));
    return parts.join(isMac ? '' : '+');
}

/** Label for tooltips, e.g. shortcutHint('reload') -> "Ctrl+R". */
export function shortcutHint(id) {
    for (const group of SHORTCUT_GROUPS) {
        const sc = group.shortcuts.find(s => s.id === id);
        if (sc) return formatCombo(sc.keys[0]);
    }
    return '';
}

/** Modal listing every shortcut; toggled with Mod+/. */
export class ShortcutsHelp {
    constructor(overlayEl) {
        this.overlay = overlayEl;
        if (!this.overlay) return;
        this.render();
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay || e.target.closest('[data-close-shortcuts]')) this.close();
        });
    }

    render() {
        const grid = this.overlay.querySelector('.shortcuts-grid');
        if (!grid) return;
        grid.innerHTML = SHORTCUT_GROUPS.map(group => `
            <section class="shortcuts-group">
                <h4>${group.title}</h4>
                ${group.shortcuts.filter(sc => !sc.hidden).map(sc => {
                    const combos = sc.display || sc.keys.slice(0, 2);
                    const sep = sc.display ? '/' : 'or';
                    const chips = combos.map(c => `<kbd>${formatCombo(c)}</kbd>`).join(`<span class="shortcut-or">${sep}</span>`);
                    return `<div class="shortcut-row"><span>${sc.label}</span><span class="shortcut-keys">${chips}</span></div>`;
                }).join('')}
            </section>
        `).join('');
    }

    isOpen() {
        return !!this.overlay && this.overlay.style.display !== 'none';
    }

    open() {
        if (this.overlay) this.overlay.style.display = 'flex';
    }

    close() {
        if (this.overlay) this.overlay.style.display = 'none';
    }

    toggle() {
        if (this.isOpen()) this.close();
        else this.open();
    }
}
