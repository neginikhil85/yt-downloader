// ==========================================================================
// YT Studio Pro — P2P Nearby Devices Radar Component
// ==========================================================================

export function initP2PRadarView(options = {}) {
    const { onSelectPeer = () => {} } = options;
    const peersList = document.getElementById('toffee-peers-list');
    const countEl = document.getElementById('ds-peers-count');

    let lastRenderedHash = '';
    function renderPeers(peers) {
        if (!peersList) return;
        const currentHash = JSON.stringify(peers || []);
        if (currentHash === lastRenderedHash) return;
        lastRenderedHash = currentHash;

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
            const fileName = hasActiveSend ? (peer.activeSend.name || peer.activeSend.file?.name || 'File') : '';
            const fileSize = hasActiveSend ? (peer.activeSend.formattedSize || peer.activeSend.file?.formattedSize || '') : '';
            const token = hasActiveSend ? (peer.activeSend.token || '') : '';
            const code = hasActiveSend ? (peer.activeSend.code || '') : '';

            return `
                <div class="toffee-peer-card">
                    <div class="toffee-peer-info">
                        <div class="toffee-peer-icon-box">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        </div>
                        <div>
                            <div class="toffee-peer-name">${escapeHtml(peer.name)}</div>
                            <div class="toffee-peer-sharing">
                                ${hasActiveSend ? `Sharing: <strong>${escapeHtml(fileName)}</strong> (${fileSize})` : 'Online on Wi-Fi'}
                            </div>
                        </div>
                    </div>
                    ${hasActiveSend ? `
                        <button class="btn-toffee-receive-peer"
                            data-ip="${peer.ip}"
                            data-port="${peer.port || 9876}"
                            data-code="${code}"
                            data-token="${token}"
                            data-name="${escapeHtml(fileName)}"
                            data-size="${fileSize}">
                            Download
                        </button>
                    ` : `
                        <span style="font-size: 11px; color: var(--text-muted);">Ready</span>
                    `}
                </div>
            `;
        }).join('');

        peersList.querySelectorAll('.btn-toffee-receive-peer').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ip = btn.getAttribute('data-ip');
                const port = parseInt(btn.getAttribute('data-port'), 10) || 9876;
                const code = btn.getAttribute('data-code');
                const token = btn.getAttribute('data-token');
                const name = btn.getAttribute('data-name');
                const size = btn.getAttribute('data-size');

                if (onSelectPeer) {
                    onSelectPeer({
                        ip,
                        port,
                        code,
                        token,
                        file: { name, formattedSize: size }
                    });
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
