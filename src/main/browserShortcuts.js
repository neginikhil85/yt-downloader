// Resolves keys pressed inside Research Browser web pages to browser actions,
// using the same table as the renderer (renderer/data/browserShortcuts.json).

const config = require('../../renderer/data/browserShortcuts.json');

const isMac = process.platform === 'darwin';
const normalizeKey = (key) => (key && key.length === 1 ? key.toUpperCase() : key);

function parseCombo(combo) {
    let key;
    let mods;
    if (combo.endsWith('++')) {
        key = '+';
        mods = combo.slice(0, -2);
    } else {
        const i = combo.lastIndexOf('+');
        key = i < 0 ? combo : combo.slice(i + 1);
        mods = i < 0 ? '' : combo.slice(0, i);
    }
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
for (const group of config.groups) {
    for (const sc of group.shortcuts) {
        for (const combo of sc.keys) bindings.push({ id: sc.id, hostOnly: !!sc.hostOnly, combo: parseCombo(combo) });
    }
}

/**
 * @param {Electron.Input} input from webContents 'before-input-event'
 * @returns {{id: string, key: string} | null}
 */
function resolvePageShortcut(input) {
    if (!input || input.type !== 'keyDown') return null;
    const key = normalizeKey(input.key);
    for (const b of bindings) {
        const c = b.combo;
        if (b.hostOnly) continue;
        if (c.key === key && c.ctrl === !!input.control && c.meta === !!input.meta &&
            c.shift === !!input.shift && c.alt === !!input.alt) {
            return { id: b.id, key: input.key };
        }
    }
    return null;
}

module.exports = { resolvePageShortcut };
