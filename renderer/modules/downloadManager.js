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

    btnQuickDownload.addEventListener('click', () => {
        quickDlModal.style.display = 'flex';
        quickUrlInput.focus();
    });

    btnCloseModal.addEventListener('click', () => {
        quickDlModal.style.display = 'none';
    });

    btnModalCancel.addEventListener('click', () => {
        quickDlModal.style.display = 'none';
    });

    btnModalStart.addEventListener('click', () => {
        const url = quickUrlInput.value.trim();
        const fmt = quickFormatSelect.value;
        if (!url) return;
        quickDlModal.style.display = 'none';
        quickUrlInput.value = '';
        startDownloadTask(url, 'YouTube Video', fmt);
    });

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
        speed: '-- MB/s',
        eta: '--:--',
        status: 'starting'
    };

    state.activeDownloadsMap.set(downloadId, downloadObj);
    updateDownloadsBadge();
    renderDownloadCard(downloadObj);
    switchView('downloads');

    window.electronAPI.startDownload({
        downloadId,
        url,
        savePath: state.userSettings.savePath,
        formatPreset
    });
}

function renderDownloadCard(dl) {
    const downloadsList = document.getElementById('downloads-list');
    const downloadsEmpty = document.getElementById('downloads-empty');
    downloadsEmpty.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'download-card';
    card.id = `card-${dl.id}`;

    card.innerHTML = `
        <div class="dl-card-top">
            <span class="dl-card-title">${escapeHtml(dl.title)}</span>
            <span class="dl-card-badge" id="badge-${dl.id}">Starting...</span>
        </div>
        <div class="progress-track">
            <div class="progress-fill" id="fill-${dl.id}" style="width: 0%;"></div>
        </div>
        <div class="dl-stats-row">
            <span id="speed-${dl.id}">Speed: Starting...</span>
            <span id="size-${dl.id}">Format: ${dl.format}</span>
            <span id="eta-${dl.id}">ETA: --:--</span>
        </div>
        <div class="dl-actions" id="actions-${dl.id}" style="display: none; gap: 8px; margin-top: 8px;">
            <button class="btn-card-stream" id="btn-play-${dl.id}" style="padding: 5px 10px; font-size: 11px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Play Now
            </button>
            <button class="btn-open-folder" id="btn-finder-${dl.id}">${navigator.userAgent.includes('Mac') ? 'Reveal in Finder' : 'Show in Folder'}</button>
        </div>
    `;

    downloadsList.prepend(card);
}

function handleDownloadProgress(data) {
    const { downloadId, status, percent, totalSize, speed, eta, filePath, saveDir } = data;

    const badge = document.getElementById(`badge-${downloadId}`);
    const fill = document.getElementById(`fill-${downloadId}`);
    const speedEl = document.getElementById(`speed-${downloadId}`);
    const sizeEl = document.getElementById(`size-${downloadId}`);
    const etaEl = document.getElementById(`eta-${downloadId}`);
    const actionsEl = document.getElementById(`actions-${downloadId}`);
    const playBtn = document.getElementById(`btn-play-${downloadId}`);
    const finderBtn = document.getElementById(`btn-finder-${downloadId}`);

    if (status === 'downloading') {
        if (badge) badge.textContent = `${Math.round(percent)}%`;
        if (fill) fill.style.width = `${percent}%`;
        if (speedEl) speedEl.textContent = `Speed: ${speed}`;
        if (sizeEl && totalSize) sizeEl.textContent = `Total: ${totalSize}`;
        if (etaEl) etaEl.textContent = `ETA: ${eta}`;
    } else if (status === 'completed') {
        if (badge) {
            badge.textContent = 'Completed';
            badge.className = 'dl-card-badge completed';
        }
        if (fill) fill.style.width = '100%';
        if (speedEl) speedEl.textContent = 'Finished';
        if (etaEl) etaEl.textContent = 'Saved to Disk';
        if (actionsEl) actionsEl.style.display = 'flex';

        if (playBtn) {
            const resolvedPath = filePath || '';
            playBtn.addEventListener('click', () => {
                const fileName = resolvedPath ? resolvedPath.split(/[\/\\]/).pop() : 'Downloaded Video';
                playLocalVideo({
                    name: fileName,
                    fullPath: resolvedPath,
                    size: totalSize || 'Media File'
                });
            });
        }

        if (finderBtn) {
            finderBtn.addEventListener('click', () => {
                window.electronAPI.openInFinder(filePath || saveDir);
            });
        }

        state.activeDownloadsMap.delete(downloadId);
        updateDownloadsBadge();
    } else if (status === 'error') {
        if (badge) badge.textContent = 'Failed';
        state.activeDownloadsMap.delete(downloadId);
        updateDownloadsBadge();
    }
}

function updateDownloadsBadge() {
    const downloadsBadge = document.getElementById('downloads-badge');
    const count = state.activeDownloadsMap.size;
    if (count > 0) {
        downloadsBadge.style.display = 'block';
        downloadsBadge.textContent = count;
    } else {
        downloadsBadge.style.display = 'none';
    }
}
