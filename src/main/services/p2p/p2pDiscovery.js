// ==========================================================================
// YT Studio Pro — P2P Local LAN Zero-Config UDP Discovery
// Multicast + Broadcast on port 9877
// ==========================================================================

const dgram = require('dgram');
const { getLocalIpAddresses, getPrimaryIp } = require('./p2pUtils');

const UDP_PORT = 9877;
const MULTICAST_ADDR = '239.255.255.250';

let udpSocket = null;
let broadcastTimer = null;
let pruneTimer = null;
const discoveredPeers = new Map();

function startDiscoverySocket(options = {}) {
    if (udpSocket) return;

    const {
        localPeerId,
        localDeviceName,
        getHttpPort = () => 9876,
        getActiveSend = () => null,
        onPeersUpdated = () => {}
    } = options;

    udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    udpSocket.on('error', (err) => {
        console.warn('[P2P Discovery Socket] Warning:', err.message);
    });

    udpSocket.on('message', (msg, rinfo) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'P2P_LAN_BEACON' && data.peerId !== localPeerId) {
                const peerKey = data.peerId;
                const wasSharing = discoveredPeers.get(peerKey)?.activeSend?.code;
                const nowSharing = data.activeSend?.code;

                discoveredPeers.set(peerKey, {
                    id: data.peerId,
                    name: data.name,
                    ip: rinfo.address,
                    port: data.port || 9876,
                    activeSend: data.activeSend,
                    lastSeen: Date.now()
                });

                if (wasSharing !== nowSharing || !discoveredPeers.has(peerKey)) {
                    onPeersUpdated(getDiscoveredPeers());
                }
            }
        } catch (e) {}
    });

    udpSocket.bind(UDP_PORT, () => {
        try {
            udpSocket.addMembership(MULTICAST_ADDR);
            udpSocket.setBroadcast(true);
            udpSocket.setMulticastTTL(128);
        } catch (e) {
            console.warn('[P2P Discovery] Multicast membership error:', e.message);
        }
    });

    // Broadcast heartbeat every 3.5 seconds
    broadcastTimer = setInterval(() => {
        broadcastDiscovery({ localPeerId, localDeviceName, getHttpPort, getActiveSend });
    }, 3500);

    // Initial broadcast
    broadcastDiscovery({ localPeerId, localDeviceName, getHttpPort, getActiveSend });

    // Prune inactive peers (unseen for > 10 seconds)
    pruneTimer = setInterval(() => {
        const now = Date.now();
        let changed = false;
        for (const [key, peer] of discoveredPeers.entries()) {
            if (now - peer.lastSeen > 10000) {
                discoveredPeers.delete(key);
                changed = true;
            }
        }
        if (changed) {
            onPeersUpdated(getDiscoveredPeers());
        }
    }, 5000);
}

function broadcastDiscovery({ localPeerId, localDeviceName, getHttpPort, getActiveSend }) {
    if (!udpSocket) return;

    try {
        const packet = JSON.stringify({
            type: 'P2P_LAN_BEACON',
            peerId: localPeerId,
            name: localDeviceName,
            port: getHttpPort ? getHttpPort() : 9876,
            activeSend: getActiveSend ? getActiveSend() : null,
            time: Date.now()
        });

        const buf = Buffer.from(packet);
        udpSocket.send(buf, 0, buf.length, UDP_PORT, MULTICAST_ADDR, () => {});
        udpSocket.send(buf, 0, buf.length, UDP_PORT, '255.255.255.255', () => {});
    } catch (e) {}
}

function stopDiscoverySocket() {
    if (broadcastTimer) {
        clearInterval(broadcastTimer);
        broadcastTimer = null;
    }
    if (pruneTimer) {
        clearInterval(pruneTimer);
        pruneTimer = null;
    }
    if (udpSocket) {
        try {
            udpSocket.close();
        } catch (e) {}
        udpSocket = null;
    }
    discoveredPeers.clear();
}

function getDiscoveredPeers() {
    return Array.from(discoveredPeers.values());
}

module.exports = {
    startDiscoverySocket,
    broadcastDiscovery,
    stopDiscoverySocket,
    getDiscoveredPeers
};
