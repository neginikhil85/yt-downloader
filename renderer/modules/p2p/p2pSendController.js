// ==========================================================================
// YT Studio Pro — P2P Sender Controller
// ==========================================================================

export function initP2PSendController() {
    const dropzone = document.getElementById('toffee-dropzone');
    const btnBrowse = document.getElementById('btn-toffee-browse');
    const senderIdleView = document.getElementById('ds-sender-idle-view');
    const sendSessionCard = document.getElementById('toffee-send-session-card');
    const sendingFileName = document.getElementById('toffee-sending-filename');
    const sendingFileSize = document.getElementById('toffee-sending-filesize');
    const btnCancelSend = document.getElementById('btn-cancel-send');
    const btnCopySendCode = document.getElementById('btn-copy-send-code');
    const sendRadar = document.getElementById('toffee-send-radar');
    const sendRadarText = document.getElementById('toffee-send-radar-text');
    const sendProgressWrap = document.getElementById('toffee-send-progress-wrap');
    const sendSpeed = document.getElementById('toffee-send-speed');
    const sendPercent = document.getElementById('toffee-send-percent');
    const sendBar = document.getElementById('toffee-send-bar');
    const sendEta = document.getElementById('toffee-send-eta');

    let currentActiveFile = null;
    let currentRawCode = '';

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
            currentRawCode = res.code;

            if (senderIdleView) senderIdleView.style.display = 'none';
            if (sendSessionCard) sendSessionCard.style.display = 'flex';
            if (sendingFileName) sendingFileName.textContent = res.file.name;
            if (sendingFileSize) sendingFileSize.textContent = res.file.formattedSize;

            // Set Individual Digit Boxes [7] [7] [7]  [1] [3] [6]
            for (let i = 0; i < 6; i++) {
                const digitEl = document.getElementById(`pin-d${i}`);
                if (digitEl) digitEl.textContent = res.code[i] || '-';
            }

            // Smart File Type SVG Icon
            const ext = (res.file.name.split('.').pop() || '').toLowerCase();
            const iconEl = document.getElementById('p2p-send-type-icon');
            if (iconEl) {
                if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) {
                    iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
                } else if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) {
                    iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
                } else if (['zip', 'rar', '7z', 'tar', 'gz', 'dmg', 'iso'].includes(ext)) {
                    iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
                } else {
                    iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
                }
            }

            // Update Header IP & Device Name Badge
            const ipEl = document.getElementById('ds-local-ip');
            const devEl = document.getElementById('ds-local-device-name');
            if (ipEl && res.localIp) ipEl.textContent = `${res.localIp}:${res.port}`;
            if (devEl && res.deviceName) devEl.textContent = res.deviceName;

            if (sendRadar) sendRadar.style.display = 'flex';
            if (sendRadarText) sendRadarText.textContent = 'Ready & listening for recipient connection...';
            if (sendProgressWrap) sendProgressWrap.style.display = 'none';
        } catch (err) {
            console.error('P2P Start Send Error:', err);
            alert(`Error: ${err.message}`);
        }
    }

    // Cancel Session
    if (btnCancelSend) {
        btnCancelSend.addEventListener('click', async () => {
            if (window.electronAPI) {
                await window.electronAPI.p2pCancelSend();
            }
            if (senderIdleView) senderIdleView.style.display = 'flex';
            if (sendSessionCard) sendSessionCard.style.display = 'none';
        });
    }

    // Copy PIN Button
    if (btnCopySendCode) {
        btnCopySendCode.addEventListener('click', () => {
            if (currentRawCode) {
                navigator.clipboard.writeText(currentRawCode);
                btnCopySendCode.textContent = '✓ Copied!';
                setTimeout(() => {
                    btnCopySendCode.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        <span>Copy PIN</span>
                    `;
                }, 2000);
            }
        });
    }

    // Telemetry Progress Update
    function onSendProgress(data) {
        if (sendRadar) sendRadar.style.display = 'none';
        if (sendProgressWrap) sendProgressWrap.style.display = 'block';
        if (sendSpeed) sendSpeed.textContent = `${data.speedMBps} MB/s`;
        if (sendPercent) sendPercent.textContent = `${Math.round(data.progress)}%`;
        if (sendBar) sendBar.style.width = `${data.progress}%`;
        if (sendEta) sendEta.textContent = `Direct Socket Streaming • ${data.etaSeconds}s remaining`;
    }

    return {
        onSendProgress
    };
}
