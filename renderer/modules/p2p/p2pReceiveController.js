// ==========================================================================
// YT Studio Pro — P2P Receiver Controller
// Token inspection, destination folder selection, and direct stream downloader
// ==========================================================================

import { playLocalVideo } from '../videoPlayer.js';

export function initP2PReceiveController() {
    const tokenInput = document.getElementById('toffee-receive-code-input');
    const btnPasteClipboard = document.getElementById('btn-paste-clipboard');
    const btnConnectCode = document.getElementById('btn-connect-code');
    const receiveError = document.getElementById('toffee-receive-error');

    // Token Preview & Destination Card Elements
    const previewCard = document.getElementById('ds-token-preview-card');
    const previewFilename = document.getElementById('ds-preview-filename');
    const previewFilesize = document.getElementById('ds-preview-filesize');
    const previewTypeIcon = document.getElementById('ds-preview-type-icon');
    const destPathLabel = document.getElementById('ds-receive-dest-path');
    const btnChangeDest = document.getElementById('btn-change-receive-dest');
    const btnStartDownload = document.getElementById('btn-start-receive-download');

    // Telemetry & Completion Elements
    const receiveProgressWrap = document.getElementById('toffee-receive-progress-wrap');
    const receiveFilename = document.getElementById('toffee-receive-filename');
    const receivePercent = document.getElementById('toffee-receive-percent');
    const receiveBar = document.getElementById('toffee-receive-bar');
    const receiveSpeed = document.getElementById('toffee-receive-speed');
    const receiveEta = document.getElementById('toffee-receive-eta');
    const receiveCompleteBox = document.getElementById('toffee-receive-complete-box');
    const savedPathLabel = document.getElementById('toffee-saved-path');
    const btnPlayReceived = document.getElementById('btn-play-received');
    const btnOpenReceivedFolder = document.getElementById('btn-open-received-folder');

    let inspectedSession = null;
    let selectedDestFolder = '';
    let currentLastReceivedFile = null;

    // Load initial default save folder
    if (window.electronAPI && window.electronAPI.getDefaultSavePath) {
        window.electronAPI.getDefaultSavePath().then(p => {
            if (p) {
                selectedDestFolder = p;
                if (destPathLabel) destPathLabel.textContent = p;
            }
        }).catch(() => {});
    }

    // Paste from Clipboard Button
    if (btnPasteClipboard) {
        btnPasteClipboard.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text && tokenInput) {
                    tokenInput.value = text.trim();
                    await handleInspectToken();
                }
            } catch (err) {
                showError('Could not read clipboard. Please paste manually.');
            }
        });
    }

    if (tokenInput) {
        tokenInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleInspectToken();
        });
    }

    if (btnConnectCode) {
        btnConnectCode.addEventListener('click', handleInspectToken);
    }

    // Change Destination Directory Picker
    if (btnChangeDest) {
        btnChangeDest.addEventListener('click', async () => {
            if (window.electronAPI && window.electronAPI.selectFolder) {
                try {
                    const chosen = await window.electronAPI.selectFolder();
                    if (chosen) {
                        selectedDestFolder = chosen;
                        if (destPathLabel) destPathLabel.textContent = chosen;
                    }
                } catch (e) {}
            }
        });
    }

    // Inspect Token & Show Confirmation Card
    async function handleInspectToken() {
        if (!tokenInput) return;
        const rawToken = tokenInput.value.trim();
        if (!rawToken) {
            showError('Please paste a valid connection token');
            return;
        }

        hideError();
        if (receiveCompleteBox) receiveCompleteBox.style.display = 'none';
        if (previewCard) previewCard.style.display = 'none';
        btnConnectCode.disabled = true;
        btnConnectCode.textContent = 'Inspecting...';

        try {
            // Check if it's a short 6-digit legacy PIN or full token
            if (/^\d{6}$/.test(rawToken)) {
                // Direct PIN connect
                await handleStartDownloadWithCode(rawToken);
                btnConnectCode.disabled = false;
                btnConnectCode.textContent = 'Inspect & Connect';
                return;
            }

            const res = await window.electronAPI.p2pInspectToken(rawToken);
            if (!res.success) {
                showError(res.error || 'Invalid or corrupted connection token');
                btnConnectCode.disabled = false;
                btnConnectCode.textContent = 'Inspect & Connect';
                return;
            }

            inspectedSession = {
                token: rawToken,
                file: res.file
            };

            // Populate preview card
            if (previewFilename) previewFilename.textContent = res.file.name;
            if (previewFilesize) previewFilesize.textContent = res.file.formattedSize;

            // Icon by extension
            const ext = (res.file.name.split('.').pop() || '').toLowerCase();
            if (previewTypeIcon) {
                if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) {
                    previewTypeIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
                } else if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) {
                    previewTypeIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
                } else {
                    previewTypeIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
                }
            }

            if (previewCard) previewCard.style.display = 'flex';
            btnConnectCode.disabled = false;
            btnConnectCode.textContent = 'Inspect & Connect';
        } catch (err) {
            showError(err.message);
            btnConnectCode.disabled = false;
            btnConnectCode.textContent = 'Inspect & Connect';
        }
    }

    // Start Download CTA from Preview Card
    if (btnStartDownload) {
        btnStartDownload.addEventListener('click', async () => {
            if (!inspectedSession) return;

            hideError();
            if (previewCard) previewCard.style.display = 'none';
            if (receiveProgressWrap) receiveProgressWrap.style.display = 'block';
            if (receiveFilename) receiveFilename.textContent = `Connecting to ${inspectedSession.file.name}...`;

            try {
                const res = await window.electronAPI.p2pReceiveToken({
                    token: inspectedSession.token,
                    targetDir: selectedDestFolder
                });

                if (!res.success) {
                    showError(res.error || 'Connection to sender failed');
                    if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
                    if (previewCard) previewCard.style.display = 'flex';
                }
            } catch (err) {
                showError(err.message);
                if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
                if (previewCard) previewCard.style.display = 'flex';
            }
        });
    }

    async function handleStartDownloadWithCode(code) {
        hideError();
        if (receiveProgressWrap) receiveProgressWrap.style.display = 'block';
        if (receiveFilename) receiveFilename.textContent = 'Resolving host...';

        try {
            const res = await window.electronAPI.p2pReceiveCode({
                code,
                targetDir: selectedDestFolder
            });
            if (!res.success) {
                showError(res.error || 'Connection failed');
                if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
            }
        } catch (err) {
            showError(err.message);
            if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
        }
    }

    function onReceiveProgress(data) {
        if (receiveProgressWrap) receiveProgressWrap.style.display = 'block';
        if (receiveFilename) receiveFilename.textContent = data.fileName;
        if (receivePercent) receivePercent.textContent = `${Math.round(data.progress)}%`;
        if (receiveBar) receiveBar.style.width = `${data.progress}%`;
        if (receiveSpeed) receiveSpeed.textContent = `${data.speedMBps} MB/s`;
        if (receiveEta) receiveEta.textContent = `${data.etaSeconds}s remaining`;
    }

    function onReceiveComplete(data) {
        currentLastReceivedFile = data.filePath;
        inspectedSession = null;
        if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
        if (previewCard) previewCard.style.display = 'none';
        if (receiveCompleteBox) receiveCompleteBox.style.display = 'flex';
        if (savedPathLabel) savedPathLabel.textContent = `Saved to: ${data.filePath}`;
    }

    function onReceiveError(data) {
        if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
        showError(data.error || 'Download failed');
    }

    function showError(msg) {
        if (receiveError) {
            receiveError.textContent = `✕ ${msg}`;
            receiveError.style.display = 'block';
        }
    }

    function hideError() {
        if (receiveError) receiveError.style.display = 'none';
    }

    // Play in Cinema
    if (btnPlayReceived) {
        btnPlayReceived.addEventListener('click', () => {
            if (currentLastReceivedFile) {
                playLocalVideo(currentLastReceivedFile);
            }
        });
    }

    // Open Folder
    if (btnOpenReceivedFolder) {
        btnOpenReceivedFolder.addEventListener('click', async () => {
            if (currentLastReceivedFile && window.electronAPI && window.electronAPI.openInFinder) {
                await window.electronAPI.openInFinder(currentLastReceivedFile);
            }
        });
    }

    return {
        onReceiveProgress,
        onReceiveComplete,
        onReceiveError
    };
}
