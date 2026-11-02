// ==========================================================================
// YT Studio Pro — Research Browser Downloads (Chrome-style toolbar button + panel)
//
// Shows every file downloaded from a browser tab: live progress, speed and
// time left, pause / resume / cancel, failures with retry, and quick access
// to open the file or show it in its folder.
// ==========================================================================

import { escapeHtml } from '../utils.js';
import { shortcutHint } from './shortcuts.js';

const ACTIVE_STATES = new Set(['progressing', 'paused', 'interrupted']);
const AUTO_HIDE_MS = 4500;

const ICONS = {
    pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    resume: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    cancel: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    retry: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>',
    folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    remove: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

export function formatBytes(bytes) {
    if (!bytes || bytes < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

function formatEta(seconds) {
    if (!isFinite(seconds) || seconds <= 0) return '';
    if (seconds < 60) return `${Math.ceil(seconds)} s left`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)} min left`;
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h} h ${m} min left`;
}

function fileKind(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (/^(pdf)$/.test(ext)) return 'pdf';
    if (/^(zip|rar|7z|tar|gz|bz2|xz)$/.test(ext)) return 'archive';
    if (/^(png|jpe?g|gif|webp|svg|bmp|ico|avif|heic)$/.test(ext)) return 'image';
    if (/^(mp4|mkv|webm|mov|avi|m4v)$/.test(ext)) return 'video';
    if (/^(mp3|m4a|wav|ogg|flac|aac)$/.test(ext)) return 'audio';
    if (/^(exe|msi|dmg|pkg|deb|rpm|apk|appimage)$/.test(ext)) return 'app';
    if (/^(docx?|xlsx?|pptx?|odt|ods|csv|txt|rtf|md)$/.test(ext)) return 'doc';
    return 'file';
}

function statusText(rec) {
    const pct = rec.total > 0 ? Math.min(100, Math.round((rec.received / rec.total) * 100)) : null;
    const sizeOf = rec.total > 0 ? `${formatBytes(rec.received)} of ${formatBytes(rec.total)}` : formatBytes(rec.received);

    switch (rec.state) {
        case 'progressing': {
            const parts = [sizeOf];
            if (rec.speed > 0) {
                parts.push(`${formatBytes(rec.speed)}/s`);
                if (rec.total > 0) parts.push(formatEta((rec.total - rec.received) / rec.speed));
            } else if (pct === null) {
                parts.push('Starting…');
            }
            return parts.filter(Boolean).join(' · ');
        }
        case 'paused':
            return `Paused · ${sizeOf}`;
        case 'interrupted':
            return `${rec.error || 'Interrupted'} · Resume to continue`;
        case 'completed':
            return rec.fileMissing ? 'Deleted or moved' : `Done · ${formatBytes(rec.total || rec.received)}`;
        case 'cancelled':
            return 'Cancelled';
        case 'failed':
            return rec.error || 'Failed';
        default:
            return '';
    }
}

function actionButtons(rec) {
    const btn = (action, title, extraClass = '') =>
        `<button class="dl-action ${extraClass}" data-action="${action}" title="${title}">${ICONS[action]}</button>`;

    switch (rec.state) {
        case 'progressing':
            return btn('pause', 'Pause') + btn('cancel', 'Cancel', 'danger');
        case 'paused':
        case 'interrupted':
            return btn('resume', 'Resume') + btn('cancel', 'Cancel', 'danger');
        case 'completed':
            return rec.fileMissing
                ? btn('retry', 'Download again') + btn('remove', 'Remove from list')
                : btn('folder', 'Show in folder') + btn('remove', 'Remove from list');
        default:
            return btn('retry', 'Retry download') + btn('remove', 'Remove from list');
    }
}

export class DownloadsPanel {
    constructor({ button, panel }) {
        this.button = button;
        this.panel = panel;
        this.api = window.electronAPI && window.electronAPI.browserDownloads;
        this.records = new Map();
        this.autoHideTimer = null;
        this.flashTimer = null;
        this.hasUnseenFailure = false;

        if (!this.button || !this.panel || !this.api) return;

        this.list = this.panel.querySelector('.dl-list');
        this.ringFill = this.button.querySelector('.dl-ring-fill');

        const hint = shortcutHint('downloads');
        this.button.title = `Downloads${hint ? ` (${hint})` : ''}`;

        this.bindEvents();
        this.api.list().then((records) => {
            (records || []).forEach(rec => this.records.set(rec.id, rec));
            this.render();
        }).catch(() => {});

        this.api.onUpdated((rec) => this.onUpdated(rec));
        this.api.onRemoved((id) => {
            this.records.delete(id);
            this.render();
        });
    }

    bindEvents() {
        this.button.addEventListener('click', () => this.toggle());

        this.panel.addEventListener('mouseenter', () => this.cancelAutoHide());

        this.panel.addEventListener('click', (e) => {
            const header = e.target.closest('[data-panel-action]');
            if (header) {
                const action = header.dataset.panelAction;
                if (action === 'open-folder') this.api.openFolder();
                if (action === 'clear') this.api.clear().then(list => this.replaceAll(list));
                if (action === 'close') this.close();
                return;
            }

            const item = e.target.closest('.dl-item');
            if (!item) return;
            const id = item.dataset.id;
            const actionBtn = e.target.closest('[data-action]');

            if (!actionBtn) {
                const rec = this.records.get(id);
                if (rec && rec.state === 'completed' && !rec.fileMissing) this.openFile(id);
                return;
            }

            switch (actionBtn.dataset.action) {
                case 'pause': this.api.pause(id); break;
                case 'resume': this.api.resume(id); break;
                case 'cancel': this.api.cancel(id); break;
                case 'retry': this.api.retry(id); break;
                case 'remove': this.api.remove(id); break;
                case 'folder': this.api.show(id); break;
            }
        });

        // Close on outside click — including clicks into a web page, which the
        // host document only sees as focus moving onto the <webview>.
        document.addEventListener('mousedown', (e) => {
            if (!this.isOpen()) return;
            if (this.panel.contains(e.target) || this.button.contains(e.target)) return;
            this.close();
        });
        document.addEventListener('focusin', (e) => {
            if (this.isOpen() && e.target && e.target.tagName === 'WEBVIEW') this.close();
        });
    }

    async openFile(id) {
        const res = await this.api.open(id);
        if (res && !res.success) {
            const rec = this.records.get(id);
            if (rec) {
                rec.fileMissing = true;
                this.render();
            }
        }
    }

    replaceAll(list) {
        this.records.clear();
        (list || []).forEach(rec => this.records.set(rec.id, rec));
        this.render();
    }

    onUpdated(rec) {
        const prev = this.records.get(rec.id);
        this.records.set(rec.id, rec);

        const stateChanged = !prev || prev.state !== rec.state;
        const isFailure = rec.state === 'failed' || rec.state === 'interrupted';

        if (rec.isNew) {
            this.pulse('started');
            this.open({ autoHide: true });
        } else if (stateChanged && rec.state === 'completed') {
            this.pulse('done');
            if (this.isOpen() && this.autoHideTimer) this.scheduleAutoHide();
        } else if (stateChanged && isFailure) {
            this.hasUnseenFailure = true;
            this.open({ autoHide: true });
        }

        this.render();
    }

    pulse(kind) {
        clearTimeout(this.flashTimer);
        this.button.classList.remove('dl-pulse-started', 'dl-pulse-done');
        void this.button.offsetWidth;
        this.button.classList.add(`dl-pulse-${kind}`);
        this.flashTimer = setTimeout(() => this.button.classList.remove(`dl-pulse-${kind}`), 1600);
    }

    sorted() {
        return [...this.records.values()].sort((a, b) => b.startTime - a.startTime);
    }

    render() {
        this.renderButton();
        if (!this.list) return;

        const records = this.sorted();
        if (!records.length) {
            this.list.innerHTML = `
                <div class="dl-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
                    <div>No downloads yet</div>
                    <small>Files you download in the browser appear here. You'll choose where to save each one.</small>
                </div>`;
            return;
        }

        this.list.innerHTML = records.map((rec) => {
            const pct = rec.total > 0 ? Math.min(100, (rec.received / rec.total) * 100) : 0;
            const showBar = ACTIVE_STATES.has(rec.state);
            const indeterminate = showBar && !(rec.total > 0);
            const kind = fileKind(rec.filename);
            const ext = (rec.filename.includes('.') ? rec.filename.split('.').pop() : 'FILE').slice(0, 4).toUpperCase();
            const stateClass = rec.fileMissing ? 'state-missing' : `state-${rec.state}`;
            const clickable = rec.state === 'completed' && !rec.fileMissing;

            return `
                <div class="dl-item ${stateClass} ${clickable ? 'clickable' : ''}" data-id="${escapeHtml(rec.id)}"
                     title="${escapeHtml(rec.savePath || rec.url)}${clickable ? '\nClick to open' : ''}">
                    <div class="dl-icon kind-${kind}">${escapeHtml(ext)}</div>
                    <div class="dl-main">
                        <div class="dl-name">${escapeHtml(rec.filename)}</div>
                        ${showBar ? `<div class="dl-bar ${indeterminate ? 'indeterminate' : ''}"><div class="dl-bar-fill" style="width:${indeterminate ? 30 : pct}%"></div></div>` : ''}
                        <div class="dl-status">${escapeHtml(statusText(rec))}</div>
                    </div>
                    <div class="dl-actions">${actionButtons(rec)}</div>
                </div>`;
        }).join('');
    }

    renderButton() {
        const active = [...this.records.values()].filter(r => r.state === 'progressing' || r.state === 'paused');
        const total = active.reduce((s, r) => s + (r.total > 0 ? r.total : 0), 0);
        const received = active.reduce((s, r) => s + (r.total > 0 ? r.received : 0), 0);

        this.button.classList.toggle('dl-active', active.length > 0);
        this.button.classList.toggle('dl-indeterminate', active.length > 0 && total === 0);
        this.button.classList.toggle('dl-has-error', this.hasUnseenFailure);

        if (this.ringFill) {
            const fraction = total > 0 ? received / total : 0;
            this.ringFill.style.strokeDashoffset = String(100 - fraction * 100);
        }
    }

    isOpen() {
        return this.panel.style.display !== 'none';
    }

    position() {
        const parent = this.panel.offsetParent;
        if (!parent) return;
        const btn = this.button.getBoundingClientRect();
        const box = parent.getBoundingClientRect();
        this.panel.style.top = `${btn.bottom - box.top + 6}px`;
        this.panel.style.right = `${Math.max(8, box.right - btn.right)}px`;
    }

    open({ autoHide = false } = {}) {
        const wasOpen = this.isOpen();
        this.panel.style.display = 'flex';
        this.position();
        // Only count the failure as "seen" if the panel is actually on screen
        // (the browser view may be hidden behind another app section).
        if (!autoHide || this.panel.offsetParent) this.hasUnseenFailure = false;
        this.renderButton();

        if (autoHide && (!wasOpen || this.autoHideTimer)) this.scheduleAutoHide();
        else if (!autoHide) this.cancelAutoHide();
    }

    scheduleAutoHide() {
        this.cancelAutoHide();
        this.autoHideTimer = setTimeout(() => {
            this.autoHideTimer = null;
            if (!this.panel.matches(':hover')) this.close();
        }, AUTO_HIDE_MS);
    }

    cancelAutoHide() {
        clearTimeout(this.autoHideTimer);
        this.autoHideTimer = null;
    }

    close() {
        this.cancelAutoHide();
        this.panel.style.display = 'none';
    }

    toggle() {
        if (this.isOpen() && !this.autoHideTimer) this.close();
        else this.open();
    }
}
