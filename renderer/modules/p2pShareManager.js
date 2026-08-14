// ==========================================================================
// YT Studio Pro — Master Direct P2P Share Coordinator
// Modular architecture coordinating Radar, Sender, and Receiver components
// ==========================================================================

import { initP2PRadarView } from './p2p/p2pRadarView.js';
import { initP2PSendController } from './p2p/p2pSendController.js';
import { initP2PReceiveController } from './p2p/p2pReceiveController.js';

export function initP2PShareManager() {
    const btnModeSend = document.getElementById('btn-mode-send');
    const btnModeReceive = document.getElementById('btn-mode-receive');
    const sendPanel = document.getElementById('toffee-send-panel');
    const receivePanel = document.getElementById('toffee-receive-panel');

    // Initialize sub-controllers
    const radarView = initP2PRadarView();
    const sendController = initP2PSendController();
    const receiveController = initP2PReceiveController();

    // Mode Switching (Send vs Receive)
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

    // Real-Time Event Listeners from Electron Main Process
    if (window.electronAPI) {
        window.electronAPI.onP2PPeersUpdated((peers) => {
            radarView.renderPeers(peers);
        });

        window.electronAPI.onP2PSendProgress((data) => {
            sendController.onSendProgress(data);
        });

        window.electronAPI.onP2PReceiveProgress((data) => {
            receiveController.onReceiveProgress(data);
        });

        window.electronAPI.onP2PReceiveComplete((data) => {
            receiveController.onReceiveComplete(data);
        });

        window.electronAPI.onP2PReceiveError((data) => {
            receiveController.onReceiveError(data);
        });
    }

    async function pollPeers() {
        if (window.electronAPI && window.electronAPI.p2pGetPeers) {
            try {
                const peers = await window.electronAPI.p2pGetPeers();
                radarView.renderPeers(peers);
            } catch (e) {}
        }
    }

    // Fetch initial local info & active peers on startup
    if (window.electronAPI && window.electronAPI.p2pGetLocalInfo) {
        window.electronAPI.p2pGetLocalInfo().then(info => {
            if (info) {
                const ipEl = document.getElementById('ds-local-ip');
                const devEl = document.getElementById('ds-local-device-name');
                if (ipEl && info.localIp) ipEl.textContent = `${info.localIp}:${info.port}`;
                if (devEl && info.name) devEl.textContent = info.name;
            }
        }).catch(() => {});
    }

    pollPeers();
}
