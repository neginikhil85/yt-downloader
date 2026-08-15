// ==========================================================================
// YT Studio Pro — Dynamic Circular Radar Visualizer Component
// Positions discovered peers across the animated radar canvas with 1-tap download
// ==========================================================================

export function initP2PRadarView(options = {}) {
    const { onSelectPeer = () => {} } = options;
    const peersList = document.getElementById('toffee-peers-list');
    const countEl = document.getElementById('ds-peers-count');
    const hostLabel = document.getElementById('ds-local-device-name');

    // Fetch and display local device name
    if (window.electronAPI && window.electronAPI.p2pGetLocalInfo && hostLabel) {
        window.electronAPI.p2pGetLocalInfo().then(info => {
            if (info && info.name) {
                hostLabel.textContent = info.name;
            }
        }).catch(() => {});
    }

    let lastRenderedHash = '';

    // Fixed pleasant anchor positions for up to 6 peers, with math fallback for more
    const ANCHOR_POSITIONS = [
        { top: '22px', left: '24px' },
        { top: '22px', right: '24px' },
        { bottom: '22px', left: '24px' },
        { bottom: '22px', right: '24px' },
        { top: '105px', left: '16px' },
        { top: '105px', right: '16px' }
    ];

    function renderPeers(peers) {
        if (!peersList) return;
        const currentHash = JSON.stringify(peers || []);
        if (currentHash === lastRenderedHash) return;
        lastRenderedHash = currentHash;

        if (countEl) countEl.textContent = `${peers ? peers.length : 0} nearby`;

        if (!peers || peers.length === 0) {
            peersList.innerHTML = `
                <div class="ds-radar-empty-state">
                    <span>Scanning Wi-Fi network for nearby devices...</span>
                </div>
            `;
            return;
        }

        peersList.innerHTML = peers.map((peer, idx) => {
            const hasActiveSend = !!peer.activeSend;
            const fileName = hasActiveSend ? (peer.activeSend.name || peer.activeSend.file?.name || 'File') : '';
            const fileSize = hasActiveSend ? (peer.activeSend.formattedSize || peer.activeSend.file?.formattedSize || '') : '';
            const token = hasActiveSend ? (peer.activeSend.token || '') : '';
            const code = hasActiveSend ? (peer.activeSend.code || '') : '';

            // Position calculation
            let posStyle = '';
            if (idx < ANCHOR_POSITIONS.length) {
                const pos = ANCHOR_POSITIONS[idx];
                posStyle = Object.entries(pos).map(([k, v]) => `${k}: ${v}`).join('; ');
            } else {
                const angle = (idx * (2 * Math.PI / peers.length)) - (Math.PI / 2);
                const r = 90; // px from center
                const left = Math.round(50 + (r / 3) * Math.cos(angle));
                const top = Math.round(50 + (r / 3) * Math.sin(angle));
                posStyle = `top: ${top}%; left: ${left}%; transform: translate(-50%, -50%);`;
            }

            // Floating animation delay offset
            const animDelay = (idx * 0.4).toFixed(1);

            return `
                <div class="ds-radar-peer-node" style="${posStyle}; animation-delay: ${animDelay}s;">
                    <div class="ds-radar-peer-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                    </div>
                    <div class="ds-radar-peer-info">
                        <span class="ds-radar-peer-name" title="${escapeHtml(peer.name)}">${escapeHtml(peer.name)}</span>
                        <span class="ds-radar-peer-status">
                            ${hasActiveSend ? `Sharing: <strong>${escapeHtml(fileName)}</strong> (${fileSize})` : 'Online on Wi-Fi'}
                        </span>
                    </div>
                    ${hasActiveSend ? `
                        <button class="btn-radar-peer-download"
                            data-ip="${peer.ip}"
                            data-port="${peer.port || 9876}"
                            data-code="${code}"
                            data-token="${token}"
                            data-name="${escapeHtml(fileName)}"
                            data-size="${fileSize}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                            <span>Download</span>
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Wire 1-tap download buttons
        peersList.querySelectorAll('.btn-radar-peer-download').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
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
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return {
        renderPeers
    };
}
