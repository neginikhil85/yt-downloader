// ==========================================================================
// YT Studio Pro — P2P Sender Controller (Unified + Phone Modal + QR Code)
// Manages file selection, 6-digit PIN display, QR Code popover, and telemetry
// ==========================================================================

export function initP2PSendController(options = {}) {
    const { onStateChange = () => {} } = options;

    const dropzone = document.getElementById('toffee-dropzone');
    const btnBrowse = document.getElementById('btn-toffee-browse');
    const btnToggleIdleQr = document.getElementById('btn-toggle-idle-qr');

    // Phone Modal Elements
    const phoneModal = document.getElementById('modal-connect-phone');
    const btnClosePhoneModal = document.getElementById('btn-close-phone-modal');
    const btnPhoneModalDone = document.getElementById('btn-phone-modal-done');
    const idleQrSvg = document.getElementById('ds-idle-qr-svg');
    const idleQrUrl = document.getElementById('ds-idle-qr-url');

    const idleCard = document.getElementById('ds-idle-card');
    const sendSessionCard = document.getElementById('toffee-send-session-card');
    const sendingFileName = document.getElementById('toffee-sending-filename');
    const sendingFileSize = document.getElementById('toffee-sending-filesize');
    const heroPinDisplay = document.getElementById('ds-hero-pin-display');
    const btnCopySendPin = document.getElementById('btn-copy-send-token');
    const btnCopyTokenText = document.getElementById('btn-copy-token-text');
    const btnCancelSend = document.getElementById('btn-cancel-send');

    // Sender QR Elements
    const senderQrSvg = document.getElementById('ds-sender-qr-svg');
    const senderQrUrl = document.getElementById('ds-sender-qr-url');

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

    let currentActiveFile = null;
    let currentPin = '';
    let sendStartTime = 0;

    // Open Phone Modal Popover
    if (btnToggleIdleQr) {
        btnToggleIdleQr.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (phoneModal) {
                phoneModal.style.display = 'flex';
            }
            if (window.electronAPI && window.electronAPI.p2pGetPortalInfo) {
                try {
                    const info = await window.electronAPI.p2pGetPortalInfo();
                    if (info) {
                        if (idleQrSvg) idleQrSvg.innerHTML = info.qrSvg || '';
                        if (idleQrUrl) idleQrUrl.textContent = info.url || `http://${info.ip}:${info.port}/`;
                    }
                } catch (err) {
                    console.error('Error fetching portal info:', err);
                }
            }
        });
    }

    // Close Phone Modal Handlers
    function closePhoneModal() {
        if (phoneModal) phoneModal.style.display = 'none';
    }

    if (btnClosePhoneModal) btnClosePhoneModal.addEventListener('click', closePhoneModal);
    if (btnPhoneModalDone) btnPhoneModalDone.addEventListener('click', closePhoneModal);
    if (phoneModal) {
        phoneModal.addEventListener('click', (e) => {
            if (e.target === phoneModal) closePhoneModal();
        });
    }

    // File Drag & Drop Handlers
    if (dropzone) {
        if (btnBrowse) {
            btnBrowse.addEventListener('click', async (e) => {
                e.stopPropagation();
                await triggerNativeFilePicker();
            });
        }

        dropzone.addEventListener('click', async () => {
            await triggerNativeFilePicker();
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const droppedFile = e.dataTransfer.files[0];
                let resolvedPath = '';
                if (window.electronAPI && window.electronAPI.getFilePath) {
                    resolvedPath = window.electronAPI.getFilePath(droppedFile);
                }
                if (!resolvedPath && droppedFile.path) {
                    resolvedPath = droppedFile.path;
                }
                if (resolvedPath) {
                    await handleStartSendPath(resolvedPath);
                }
            }
        });
    }

    async function triggerNativeFilePicker() {
        if (window.electronAPI && window.electronAPI.selectFileToSend) {
            try {
                const selectedPath = await window.electronAPI.selectFileToSend();
                if (selectedPath) {
                    await handleStartSendPath(selectedPath);
                }
            } catch (err) {
                console.error('File selection error:', err);
            }
        }
    }

    async function handleStartSendPath(filePath) {
        if (!filePath || !window.electronAPI) return;

        try {
            const res = await window.electronAPI.p2pStartSend(filePath);
            if (!res.success) {
                alert(`Could not start sharing: ${res.error}`);
                return;
            }

            currentActiveFile = res.file;
            currentPin = res.code || res.token || '';
            sendStartTime = Date.now();

            if (idleCard) idleCard.style.display = 'none';
            if (sendSessionCard) sendSessionCard.style.display = 'flex';
            if (transferHeroCard) transferHeroCard.style.display = 'none';
            if (completeHeroCard) completeHeroCard.style.display = 'none';

            if (sendingFileName) sendingFileName.textContent = res.file.name;
            if (sendingFileSize) sendingFileSize.textContent = res.file.formattedSize;
            if (heroPinDisplay) {
                const pinStr = String(currentPin);
                heroPinDisplay.textContent = pinStr.length === 6 ? `${pinStr.slice(0, 3)} ${pinStr.slice(3)}` : pinStr;
            }

            // Populate Sender QR Code
            if (senderQrSvg && res.qrSvg) {
                senderQrSvg.innerHTML = res.qrSvg;
            }
            if (senderQrUrl && res.portalUrl) {
                senderQrUrl.textContent = res.portalUrl;
            }

            // File icon resolver
            setFileTypeIcon(document.getElementById('p2p-send-type-icon'), res.file.name);

            onStateChange('SENDING_WAITING');
        } catch (err) {
            console.error('P2P Start Send Error:', err);
            alert(`Error: ${err.message}`);
        }
    }

    // Cancel Active Send Session
    if (btnCancelSend) {
        btnCancelSend.addEventListener('click', async () => {
            await resetToIdle();
        });
    }

    if (btnCancelActiveTransfer) {
        btnCancelActiveTransfer.addEventListener('click', async () => {
            await resetToIdle();
        });
    }

    if (btnCompleteReset) {
        btnCompleteReset.addEventListener('click', async () => {
            await resetToIdle();
        });
    }

    async function resetToIdle() {
        if (window.electronAPI && window.electronAPI.p2pCancelSend) {
            await window.electronAPI.p2pCancelSend();
        }
        if (idleCard) idleCard.style.display = 'flex';
        if (sendSessionCard) sendSessionCard.style.display = 'none';
        if (transferHeroCard) transferHeroCard.style.display = 'none';
        if (completeHeroCard) completeHeroCard.style.display = 'none';

        currentActiveFile = null;
        currentPin = '';
        onStateChange('IDLE');
    }

    // 1-Click Copy PIN Button
    if (btnCopySendPin) {
        btnCopySendPin.addEventListener('click', () => {
            if (currentPin) {
                navigator.clipboard.writeText(String(currentPin));
                if (btnCopyTokenText) btnCopyTokenText.textContent = '✓ Copied!';
                setTimeout(() => {
                    if (btnCopyTokenText) btnCopyTokenText.textContent = 'Copy PIN';
                }, 2000);
            }
        });
    }

    // Live Telemetry Updates (Sender side)
    function onSendProgress(data) {
        if (sendSessionCard) sendSessionCard.style.display = 'none';
        if (idleCard) idleCard.style.display = 'none';
        if (transferHeroCard) transferHeroCard.style.display = 'flex';
        if (completeHeroCard) completeHeroCard.style.display = 'none';

        if (transferFilename) transferFilename.textContent = data.fileName;
        if (transferMetricsText) transferMetricsText.textContent = `Direct Streaming to Recipient • ${Math.round(data.progress)}%`;
        if (transferBar) transferBar.style.width = `${data.progress}%`;
        if (transferSpeed) transferSpeed.textContent = `${data.speedMBps} MB/s`;

        const sentMb = (data.sentBytes / (1024 * 1024)).toFixed(1);
        const totalMb = (data.totalBytes / (1024 * 1024)).toFixed(1);
        if (transferCounter) transferCounter.textContent = `${sentMb} MB / ${totalMb} MB`;
        if (transferEta) transferEta.textContent = data.etaSeconds > 0 ? `~${data.etaSeconds}s remaining` : 'Completing...';

        setFileTypeIcon(transferTypeIcon, data.fileName);
        onStateChange('TRANSFERRING');
    }

    // Send Complete Handler
    function onSendComplete(data) {
        if (transferHeroCard) transferHeroCard.style.display = 'none';
        if (sendSessionCard) sendSessionCard.style.display = 'none';
        if (completeHeroCard) completeHeroCard.style.display = 'flex';

        const durationSec = ((Date.now() - sendStartTime) / 1000).toFixed(1);
        if (completeTitle) completeTitle.textContent = 'File Sent Successfully!';
        if (completeSubtitle && data) {
            completeSubtitle.textContent = `Delivered ${data.fileName} (${data.formattedSize || ''}) in ${durationSec}s`;
        }

        // On sender side, hide Open File button
        if (btnCompleteOpenFile) btnCompleteOpenFile.style.display = 'none';
        if (btnCompleteShowFolder) btnCompleteShowFolder.style.display = 'none';

        onStateChange('COMPLETE');
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
        onSendProgress,
        onSendComplete,
        resetToIdle
    };
}
