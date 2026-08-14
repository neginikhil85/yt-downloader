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
                        <div class="toffee-peer-icon-box">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        </div>
                        <div>
                            <div class="toffee-peer-name">${escapeHtml(peer.name)}</div>
                            <div class="toffee-peer-sharing">
                                ${hasActiveSend ? `Sharing: <strong>${escapeHtml(peer.activeSend.name)}</strong> (${peer.activeSend.formattedSize})` : 'Online on Wi-Fi'}
                            </div>
                        </div>
                    </div>
                    ${hasActiveSend ? `
                        <button class="btn-toffee-receive-peer" data-ip="${peer.ip}" data-port="${peer.port}" data-code="${peer.activeSend.code}">
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
                const port = btn.getAttribute('data-port');
                const code = btn.getAttribute('data-code');

                // Switch to Receive tab and populate input
                const btnModeReceive = document.getElementById('btn-mode-receive');
                const tokenInput = document.getElementById('toffee-receive-code-input');
                const btnConnectCode = document.getElementById('btn-connect-code');

                if (btnModeReceive) btnModeReceive.click();
                if (tokenInput) {
                    tokenInput.value = code;
                }
                if (btnConnectCode) {
                    btnConnectCode.click();
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
