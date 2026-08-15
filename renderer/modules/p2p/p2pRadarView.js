// ==========================================================================
// YT Studio Pro — Authentic Circular Radar Visualizer
// Positions discovered peers as circular avatar nodes across the radar disc
// ==========================================================================

export function initP2PRadarView(options = {}) {
    const { onSelectPeer = () => {} } = options;
    const peersList = document.getElementById('toffee-peers-list');
    const countEl = document.getElementById('ds-peers-count');

    let localInfo = null;
    let lastRenderedHash = '';

    // Cache local device information to strictly avoid showing self
    if (window.electronAPI && window.electronAPI.p2pGetLocalInfo) {
        window.electronAPI.p2pGetLocalInfo().then(info => {
            localInfo = info;
        }).catch(() => {});
    }

    // Radar coordinate anchors (percentage from center of radar disc)
    // Matches the reference design with peer in upper-left quadrant
    const RADAR_ANCHORS = [
        { top: '25%', left: '26%' }, // Primary Upper-Left quadrant
        { top: '25%', left: '74%' }, // Upper-Right quadrant
        { top: '75%', left: '26%' }, // Lower-Left quadrant
        { top: '75%', left: '74%' }, // Lower-Right quadrant
        { top: '50%', left: '16%' }, // Far Left
        { top: '50%', left: '84%' }  // Far Right
    ];

    // Harmonious avatar backgrounds
    const AVATAR_COLORS = [
        'linear-gradient(135deg, #0284c7, #0369a1)',
        'linear-gradient(135deg, #8b5cf6, #6d28d9)',
        'linear-gradient(135deg, #ec4899, #be185d)',
        'linear-gradient(135deg, #10b981, #047857)',
        'linear-gradient(135deg, #f59e0b, #b45309)'
    ];

    function renderPeers(rawPeers) {
        if (!peersList) return;

        // Strictly filter out self / local device
        const peers = (rawPeers || []).filter(p => {
            if (!p) return false;
            if (localInfo) {
                if (p.id && p.id === localInfo.peerId) return false;
                if (p.name && p.name === localInfo.name) return false;
                if (p.ip && (p.ip === localInfo.localIp || p.ip === '127.0.0.1' || p.ip === 'localhost')) return false;
            }
            return true;
        });

        const currentHash = JSON.stringify(peers);
        if (currentHash === lastRenderedHash) return;
        lastRenderedHash = currentHash;

        if (countEl) countEl.textContent = `${peers.length} nearby`;

        if (peers.length === 0) {
            peersList.innerHTML = `
                <div class="ds-radar-scanning-indicator">
                    <span>Scanning nearby devices...</span>
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
            if (idx < RADAR_ANCHORS.length) {
                const pos = RADAR_ANCHORS[idx];
                posStyle = `top: ${pos.top}; left: ${pos.left};`;
            } else {
                const angle = (idx * (2 * Math.PI / peers.length)) - (Math.PI / 2);
                const r = 35; // % distance from center
                const left = Math.round(50 + r * Math.cos(angle));
                const top = Math.round(50 + r * Math.sin(angle));
                posStyle = `top: ${top}%; left: ${left}%;`;
            }

            const avatarBg = AVATAR_COLORS[idx % AVATAR_COLORS.length];

            return `
                <div class="ds-peer-circle-node"
                    style="${posStyle}"
                    data-ip="${peer.ip}"
                    data-port="${peer.port || 9876}"
                    data-code="${code}"
                    data-token="${token}"
                    data-name="${escapeHtml(peer.name)}"
                    data-size="${fileSize}"
                    data-filename="${escapeHtml(fileName)}"
                    data-has-send="${hasActiveSend ? '1' : '0'}"
                    title="${escapeHtml(peer.name)}${hasActiveSend ? ` (Sharing: ${escapeHtml(fileName)})` : ''}">
                    <div class="ds-peer-avatar-circle" style="background: ${avatarBg};">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        ${hasActiveSend ? '<span class="ds-peer-sharing-badge"></span>' : ''}
                    </div>
                    <span class="ds-peer-circle-name">${escapeHtml(peer.name)}</span>
                    ${hasActiveSend ? `<span class="ds-peer-active-file-tag">⬇ ${escapeHtml(fileName)}</span>` : ''}
                </div>
            `;
        }).join('');

        // Wire click handler on peer avatar nodes
        peersList.querySelectorAll('.ds-peer-circle-node').forEach(node => {
            node.addEventListener('click', (e) => {
                e.stopPropagation();
                const ip = node.getAttribute('data-ip');
                const port = parseInt(node.getAttribute('data-port'), 10) || 9876;
                const code = node.getAttribute('data-code');
                const token = node.getAttribute('data-token');
                const name = node.getAttribute('data-name');
                const size = node.getAttribute('data-size');
                const hasSend = node.getAttribute('data-has-send') === '1';

                if (hasSend && onSelectPeer) {
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
