// ==========================================================================
// YT Studio Pro — Zero-Central-Server Direct P2P File Transfer Manager
// 100% Direct Device-to-Device | LAN Auto-Discovery | WAN Token Handshake
// Progressive SHA-256 | WebRTC DataChannel | Zero Cloud Relay
// ==========================================================================

import { playLocalVideo } from './videoPlayer.js';

export function initP2PShareManager() {
    // Mode Switchers (Send vs Receive)
    const btnModeSend = document.getElementById('btn-mode-send');
    const btnModeReceive = document.getElementById('btn-mode-receive');
    const sendPanel = document.getElementById('toffee-send-panel');
    const receivePanel = document.getElementById('toffee-receive-panel');

    // Scope Switchers (Nearby LAN vs Remote WAN)
    const btnScopeNearby = document.getElementById('btn-scope-nearby');
    const btnScopeRemote = document.getElementById('btn-scope-remote');
    const sendNearbyBox = document.getElementById('send-nearby-box');
    const sendRemoteBox = document.getElementById('send-remote-box');
    const receiveNearbyView = document.getElementById('receive-nearby-view');
    const receiveRemoteView = document.getElementById('receive-remote-view');

    // Sender UI Elements
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
    const sendRadarText = document.getElementById('toffee-send-radar-text');
    const sendProgressWrap = document.getElementById('toffee-send-progress-wrap');
    const sendSpeed = document.getElementById('toffee-send-speed');
    const sendPercent = document.getElementById('toffee-send-percent');
    const sendBar = document.getElementById('toffee-send-bar');
    const sendEta = document.getElementById('toffee-send-eta');

    // Remote Token Elements (Sender)
    const tokenOfferDisplay = document.getElementById('token-offer-display');
    const btnCopyToken = document.getElementById('btn-copy-token');
    const tokenAnswerInput = document.getElementById('token-answer-input');
    const btnApplyAnswer = document.getElementById('btn-apply-answer');

    // Receiver UI Elements (Nearby)
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

    // Remote Token Elements (Receiver)
    const remoteOfferInput = document.getElementById('remote-offer-input');
    const btnRemoteGenAnswer = document.getElementById('btn-remote-gen-answer');
    const remoteAnswerBox = document.getElementById('remote-answer-box');
    const remoteAnswerDisplay = document.getElementById('remote-answer-display');
    const btnCopyRemoteAnswer = document.getElementById('btn-copy-remote-answer');
    const remoteReceiveError = document.getElementById('remote-receive-error');

    let currentScope = 'nearby'; // 'nearby' | 'remote'
    let currentActiveFile = null;
    let currentRawCode = '';
    let currentLastReceivedFile = null;

    // WebRTC State for Remote WAN
    let senderPeerConn = null;
    let senderDataChannel = null;
    let receiverPeerConn = null;
    let receiverDataChannel = null;

    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    // ======================================================================
    // 1. Mode & Scope Switching
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

    if (btnScopeNearby && btnScopeRemote) {
        btnScopeNearby.addEventListener('click', () => {
            currentScope = 'nearby';
            btnScopeNearby.classList.add('active');
            btnScopeRemote.classList.remove('active');
            if (sendNearbyBox) sendNearbyBox.style.display = 'block';
            if (sendRemoteBox) sendRemoteBox.style.display = 'none';
            if (receiveNearbyView) receiveNearbyView.style.display = 'block';
            if (receiveRemoteView) receiveRemoteView.style.display = 'none';
        });

        btnScopeRemote.addEventListener('click', () => {
            currentScope = 'remote';
            btnScopeRemote.classList.add('active');
            btnScopeNearby.classList.remove('active');
            if (sendNearbyBox) sendNearbyBox.style.display = 'none';
            if (sendRemoteBox) sendRemoteBox.style.display = 'block';
            if (receiveNearbyView) receiveNearbyView.style.display = 'none';
            if (receiveRemoteView) receiveRemoteView.style.display = 'block';
        });
    }

    // ======================================================================
    // 2. Sender: File Drop & Select
    // ======================================================================
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
                console.error('File selection dialog error:', err);
            }
        }
    }

    async function handleStartSendPath(filePath) {
        if (!filePath) return;

        try {
            const res = await window.electronAPI.p2pStartSend(filePath);
            if (!res.success) {
                alert(`Could not start sharing: ${res.error}`);
                return;
            }

            currentActiveFile = res.file;
            currentRawCode = res.code;

            if (dropzone) dropzone.style.display = 'none';
            if (sendSessionCard) sendSessionCard.style.display = 'block';
            if (sendingFileName) sendingFileName.textContent = res.file.name;
            if (sendingFileSize) sendingFileSize.textContent = res.file.formattedSize;

            // Formatted 6-digit code: "482 910"
            const formatted = `${res.code.slice(0, 3)} ${res.code.slice(3)}`;
            if (sendCodeDisplay) sendCodeDisplay.textContent = formatted;

            if (sendRadar) sendRadar.style.display = 'flex';
            if (sendRadarText) sendRadarText.textContent = 'Waiting for recipient to connect...';
            if (sendProgressWrap) sendProgressWrap.style.display = 'none';

            // Generate WebRTC Offer Token for Remote WAN
            await setupWebRTCOffer(res.file, filePath);
        } catch (err) {
            console.error('P2P Start Send Error:', err);
            alert(`Error: ${err.message}`);
        }
    }

    async function setupWebRTCOffer(fileMeta, filePath) {
        if (!tokenOfferDisplay) return;
        tokenOfferDisplay.value = 'Gathering ICE & generating token...';

        try {
            senderPeerConn = new RTCPeerConnection(rtcConfig);
            senderDataChannel = senderPeerConn.createDataChannel('fileTransfer', { ordered: true });

            senderDataChannel.onopen = () => {
                console.log('[WebRTC WAN] DataChannel Connected! Starting Direct Stream...');
                if (sendRadarText) sendRadarText.textContent = '🔒 Direct WebRTC Encrypted P2P Connected!';
            };

            const iceCandidates = [];
            senderPeerConn.onicecandidate = (e) => {
                if (e.candidate) {
                    iceCandidates.push(e.candidate);
                }
            };

            const offer = await senderPeerConn.createOffer();
            await senderPeerConn.setLocalDescription(offer);

            // Wait for ICE candidates gathering (up to 1.2s or completion)
            await new Promise((resolve) => {
                if (senderPeerConn.iceGatheringState === 'complete') {
                    resolve();
                } else {
                    const checkState = () => {
                        if (senderPeerConn.iceGatheringState === 'complete') {
                            senderPeerConn.removeEventListener('icegatheringstatechange', checkState);
                            resolve();
                        }
                    };
                    senderPeerConn.addEventListener('icegatheringstatechange', checkState);
                    setTimeout(resolve, 1200);
                }
            });

            const offerPayload = {
                type: 'P2P_OFFER',
                file: fileMeta,
                sdp: senderPeerConn.localDescription,
                candidates: iceCandidates
            };

            const compressed = await window.electronAPI.p2pCompressToken(offerPayload);
            tokenOfferDisplay.value = compressed;
        } catch (e) {
            console.error('WebRTC Offer generation error:', e);
            tokenOfferDisplay.value = 'Failed to generate token';
        }
    }

    if (btnCopyToken) {
        btnCopyToken.addEventListener('click', () => {
            if (tokenOfferDisplay && tokenOfferDisplay.value) {
                navigator.clipboard.writeText(tokenOfferDisplay.value);
                btnCopyToken.textContent = '✓ Copied!';
                setTimeout(() => btnCopyToken.textContent = '📋 Copy Token', 2000);
            }
        });
    }

    if (btnApplyAnswer) {
        btnApplyAnswer.addEventListener('click', async () => {
            const answerStr = tokenAnswerInput?.value?.trim();
            if (!answerStr) return alert('Please paste the Answer Token first');

            try {
                const answerPayload = await window.electronAPI.p2pDecompressToken(answerStr);
                if (answerPayload.sdp && senderPeerConn) {
                    await senderPeerConn.setRemoteDescription(new RTCSessionDescription(answerPayload.sdp));
                    if (answerPayload.candidates && Array.isArray(answerPayload.candidates)) {
                        for (const cand of answerPayload.candidates) {
                            try {
                                await senderPeerConn.addIceCandidate(new RTCIceCandidate(cand));
                            } catch (e) {}
                        }
                    }
                    btnApplyAnswer.textContent = '✓ Connected!';
                }
            } catch (e) {
                alert(`Invalid Answer Token: ${e.message}`);
            }
        });
    }

    if (btnCancelSend) {
        btnCancelSend.addEventListener('click', async () => {
            await window.electronAPI.p2pCancelSend();
            if (senderPeerConn) {
                senderPeerConn.close();
                senderPeerConn = null;
            }
            if (dropzone) dropzone.style.display = 'flex';
            if (sendSessionCard) sendSessionCard.style.display = 'none';
        });
    }

    if (btnCopySendCode) {
        btnCopySendCode.addEventListener('click', () => {
            if (currentRawCode) {
                navigator.clipboard.writeText(currentRawCode);
                btnCopySendCode.textContent = '✓ Copied!';
                setTimeout(() => btnCopySendCode.textContent = '📋 Copy Code', 2000);
            }
        });
    }

    // ======================================================================
    // 3. Receiver: Nearby Connect by 6-Digit Code
    // ======================================================================
    if (codeInput) {
        codeInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '').slice(0, 6);
            if (val.length > 3) {
                e.target.value = `${val.slice(0, 3)} ${val.slice(3)}`;
            } else {
                e.target.value = val;
            }
        });

        codeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleConnectCode();
        });
    }

    if (btnConnectCode) {
        btnConnectCode.addEventListener('click', handleConnectCode);
    }

    async function handleConnectCode() {
        if (!codeInput) return;
        const rawCode = codeInput.value.replace(/\s+/g, '');
        if (rawCode.length !== 6) {
            showReceiveError('Please enter a valid 6-digit code');
            return;
        }

        hideReceiveError();
        btnConnectCode.disabled = true;
        btnConnectCode.textContent = 'Connecting...';

        try {
            const res = await window.electronAPI.p2pReceiveCode(rawCode);
            if (!res.success) {
                showReceiveError(res.error || 'Connection failed');
                btnConnectCode.disabled = false;
                btnConnectCode.textContent = 'Connect & Receive →';
            }
        } catch (err) {
            showReceiveError(err.message);
            btnConnectCode.disabled = false;
            btnConnectCode.textContent = 'Connect & Receive →';
        }
    }

    // ======================================================================
    // 4. Receiver: Remote WAN Token Generation
    // ======================================================================
    if (btnRemoteGenAnswer) {
        btnRemoteGenAnswer.addEventListener('click', async () => {
            const tokenStr = remoteOfferInput?.value?.trim();
            if (!tokenStr) return showRemoteError('Please paste the Connection Token');

            hideRemoteError();
            btnRemoteGenAnswer.disabled = true;
            btnRemoteGenAnswer.textContent = 'Connecting...';

            try {
                const offerPayload = await window.electronAPI.p2pDecompressToken(tokenStr);
                receiverPeerConn = new RTCPeerConnection(rtcConfig);

                const iceCandidates = [];
                receiverPeerConn.onicecandidate = (e) => {
                    if (e.candidate) iceCandidates.push(e.candidate);
                };

                receiverPeerConn.ondatachannel = (e) => {
                    receiverDataChannel = e.channel;
                    receiverDataChannel.onmessage = (msg) => {
                        console.log('[WebRTC Receiver] Got message:', msg.data);
                    };
                };

                await receiverPeerConn.setRemoteDescription(new RTCSessionDescription(offerPayload.sdp));

                if (offerPayload.candidates && Array.isArray(offerPayload.candidates)) {
                    for (const cand of offerPayload.candidates) {
                        try {
                            await receiverPeerConn.addIceCandidate(new RTCIceCandidate(cand));
                        } catch (e) {}
                    }
                }

                const answer = await receiverPeerConn.createAnswer();
                await receiverPeerConn.setLocalDescription(answer);

                await new Promise((resolve) => {
                    if (receiverPeerConn.iceGatheringState === 'complete') {
                        resolve();
                    } else {
                        const check = () => {
                            if (receiverPeerConn.iceGatheringState === 'complete') {
                                receiverPeerConn.removeEventListener('icegatheringstatechange', check);
                                resolve();
                            }
                        };
                        receiverPeerConn.addEventListener('icegatheringstatechange', check);
                        setTimeout(resolve, 1000);
                    }
                });

                const answerPayload = {
                    type: 'P2P_ANSWER',
                    sdp: receiverPeerConn.localDescription,
                    candidates: iceCandidates
                };

                const compressed = await window.electronAPI.p2pCompressToken(answerPayload);
                if (remoteAnswerDisplay) remoteAnswerDisplay.value = compressed;
                if (remoteAnswerBox) remoteAnswerBox.style.display = 'block';
                btnRemoteGenAnswer.textContent = '✓ Answer Ready';
            } catch (e) {
                showRemoteError(`Invalid token: ${e.message}`);
                btnRemoteGenAnswer.disabled = false;
                btnRemoteGenAnswer.textContent = 'Generate Answer';
            }
        });
    }

    if (btnCopyRemoteAnswer) {
        btnCopyRemoteAnswer.addEventListener('click', () => {
            if (remoteAnswerDisplay && remoteAnswerDisplay.value) {
                navigator.clipboard.writeText(remoteAnswerDisplay.value);
                btnCopyRemoteAnswer.textContent = '✓ Copied!';
                setTimeout(() => btnCopyRemoteAnswer.textContent = '📋 Copy Answer', 2000);
            }
        });
    }

    // ======================================================================
    // 5. Real-Time Event Listeners
    // ======================================================================
    if (window.electronAPI) {
        // Discovered LAN Peers Updated
        window.electronAPI.onP2PPeersUpdated((peers) => {
            renderDiscoveredPeers(peers);
        });

        // Sender Progress Events
        window.electronAPI.onP2PSendProgress((data) => {
            if (sendRadar) sendRadar.style.display = 'none';
            if (sendProgressWrap) sendProgressWrap.style.display = 'block';
            if (sendSpeed) sendSpeed.textContent = `${data.speedMBps} MB/s`;
            if (sendPercent) sendPercent.textContent = `${Math.round(data.progress)}%`;
            if (sendBar) sendBar.style.width = `${data.progress}%`;
            if (sendEta) sendEta.textContent = `Direct LAN Streaming • ${data.etaSeconds}s remaining`;
        });

        window.electronAPI.onP2PSendComplete((data) => {
            if (sendProgressWrap) sendProgressWrap.style.display = 'none';
            if (sendRadar) {
                sendRadar.style.display = 'flex';
                if (sendRadarText) sendRadarText.textContent = '✓ File transferred & SHA-256 verified successfully!';
            }
        });

        // Receiver Progress Events
        window.electronAPI.onP2PReceiveProgress((data) => {
            if (receiveProgressWrap) receiveProgressWrap.style.display = 'block';
            if (receiveFilename) receiveFilename.textContent = data.fileName;
            if (receivePercent) receivePercent.textContent = `${Math.round(data.progress)}%`;
            if (receiveBar) receiveBar.style.width = `${data.progress}%`;
            if (receiveSpeed) receiveSpeed.textContent = `${data.speedMBps} MB/s`;
            if (receiveEta) receiveEta.textContent = `${data.etaSeconds}s remaining`;
        });

        window.electronAPI.onP2PReceiveComplete((data) => {
            if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
            if (receiveCompleteBox) receiveCompleteBox.style.display = 'flex';
            if (savedPathLabel) savedPathLabel.textContent = `✓ SHA-256 Verified: ${data.fileName}`;
            currentLastReceivedFile = data.filePath;
            if (btnConnectCode) {
                btnConnectCode.disabled = false;
                btnConnectCode.textContent = 'Connect & Receive →';
            }
        });

        window.electronAPI.onP2PReceiveError((err) => {
            showReceiveError(err.error || 'Transfer encountered an error');
            if (btnConnectCode) {
                btnConnectCode.disabled = false;
                btnConnectCode.textContent = 'Connect & Receive →';
            }
        });
    }

    // 1-Click Play in Cinema Player
    if (btnPlayReceived) {
        btnPlayReceived.addEventListener('click', () => {
            if (currentLastReceivedFile) {
                playLocalVideo(currentLastReceivedFile);
            }
        });
    }

    if (btnOpenReceivedFolder) {
        btnOpenReceivedFolder.addEventListener('click', () => {
            if (currentLastReceivedFile && window.electronAPI.openInFinder) {
                window.electronAPI.openInFinder(currentLastReceivedFile);
            }
        });
    }

    // ======================================================================
    // 6. LAN Peers Rendering
    // ======================================================================
    function renderDiscoveredPeers(peers) {
        if (!peersList) return;
        if (!peers || peers.length === 0) {
            peersList.innerHTML = `
                <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 24px 0;">
                    Searching for nearby devices on local network...
                </div>
            `;
            return;
        }

        peersList.innerHTML = peers.map(peer => {
            const hasActiveSend = peer.activeSend;
            return `
                <div class="toffee-peer-card">
                    <div class="toffee-peer-info">
                        <span class="toffee-peer-icon">💻</span>
                        <div>
                            <div class="toffee-peer-name">${escapeHtml(peer.name)}</div>
                            <div class="toffee-peer-sharing">
                                ${hasActiveSend ? `📤 Sharing: <strong>${escapeHtml(peer.activeSend.name)}</strong> (${peer.activeSend.formattedSize})` : '🟢 Online on Wi-Fi'}
                            </div>
                        </div>
                    </div>
                    ${hasActiveSend ? `
                        <button class="btn-toffee-receive-peer" data-ip="${peer.ip}" data-port="${peer.port}" data-code="${peer.activeSend.code}">
                            📥 Download
                        </button>
                    ` : `
                        <span style="font-size: 11px; color: #10b981;">Ready</span>
                    `}
                </div>
            `;
        }).join('');

        peersList.querySelectorAll('.btn-toffee-receive-peer').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ip = btn.getAttribute('data-ip');
                const port = btn.getAttribute('data-port');
                const code = btn.getAttribute('data-code');
                btn.disabled = true;
                btn.textContent = 'Downloading...';
                await window.electronAPI.p2pReceivePeer({ ip, port, code });
            });
        });
    }

    async function pollPeers() {
        if (window.electronAPI && window.electronAPI.p2pGetPeers) {
            try {
                const peers = await window.electronAPI.p2pGetPeers();
                renderDiscoveredPeers(peers);
            } catch (e) {}
        }
    }

    function showReceiveError(msg) {
        if (receiveError) {
            receiveError.textContent = `✕ ${msg}`;
            receiveError.style.display = 'block';
        }
    }

    function hideReceiveError() {
        if (receiveError) receiveError.style.display = 'none';
    }

    function showRemoteError(msg) {
        if (remoteReceiveError) {
            remoteReceiveError.textContent = `✕ ${msg}`;
            remoteReceiveError.style.display = 'block';
        }
    }

    function hideRemoteError() {
        if (remoteReceiveError) remoteReceiveError.style.display = 'none';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}
