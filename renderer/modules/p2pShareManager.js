// ==========================================================================
// YT Studio Pro — ToffeeShare App-to-App Direct P2P Client Controller
// ==========================================================================

import { playLocalVideo } from './videoPlayer.js';

export function initP2PShareManager() {
    // Mode Switchers
    const btnModeSend = document.getElementById('btn-mode-send');
    const btnModeReceive = document.getElementById('btn-mode-receive');
    const sendPanel = document.getElementById('toffee-send-panel');
    const receivePanel = document.getElementById('toffee-receive-panel');

    // Sender Elements
    const dropzone = document.getElementById('toffee-dropzone');
    const fileInput = document.getElementById('toffee-file-input');
    const btnBrowse = document.getElementById('btn-toffee-browse');
    const sendSessionCard = document.getElementById('toffee-send-session-card');
    const sendingFileName = document.getElementById('toffee-sending-filename');
    const sendingFileSize = document.getElementById('toffee-sending-filesize');
    const sendCodeDisplay = document.getElementById('toffee-send-code');
    const btnCopySendCode = document.getElementById('btn-copy-send-code');
    const btnCancelSend = document.getElementById('btn-cancel-send');
    const sendRadar = document.getElementById('toffee-send-radar');
    const sendProgressWrap = document.getElementById('toffee-send-progress-wrap');
    const sendSpeed = document.getElementById('toffee-send-speed');
    const sendPercent = document.getElementById('toffee-send-percent');
    const sendBar = document.getElementById('toffee-send-bar');
    const sendEta = document.getElementById('toffee-send-eta');

    // Receiver Elements
    const codeInput = document.getElementById('toffee-receive-code-input');
    const btnConnectCode = document.getElementById('btn-connect-code');
    const receiveError = document.getElementById('toffee-receive-error');
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
    const peersList = document.getElementById('toffee-peers-list');

    let currentLastReceivedFile = null;
    let currentRawCode = '';

    // ======================================================================
    // 1. Mode Switching
    // ======================================================================
    if (btnModeSend && btnModeReceive) {
        btnModeSend.addEventListener('click', () => {
            btnModeSend.classList.add('active');
            btnModeReceive.classList.remove('active');
            if (sendPanel) sendPanel.classList.add('active');
            if (receivePanel) receivePanel.classList.remove('active');
        });

        btnModeReceive.addEventListener('click', () => {
            btnModeReceive.classList.add('active');
            btnModeSend.classList.remove('active');
            if (receivePanel) receivePanel.classList.add('active');
            if (sendPanel) sendPanel.classList.remove('active');
            pollPeers();
        });
    }

    // ======================================================================
    // 2. Sender: File Drop & Select
    // ======================================================================
    if (dropzone && fileInput) {
        if (btnBrowse) btnBrowse.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleStartSend(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                handleStartSend(fileInput.files[0]);
            }
        });
    }

    async function handleStartSend(file) {
        if (!file || !file.path) return;
        if (!window.electronAPI || !window.electronAPI.p2pStartSend) return;

        try {
            const res = await window.electronAPI.p2pStartSend(file.path);
            if (res && res.success) {
                currentRawCode = res.code;
                const formatted = `${res.code.slice(0, 3)} ${res.code.slice(3)}`;

                if (dropzone) dropzone.style.display = 'none';
                if (sendSessionCard) sendSessionCard.style.display = 'flex';
                if (sendingFileName) sendingFileName.textContent = res.file.name;
                if (sendingFileSize) sendingFileSize.textContent = res.file.formattedSize;
                if (sendCodeDisplay) sendCodeDisplay.textContent = formatted;
                if (sendRadar) sendRadar.style.display = 'flex';
                if (sendProgressWrap) sendProgressWrap.style.display = 'none';
            }
        } catch (e) {
            alert('Failed to start share session: ' + e.message);
        }
    }

    // Cancel Send
    if (btnCancelSend) {
        btnCancelSend.addEventListener('click', async () => {
            if (window.electronAPI && window.electronAPI.p2pCancelSend) {
                await window.electronAPI.p2pCancelSend();
            }
            if (dropzone) dropzone.style.display = 'flex';
            if (sendSessionCard) sendSessionCard.style.display = 'none';
            if (fileInput) fileInput.value = '';
        });
    }

    // Copy Send Code
    if (btnCopySendCode) {
        btnCopySendCode.addEventListener('click', async () => {
            if (currentRawCode) {
                try {
                    await navigator.clipboard.writeText(currentRawCode);
                    btnCopySendCode.textContent = '✓ Copied!';
                    btnCopySendCode.style.background = '#10b981';
                    setTimeout(() => {
                        btnCopySendCode.textContent = '📋 Copy Code';
                        btnCopySendCode.style.background = '';
                    }, 1600);
                } catch (e) {
                    console.error(e);
                }
            }
        });
    }

    // ======================================================================
    // 3. Receiver: Connect by Code or Discovered Peer
    // ======================================================================
    if (codeInput) {
        // Auto-format spacing: "123 456"
        codeInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '').slice(0, 6);
            if (val.length > 3) {
                val = val.slice(0, 3) + ' ' + val.slice(3);
            }
            e.target.value = val;
        });

        codeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleConnectCode();
        });
    }

    if (btnConnectCode) {
        btnConnectCode.addEventListener('click', handleConnectCode);
    }

    async function handleConnectCode() {
        const rawCode = codeInput ? codeInput.value.replace(/\s+/g, '') : '';
        if (!rawCode || rawCode.length < 6) {
            showReceiveError('Please enter a 6-digit code');
            return;
        }

        hideReceiveError();
        if (btnConnectCode) {
            btnConnectCode.disabled = true;
            btnConnectCode.textContent = 'Connecting...';
        }

        if (receiveProgressWrap) receiveProgressWrap.style.display = 'flex';
        if (receiveCompleteBox) receiveCompleteBox.style.display = 'none';

        try {
            const res = await window.electronAPI.p2pReceiveCode(rawCode);
            if (!res || !res.success) {
                showReceiveError(res?.error || 'Could not connect to sender');
                if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
            }
        } catch (e) {
            showReceiveError('Transfer error: ' + e.message);
            if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
        } finally {
            if (btnConnectCode) {
                btnConnectCode.disabled = false;
                btnConnectCode.textContent = 'Connect & Receive →';
            }
        }
    }

    function showReceiveError(msg) {
        if (receiveError) {
            receiveError.textContent = msg;
            receiveError.style.display = 'block';
        }
    }

    function hideReceiveError() {
        if (receiveError) receiveError.style.display = 'none';
    }

    // Connect directly to a discovered peer
    window.connectToDiscoveredPeer = async (ip, port, code) => {
        hideReceiveError();
        if (receiveProgressWrap) receiveProgressWrap.style.display = 'flex';
        if (receiveCompleteBox) receiveCompleteBox.style.display = 'none';

        try {
            const res = await window.electronAPI.p2pReceivePeer({ ip, port, code });
            if (!res || !res.success) {
                showReceiveError(res?.error || 'Direct connection failed');
            }
        } catch (e) {
            showReceiveError('Error: ' + e.message);
        }
    };

    async function pollPeers() {
        if (!window.electronAPI || !window.electronAPI.p2pGetPeers) return;
        try {
            const peers = await window.electronAPI.p2pGetPeers();
            renderDiscoveredPeers(peers || []);
        } catch (e) {
            console.error(e);
        }
    }

    function renderDiscoveredPeers(peers) {
        if (!peersList) return;

        if (peers.length === 0) {
            peersList.innerHTML = `
                <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 24px 0;">
                    Searching for nearby apps on local network...
                </div>
            `;
            return;
        }

        peersList.innerHTML = peers.map(p => {
            const isSharing = p.activeSend && p.activeSend.name;
            const subText = isSharing 
                ? `Sharing: <strong>${p.activeSend.name}</strong> (${(p.activeSend.size / (1024*1024)).toFixed(1)} MB)`
                : `Ready on local network (${p.ip})`;

            const actionButton = isSharing
                ? `<button class="btn-toffee-receive-peer" onclick="window.connectToDiscoveredPeer('${p.ip}', ${p.port}, '${p.activeSend.code}')">📥 Receive (${p.activeSend.code})</button>`
                : `<span style="font-size: 11px; color: var(--text-muted);">Idle</span>`;

            return `
                <div class="toffee-peer-card">
                    <div class="toffee-peer-info">
                        <span class="toffee-peer-icon">${p.name.includes('Mac') ? '🍏' : (p.name.includes('Windows') ? '💻' : '📡')}</span>
                        <div>
                            <div class="toffee-peer-name">${p.name}</div>
                            <div class="toffee-peer-sharing">${subText}</div>
                        </div>
                    </div>
                    ${actionButton}
                </div>
            `;
        }).join('');
    }

    // ======================================================================
    // 4. Real-Time Transfer Events Hookup
    // ======================================================================
    if (window.electronAPI) {
        // Discovered Peers Auto-Update
        if (window.electronAPI.onP2PPeersUpdated) {
            window.electronAPI.onP2PPeersUpdated((peers) => {
                renderDiscoveredPeers(peers || []);
            });
        }

        // Sender Progress Events
        if (window.electronAPI.onP2PSendProgress) {
            window.electronAPI.onP2PSendProgress((data) => {
                if (sendRadar) sendRadar.style.display = 'none';
                if (sendProgressWrap) sendProgressWrap.style.display = 'flex';
                if (sendSpeed) sendSpeed.textContent = `${data.speedMBps} MB/s`;
                if (sendPercent) sendPercent.textContent = `${Math.round(data.progress)}%`;
                if (sendBar) sendBar.style.width = `${data.progress}%`;
                if (sendEta) sendEta.textContent = `Time remaining: ~${data.etaSeconds}s`;
            });
        }

        if (window.electronAPI.onP2PSendComplete) {
            window.electronAPI.onP2PSendComplete((data) => {
                if (sendEta) sendEta.textContent = `✓ Sent successfully in ${data.totalTimeSeconds}s!`;
                if (sendBar) sendBar.style.width = '100%';
                if (sendSpeed) sendSpeed.textContent = 'Completed';
            });
        }

        // Receiver Progress Events
        if (window.electronAPI.onP2PReceiveProgress) {
            window.electronAPI.onP2PReceiveProgress((data) => {
                if (receiveProgressWrap) receiveProgressWrap.style.display = 'flex';
                if (receiveFilename) receiveFilename.textContent = data.fileName;
                if (receivePercent) receivePercent.textContent = `${Math.round(data.progress)}%`;
                if (receiveBar) receiveBar.style.width = `${data.progress}%`;
                if (receiveSpeed) receiveSpeed.textContent = `${data.speedMBps} MB/s`;
                if (receiveEta) receiveEta.textContent = `ETA: ~${data.etaSeconds}s`;
            });
        }

        if (window.electronAPI.onP2PReceiveComplete) {
            window.electronAPI.onP2PReceiveComplete((data) => {
                currentLastReceivedFile = data.savedPath;
                if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
                if (receiveCompleteBox) receiveCompleteBox.style.display = 'flex';
                if (savedPathLabel) savedPathLabel.textContent = `Saved: ${data.fileName} (${(data.fileSize / (1024*1024)).toFixed(1)} MB)`;
                if (codeInput) codeInput.value = '';
            });
        }

        if (window.electronAPI.onP2PReceiveError) {
            window.electronAPI.onP2PReceiveError((data) => {
                showReceiveError(data.error || 'Download failed');
                if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
            });
        }
    }

    // Play Received Video
    if (btnPlayReceived) {
        btnPlayReceived.addEventListener('click', () => {
            if (currentLastReceivedFile) {
                playLocalVideo(currentLastReceivedFile);
            }
        });
    }

    // Open Received Folder in Finder / Explorer
    if (btnOpenReceivedFolder) {
        btnOpenReceivedFolder.addEventListener('click', () => {
            if (currentLastReceivedFile && window.electronAPI && window.electronAPI.openInFinder) {
                window.electronAPI.openInFinder(currentLastReceivedFile);
            }
        });
    }

    // Auto-poll peers every 3 seconds
    setInterval(pollPeers, 3000);
}
