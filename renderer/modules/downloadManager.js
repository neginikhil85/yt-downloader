import { escapeHtml } from './utils.js';
import { state } from './state.js';
import { switchView } from './navigation.js';
import { playLocalVideo } from './videoPlayer.js';

export function initDownloadManager() {
    const btnQuickDownload = document.getElementById('btn-quick-download');
    const quickDlModal = document.getElementById('quick-dl-modal');
    const quickUrlInput = document.getElementById('quick-url-input');
    const quickFormatSelect = document.getElementById('quick-format-select');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalStart = document.getElementById('btn-modal-start');
    const btnClearCompleted = document.getElementById('btn-clear-completed');

    if (btnQuickDownload && quickDlModal) {
        btnQuickDownload.addEventListener('click', () => {
            quickDlModal.style.display = 'flex';
            if (quickUrlInput) quickUrlInput.focus();
        });
    }

    if (btnCloseModal && quickDlModal) {
        btnCloseModal.addEventListener('click', () => {
            quickDlModal.style.display = 'none';
        });
    }

    if (btnModalCancel && quickDlModal) {
        btnModalCancel.addEventListener('click', () => {
            quickDlModal.style.display = 'none';
        });
    }

    if (btnModalStart && quickDlModal) {
        btnModalStart.addEventListener('click', () => {
            const url = quickUrlInput.value.trim();
            const fmt = quickFormatSelect.value;
            if (!url) return;
            quickDlModal.style.display = 'none';
            quickUrlInput.value = '';
            startDownloadTask(url, 'YouTube Video', fmt);
        });
    }

    if (btnClearCompleted) {
        btnClearCompleted.addEventListener('click', () => {
            clearCompletedDownloads();
        });
    }

    window.electronAPI.onDownloadProgress(handleDownloadProgress);
}

export function startDownloadTask(url, title, formatPreset = '1080p') {
    const downloadId = 'dl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const downloadObj = {
        id: downloadId,
        url,
        title: title || 'YouTube Video',
        format: formatPreset,
        percent: 0,
        speed: 'Connecting...',
        eta: '--:--',
        totalSize: '',
        status: 'downloading',
        filePath: '',
        saveDir: state.userSettings?.savePath || ''
    };

    state.activeDownloadsMap.set(downloadId, downloadObj);
    updateDownloadsBadge();
    renderDownloadCard(downloadObj);
    switchView('downloads');

    window.electronAPI.startDownload({
        downloadId,
        url,
        savePath: state.userSettings?.savePath,
        formatPreset
    });
}

function renderDownloadCard(dl) {
    const downloadsList = document.getElementById('downloads-list');
    const downloadsEmpty = document.getElementById('downloads-empty');
    if (downloadsEmpty) downloadsEmpty.style.display = 'none';

    // Remove existing card if re-rendering
    const existing = document.getElementById(`card-${dl.id}`);
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.className = 'download-card';
    card.id = `card-${dl.id}`;

    card.innerHTML = `
        <div class="dl-card-top">
            <span class="dl-card-title" title="${escapeHtml(dl.title)}">${escapeHtml(dl.title)}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="dl-card-badge" id="badge-${dl.id}">Starting...</span>
            </div>
        </div>
        <div class="progress-track">
            <div class="progress-fill" id="fill-${dl.id}" style="width: ${dl.percent || 0}%;"></div>
        </div>
        <div class="dl-stats-row">
            <span id="speed-${dl.id}">${dl.speed || 'Connecting...'}</span>
            <span id="size-${dl.id}">Format: ${dl.format}</span>
            <span id="eta-${dl.id}">ETA: ${dl.eta || '--:--'}</span>
        </div>
        <div class="dl-actions" id="actions-${dl.id}">
            <!-- Active downloading actions -->
            <button class="btn-card-action" id="btn-pause-${dl.id}" title="Pause download">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                Pause
            </button>
            <button class="btn-card-action" id="btn-resume-${dl.id}" style="display: none;" title="Resume download">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
                Resume
            </button>
            <button class="btn-card-action ghost" id="btn-cancel-${dl.id}" title="Cancel download">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Cancel
            </button>
            <button class="btn-card-action" id="btn-retry-${dl.id}" style="display: none;" title="Retry download">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                Retry
            </button>

            <!-- Completed Actions -->
            <button class="btn-card-action primary" id="btn-play-${dl.id}" style="display: none;" title="Play video">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
                Play Video
            </button>
            <button class="btn-card-action" id="btn-finder-${dl.id}" style="display: none;" title="Show in folder">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                ${navigator.userAgent.includes('Mac') ? 'Reveal in Finder' : 'Show in Folder'}
            </button>
            <button class="btn-card-action ghost" id="btn-delete-${dl.id}" style="display: none;" title="Delete item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Delete
            </button>
        </div>
    `;

    downloadsList.prepend(card);
    attachCardListeners(dl);
}

function attachCardListeners(dl) {
    const pauseBtn = document.getElementById(`btn-pause-${dl.id}`);
    const resumeBtn = document.getElementById(`btn-resume-${dl.id}`);
    const cancelBtn = document.getElementById(`btn-cancel-${dl.id}`);
    const retryBtn = document.getElementById(`btn-retry-${dl.id}`);
    const playBtn = document.getElementById(`btn-play-${dl.id}`);
    const finderBtn = document.getElementById(`btn-finder-${dl.id}`);
    const deleteBtn = document.getElementById(`btn-delete-${dl.id}`);

    if (pauseBtn) {
        pauseBtn.addEventListener('click', async () => {
            await window.electronAPI.pauseDownload(dl.id);
            dl.status = 'paused';
            updateCardState(dl);
        });
    }

    if (resumeBtn) {
        resumeBtn.addEventListener('click', async () => {
            dl.status = 'downloading';
            updateCardState(dl);
            await window.electronAPI.startDownload({
                downloadId: dl.id,
                url: dl.url,
                savePath: state.userSettings?.savePath || dl.saveDir,
                formatPreset: dl.format
            });
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            await window.electronAPI.cancelDownload(dl.id);
            dl.status = 'cancelled';
            updateCardState(dl);
        });
    }

    if (retryBtn) {
        retryBtn.addEventListener('click', async () => {
            dl.status = 'downloading';
            dl.percent = 0;
            updateCardState(dl);
            await window.electronAPI.startDownload({
                downloadId: dl.id,
                url: dl.url,
                savePath: state.userSettings?.savePath || dl.saveDir,
                formatPreset: dl.format
            });
        });
    }

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            const resolvedPath = dl.filePath || '';
            const fileName = resolvedPath ? resolvedPath.split(/[\/\\]/).pop() : dl.title;
            playLocalVideo({
                name: fileName,
                fullPath: resolvedPath,
                size: dl.totalSize || 'Media File'
            });
        });
    }

    if (finderBtn) {
        finderBtn.addEventListener('click', () => {
            window.electronAPI.openInFinder(dl.filePath || dl.saveDir);
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (dl.filePath) {
                const shouldDeleteFile = confirm(`Delete "${dl.title}" file from your hard drive too?`);
                if (shouldDeleteFile) {
                    await window.electronAPI.deleteDownloadFile(dl.filePath);
                }
            }
            removeDownloadCard(dl.id);
        });
    }
}

function updateCardState(dl) {
    const badge = document.getElementById(`badge-${dl.id}`);
    const fill = document.getElementById(`fill-${dl.id}`);
    const speedEl = document.getElementById(`speed-${dl.id}`);
    const etaEl = document.getElementById(`eta-${dl.id}`);
    const pauseBtn = document.getElementById(`btn-pause-${dl.id}`);
    const resumeBtn = document.getElementById(`btn-resume-${dl.id}`);
    const cancelBtn = document.getElementById(`btn-cancel-${dl.id}`);
    const retryBtn = document.getElementById(`btn-retry-${dl.id}`);
    const playBtn = document.getElementById(`btn-play-${dl.id}`);
    const finderBtn = document.getElementById(`btn-finder-${dl.id}`);
    const deleteBtn = document.getElementById(`btn-delete-${dl.id}`);

    if (!badge) return;

    if (dl.status === 'downloading') {
        badge.textContent = `${Math.round(dl.percent || 0)}%`;
        badge.className = 'dl-card-badge';
        if (fill) {
            fill.className = 'progress-fill';
            fill.style.width = `${dl.percent || 0}%`;
        }
        if (pauseBtn) pauseBtn.style.display = 'inline-flex';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        if (retryBtn) retryBtn.style.display = 'none';
        if (playBtn) playBtn.style.display = 'none';
        if (finderBtn) finderBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
    } else if (dl.status === 'paused') {
        badge.textContent = 'Paused';
        badge.className = 'dl-card-badge paused';
        if (fill) fill.className = 'progress-fill paused';
        if (speedEl) speedEl.textContent = 'Paused';
        if (etaEl) etaEl.textContent = 'Waiting to resume';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'inline-flex';
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        if (retryBtn) retryBtn.style.display = 'none';
        if (playBtn) playBtn.style.display = 'none';
        if (finderBtn) finderBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else if (dl.status === 'completed') {
        badge.textContent = 'Completed';
        badge.className = 'dl-card-badge completed';
        if (fill) {
            fill.className = 'progress-fill';
            fill.style.width = '100%';
        }
        if (speedEl) speedEl.textContent = 'Finished';
        if (etaEl) etaEl.textContent = 'Saved to Disk';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (retryBtn) retryBtn.style.display = 'none';
        if (playBtn) playBtn.style.display = 'inline-flex';
        if (finderBtn) finderBtn.style.display = 'inline-flex';
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else if (dl.status === 'cancelled') {
        badge.textContent = 'Cancelled';
        badge.className = 'dl-card-badge cancelled';
        if (speedEl) speedEl.textContent = 'Cancelled';
        if (etaEl) etaEl.textContent = '--';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (retryBtn) retryBtn.style.display = 'inline-flex';
        if (playBtn) playBtn.style.display = 'none';
        if (finderBtn) finderBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else if (dl.status === 'error') {
        badge.textContent = 'Failed';
        badge.className = 'dl-card-badge error';
        if (speedEl) speedEl.textContent = 'Error occurred';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (retryBtn) retryBtn.style.display = 'inline-flex';
        if (playBtn) playBtn.style.display = 'none';
        if (finderBtn) finderBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    }

    updateClearButtonVisibility();
}

function handleDownloadProgress(data) {
    const { downloadId, status, percent, totalSize, speed, eta, filePath, saveDir } = data;

    let dl = state.activeDownloadsMap.get(downloadId);
    if (!dl) {
        dl = {
            id: downloadId,
            title: 'YouTube Video',
            format: '1080p',
            percent: 0,
            status: 'downloading'
        };
        state.activeDownloadsMap.set(downloadId, dl);
        renderDownloadCard(dl);
    }

    dl.status = status;
    if (percent !== undefined) dl.percent = percent;
    if (totalSize) dl.totalSize = totalSize;
    if (speed) dl.speed = speed;
    if (eta) dl.eta = eta;
    if (filePath) dl.filePath = filePath;
    if (saveDir) dl.saveDir = saveDir;

    const speedEl = document.getElementById(`speed-${downloadId}`);
    const sizeEl = document.getElementById(`size-${downloadId}`);
    const etaEl = document.getElementById(`eta-${downloadId}`);

    if (status === 'downloading') {
        if (speedEl && speed) speedEl.textContent = `Speed: ${speed}`;
        if (sizeEl && totalSize) sizeEl.textContent = `Total: ${totalSize}`;
        if (etaEl && eta) etaEl.textContent = `ETA: ${eta}`;
    }

    updateCardState(dl);
    updateDownloadsBadge();
}

function removeDownloadCard(downloadId) {
    const card = document.getElementById(`card-${downloadId}`);
    if (card) card.remove();
    state.activeDownloadsMap.delete(downloadId);
    updateDownloadsBadge();
    updateClearButtonVisibility();

    const downloadsList = document.getElementById('downloads-list');
    const downloadsEmpty = document.getElementById('downloads-empty');
    if (downloadsList && downloadsEmpty) {
        const remainingCards = downloadsList.querySelectorAll('.download-card');
        if (remainingCards.length === 0) {
            downloadsEmpty.style.display = 'flex';
        }
    }
}

function clearCompletedDownloads() {
    const toRemove = [];
    state.activeDownloadsMap.forEach((dl, id) => {
        if (dl.status === 'completed' || dl.status === 'cancelled' || dl.status === 'error') {
            toRemove.push(id);
        }
    });

    toRemove.forEach((id) => {
        removeDownloadCard(id);
    });
}

function updateClearButtonVisibility() {
    const btnClearCompleted = document.getElementById('btn-clear-completed');
    if (!btnClearCompleted) return;

    let hasFinishedItems = false;
    state.activeDownloadsMap.forEach((dl) => {
        if (dl.status === 'completed' || dl.status === 'cancelled' || dl.status === 'error') {
            hasFinishedItems = true;
        }
    });

    btnClearCompleted.style.display = hasFinishedItems ? 'inline-flex' : 'none';
}

function updateDownloadsBadge() {
    const downloadsBadge = document.getElementById('downloads-badge');
    if (!downloadsBadge) return;

    let activeCount = 0;
    state.activeDownloadsMap.forEach((dl) => {
        if (dl.status === 'downloading' || dl.status === 'starting') {
            activeCount++;
        }
    });

    if (activeCount > 0) {
        downloadsBadge.style.display = 'block';
        downloadsBadge.textContent = activeCount;
    } else {
        downloadsBadge.style.display = 'none';
    }
}
