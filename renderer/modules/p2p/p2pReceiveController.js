// ==========================================================================
// YT Studio Pro — P2P Receiver Controller (Unified Zero-Friction)
// Auto-connect via 6-digit PIN or 1-tap radar, direct stream download & instant actions
// ==========================================================================

export function initP2PReceiveController(options = {}) {
    const { onStateChange = () => {} } = options;

    const pinInput = document.getElementById('toffee-receive-code-input');
    const btnConnect = document.getElementById('btn-connect-code');
    const receiveError = document.getElementById('toffee-receive-error');

    const idleCard = document.getElementById('ds-idle-card');
    const sendSessionCard = document.getElementById('toffee-send-session-card');

    // Transfer Progress Hero Card
    const transferHeroCard = document.getElementById('ds-transfer-hero-card');
    const transferFilename = document.getElementById('ds-transfer-filename');
    const transferTypeIcon = document.getElementById('ds-transfer-type-icon');
    const transferMetricsText = document.getElementById('ds-transfer-metrics-text');
    const transferBar = document.getElementById('ds-transfer-bar');
    const transferSpeed = document.getElementById('ds-transfer-speed');
    const transferCounter = document.getElementById('ds-transfer-counter');
    const transferEta = document.getElementById('ds-transfer-eta');
    const btnCancelActiveTransfer = document.getElementById('btn-cancel-active-transfer');

    // Completion Card
    const completeHeroCard = document.getElementById('ds-complete-hero-card');
    const completeTitle = document.getElementById('ds-complete-title');
    const completeSubtitle = document.getElementById('ds-complete-subtitle');
    const btnCompleteOpenFile = document.getElementById('btn-complete-open-file');
    const btnCompleteShowFolder = document.getElementById('btn-complete-show-folder');
    const btnCompleteReset = document.getElementById('btn-complete-reset');

    let currentReceivedFilePath = '';
    let isTransferring = false;

    // PIN Input Handlers
    if (pinInput) {
        // Filter input to alphanumeric / uppercase / digits only
        pinInput.addEventListener('input', () => {
            const raw = pinInput.value.replace(/\s+/g, '').trim();
            if (raw.length === 6 && /^\d{6}$/.test(raw)) {
                // Auto-submit on 6th digit input!
                handleStartReceive(raw);
            }
        });

        pinInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const raw = pinInput.value.replace(/\s+/g, '').trim();
                if (raw) handleStartReceive(raw);
            }
        });
    }

    if (btnConnect) {
        btnConnect.addEventListener('click', () => {
            const raw = pinInput ? pinInput.value.replace(/\s+/g, '').trim() : '';
            if (raw) handleStartReceive(raw);
        });
    }

    // Direct 1-Tap Download from Radar Peer
    async function startReceivePeer(peerData) {
        const { ip, port, code, token, file } = peerData;
        hideError();

        if (idleCard) idleCard.style.display = 'none';
        if (sendSessionCard) sendSessionCard.style.display = 'none';
        if (completeHeroCard) completeHeroCard.style.display = 'none';
        if (transferHeroCard) transferHeroCard.style.display = 'flex';

        const fileName = file?.name || 'Incoming file';
        if (transferFilename) transferFilename.textContent = fileName;
        if (transferMetricsText) transferMetricsText.textContent = `Connecting to ${peerData.name || 'sender'}...`;
        if (transferBar) transferBar.style.width = '0%';
        setFileTypeIcon(transferTypeIcon, fileName);

        isTransferring = true;
        onStateChange('RECEIVING');

        try {
            let res;
            if (ip && port && code) {
                res = await window.electronAPI.p2pReceivePeer({ ip, port, code });
            } else if (token) {
                res = await window.electronAPI.p2pReceiveToken({ token });
            } else {
                res = await window.electronAPI.p2pReceiveCode({ code });
            }

            if (res && res.success) {
                onReceiveComplete(res);
            } else {
                showError(res?.error || 'Connection failed. Ensure sender is online.');
                resetToIdle();
            }
        } catch (err) {
            showError(err.message || 'Transfer failed');
            resetToIdle();
        }
    }

    // Connect via PIN Code Input
    async function handleStartReceive(code) {
        if (!code || isTransferring) return;
        hideError();

        if (btnConnect) {
            btnConnect.disabled = true;
            btnConnect.textContent = 'Connecting...';
        }

        if (idleCard) idleCard.style.display = 'none';
        if (sendSessionCard) sendSessionCard.style.display = 'none';
        if (completeHeroCard) completeHeroCard.style.display = 'none';
        if (transferHeroCard) transferHeroCard.style.display = 'flex';

        if (transferFilename) transferFilename.textContent = `Connecting with PIN ${code}...`;
        if (transferMetricsText) transferMetricsText.textContent = 'Locating sender on local network...';
        if (transferBar) transferBar.style.width = '0%';

        isTransferring = true;
        onStateChange('RECEIVING');

        try {
            const res = await window.electronAPI.p2pReceiveCode(code);
            if (res && res.success) {
                onReceiveComplete(res);
            } else {
                showError(res?.error || 'No active share found for this PIN code.');
                resetToIdle();
            }
        } catch (err) {
            showError(err.message || 'Transfer error');
            resetToIdle();
        } finally {
            if (btnConnect) {
                btnConnect.disabled = false;
                btnConnect.textContent = 'Connect & Download';
            }
        }
    }

    // Telemetry Progress Update (Receiver side)
    function onReceiveProgress(data) {
        if (transferHeroCard) transferHeroCard.style.display = 'flex';
        if (idleCard) idleCard.style.display = 'none';
        if (completeHeroCard) completeHeroCard.style.display = 'none';

        if (transferFilename) transferFilename.textContent = data.fileName;
        if (transferMetricsText) transferMetricsText.textContent = `Direct TCP Socket Stream • ${Math.round(data.progress)}%`;
        if (transferBar) transferBar.style.width = `${data.progress}%`;
        if (transferSpeed) transferSpeed.textContent = `${data.speedMBps} MB/s`;

        const recvMb = (data.receivedBytes / (1024 * 1024)).toFixed(1);
        const totalMb = (data.totalBytes / (1024 * 1024)).toFixed(1);
        if (transferCounter) transferCounter.textContent = `${recvMb} MB / ${totalMb} MB`;
        if (transferEta) transferEta.textContent = data.etaSeconds > 0 ? `~${data.etaSeconds}s remaining` : 'Finalizing...';

        setFileTypeIcon(transferTypeIcon, data.fileName);
    }

    // Receiver Completion Handler
    function onReceiveComplete(data) {
        isTransferring = false;
        currentReceivedFilePath = data.filePath;

        if (transferHeroCard) transferHeroCard.style.display = 'none';
        if (idleCard) idleCard.style.display = 'none';
        if (completeHeroCard) completeHeroCard.style.display = 'flex';

        if (completeTitle) completeTitle.textContent = 'File Received Successfully!';
        if (completeSubtitle && data) {
            completeSubtitle.textContent = `Saved ${data.fileName} (${data.formattedSize || ''}) to Downloads`;
        }

        // Show Action Buttons for Receiver
        if (btnCompleteOpenFile) btnCompleteOpenFile.style.display = 'inline-flex';
        if (btnCompleteShowFolder) btnCompleteShowFolder.style.display = 'inline-flex';

        onStateChange('COMPLETE');
    }

    function onReceiveError(data) {
        isTransferring = false;
        showError(data.error || 'Transfer connection lost');
        resetToIdle();
    }

    function resetToIdle() {
        isTransferring = false;
        if (window.electronAPI && window.electronAPI.p2pCancelReceive) {
            window.electronAPI.p2pCancelReceive().catch(() => {});
        }
        if (idleCard) idleCard.style.display = 'flex';
        if (sendSessionCard) sendSessionCard.style.display = 'none';
        if (transferHeroCard) transferHeroCard.style.display = 'none';
        if (completeHeroCard) completeHeroCard.style.display = 'none';
        if (pinInput) pinInput.value = '';

        onStateChange('IDLE');
    }

    // Action 1: Instant Launch / Open File
    if (btnCompleteOpenFile) {
        btnCompleteOpenFile.addEventListener('click', async () => {
            if (currentReceivedFilePath && window.electronAPI && window.electronAPI.openFile) {
                await window.electronAPI.openFile(currentReceivedFilePath);
            }
        });
    }

    // Action 2: Show in Finder / Folder
    if (btnCompleteShowFolder) {
        btnCompleteShowFolder.addEventListener('click', async () => {
            if (currentReceivedFilePath && window.electronAPI && window.electronAPI.openInFinder) {
                await window.electronAPI.openInFinder(currentReceivedFilePath);
            }
        });
    }

    // Action 3: Reset / Receive Another File
    if (btnCompleteReset) {
        btnCompleteReset.addEventListener('click', () => {
            resetToIdle();
        });
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

    function setFileTypeIcon(iconEl, fileName) {
        if (!iconEl) return;
        const ext = ((fileName || '').split('.').pop() || '').toLowerCase();
        if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) {
            iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
        } else if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) {
            iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
        } else if (['zip', 'rar', '7z', 'tar', 'gz', 'dmg'].includes(ext)) {
            iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
        } else {
            iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
        }
    }

    return {
        startReceivePeer,
        onReceiveProgress,
        onReceiveComplete,
        onReceiveError,
        resetToIdle
    };
}
