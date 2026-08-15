// ==========================================================================
// YT Studio Pro — Master Direct P2P Share Coordinator (Unified Architecture)
// Coordinates Sender, Receiver, Radar, and real-time Electron IPC events
// ==========================================================================

import { initP2PRadarView } from './p2p/p2pRadarView.js';
import { initP2PSendController } from './p2p/p2pSendController.js';
import { initP2PReceiveController } from './p2p/p2pReceiveController.js';

export function initP2PShareManager() {
    let currentGlobalState = 'IDLE';

    // Initialize sub-controllers
    const receiveController = initP2PReceiveController({
        onStateChange: (state) => {
            currentGlobalState = state;
        }
    });

    const sendController = initP2PSendController({
        onStateChange: (state) => {
            currentGlobalState = state;
        }
    });

    const radarView = initP2PRadarView({
        onSelectPeer: (peerData) => {
            receiveController.startReceivePeer(peerData);
        }
    });

    // Real-Time Event Listeners from Electron Main Process
    if (window.electronAPI) {
        window.electronAPI.onP2PPeersUpdated((peers) => {
            radarView.renderPeers(peers);
        });

        window.electronAPI.onP2PSendProgress((data) => {
            sendController.onSendProgress(data);
        });

        window.electronAPI.onP2PSendComplete((data) => {
            sendController.onSendComplete(data);
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

    // Refresh when view-share tab is active
    let peerPollTimer = null;
    const shareView = document.getElementById('view-share');
    if (shareView) {
        const observer = new MutationObserver(() => {
            if (shareView.classList.contains('active')) {
                pollPeers();
                if (!peerPollTimer) {
                    peerPollTimer = setInterval(pollPeers, 6000);
                }
            } else {
                if (peerPollTimer) {
                    clearInterval(peerPollTimer);
                    peerPollTimer = null;
                }
            }
        });
        observer.observe(shareView, { attributes: true, attributeFilter: ['class'] });
    }

    pollPeers();
}
