// ==========================================================================
// YT Studio Pro — P2P Nearby Devices Radar Component
// ==========================================================================

export function initP2PRadarView() {
    const peersList = document.getElementById('toffee-peers-list');
    const countEl = document.getElementById('ds-peers-count');

    function renderPeers(peers) {
        if (!peersList) return;
        if (countEl) countEl.textContent = `${peers ? peers.length : 0} nearby`;

        if (!peers || peers.length === 0) {
            peersList.innerHTML = `
                <div class="ds-radar-searching">
                    <span class="ds-radar-pulse-ring"></span>
                    <span>Scanning local network for other devices...</span>
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
                        <span style="font-size: 11px; color: #34d399;">Ready</span>
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
                if (window.electronAPI && window.electronAPI.p2pReceivePeer) {
                    await window.electronAPI.p2pReceivePeer({ ip, port, code });
                }
            });
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return {
        renderPeers
    };
}
