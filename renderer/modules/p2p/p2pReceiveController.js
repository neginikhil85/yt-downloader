// ==========================================================================
// YT Studio Pro — P2P Receiver Controller
// ==========================================================================

import { playLocalVideo } from '../videoPlayer.js';

export function initP2PReceiveController() {
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

    let currentLastReceivedFile = null;

    // PIN Input formatting: "123 456"
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
            showError('Please enter a valid 6-digit PIN');
            return;
        }

        hideError();
        if (receiveCompleteBox) receiveCompleteBox.style.display = 'none';
        btnConnectCode.disabled = true;
        btnConnectCode.textContent = 'Connecting...';

        try {
            const res = await window.electronAPI.p2pReceiveCode(rawCode);
            if (!res.success) {
                showError(res.error || 'Connection failed');
                btnConnectCode.disabled = false;
                btnConnectCode.textContent = 'Connect & Receive';
                return;
            }

            if (receiveProgressWrap) receiveProgressWrap.style.display = 'block';
            if (receiveFilename) receiveFilename.textContent = `Connecting to ${res.file.name}...`;
        } catch (err) {
            showError(err.message);
            btnConnectCode.disabled = false;
            btnConnectCode.textContent = 'Connect & Receive';
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
        if (btnConnectCode) {
            btnConnectCode.disabled = false;
            btnConnectCode.textContent = 'Connect & Receive';
        }
        if (receiveProgressWrap) receiveProgressWrap.style.display = 'none';
        if (receiveCompleteBox) receiveCompleteBox.style.display = 'flex';
        if (savedPathLabel) savedPathLabel.textContent = `Saved: ${data.fileName}`;
    }

    function onReceiveError(data) {
        if (btnConnectCode) {
            btnConnectCode.disabled = false;
            btnConnectCode.textContent = 'Connect & Receive';
        }
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

    // Play Received Video in Cinema Player
    if (btnPlayReceived) {
        btnPlayReceived.addEventListener('click', () => {
            if (currentLastReceivedFile) {
                playLocalVideo(currentLastReceivedFile);
            }
        });
    }

    // Open Received Folder in Finder / Explorer
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
