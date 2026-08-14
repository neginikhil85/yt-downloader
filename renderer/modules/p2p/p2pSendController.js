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

            // Smart File Type Icon
            const ext = (res.file.name.split('.').pop() || '').toLowerCase();
            const iconEl = document.getElementById('p2p-send-type-icon');
            if (iconEl) {
                if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) iconEl.textContent = '🎬';
                else if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) iconEl.textContent = '🎵';
                else if (['zip', 'rar', '7z', 'tar', 'gz', 'dmg', 'iso'].includes(ext)) iconEl.textContent = '📦';
                else if (['sh', 'js', 'py', 'ts', 'html', 'json', 'cpp', 'rs'].includes(ext)) iconEl.textContent = '⚡';
                else iconEl.textContent = '📄';
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
