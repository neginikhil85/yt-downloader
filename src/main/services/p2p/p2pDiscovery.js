// ==========================================================================
// YT Studio Pro — Bulletproof Dual-Engine LAN Discovery
// 1. Multi-Interface UDP Broadcast + Multicast (Port 9877)
// 2. High-Speed Parallel HTTP Subnet Scanner & PIN Prober (Port 9876)
// ==========================================================================

const dgram = require('dgram');
const http = require('http');
const { localPeerId, localDeviceName, getNetworkInterfaceConfigs, getLocalIpAddresses } = require('./p2pUtils');

const UDP_PORT = 9877;
const MULTICAST_ADDR = '239.255.255.250';

let udpSocket = null;
let broadcastTimer = null;
let pruneTimer = null;
let httpSweepTimer = null;
const discoveredPeers = new Map();

function startDiscoverySocket(options = {}) {
    const {
        getHttpPort = () => 9876,
        getActiveSend = () => null,
        onPeersUpdated = () => {}
    } = options;

    // --- Engine 1: UDP Broadcast & Multicast ---
    try {
        udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        udpSocket.on('error', (err) => {
            console.warn('[P2P UDP Socket] Warning:', err.message);
        });

        udpSocket.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.type === 'P2P_LAN_BEACON' && data.peerId !== localPeerId) {
                    registerPeer(data.peerId, {
                        id: data.peerId,
                        name: data.name,
                        ip: rinfo.address,
                        port: data.port || 9876,
                        activeSend: data.activeSend,
                        lastSeen: Date.now()
                    }, onPeersUpdated);
                }
            } catch (e) {}
        });

        udpSocket.bind(UDP_PORT, () => {
            try {
                udpSocket.addMembership(MULTICAST_ADDR);
            } catch (e) {}
            try {
                udpSocket.setBroadcast(true);
                udpSocket.setMulticastTTL(128);
            } catch (e) {}
        });
    } catch (err) {
        console.warn('[P2P Discovery] UDP init failed, relying on HTTP engine:', err.message);
    }

    // Broadcast UDP heartbeat every 3 seconds
    broadcastTimer = setInterval(() => {
        broadcastDiscovery({ getHttpPort, getActiveSend });
    }, 3000);

    // Initial broadcast
    broadcastDiscovery({ getHttpPort, getActiveSend });

    // --- Engine 2: Active HTTP Subnet Scanner (Bypasses all router multicast blocks) ---
    sweepSubnetForPeers({ getHttpPort, onPeersUpdated });
    httpSweepTimer = setInterval(() => {
        sweepSubnetForPeers({ getHttpPort, onPeersUpdated });
    }, 3500);

    // Prune stale peers (unseen for > 6.5 seconds)
    pruneTimer = setInterval(() => {
        const now = Date.now();
        let changed = false;
        for (const [key, peer] of discoveredPeers.entries()) {
            if (now - peer.lastSeen > 6500) {
                discoveredPeers.delete(key);
                changed = true;
            }
        }
        if (changed) {
            onPeersUpdated(getDiscoveredPeers());
        }
    }, 2500);
}

function registerPeer(peerId, peerData, onPeersUpdated) {
    if (!peerId || peerId === localPeerId) return;

    const existing = discoveredPeers.get(peerId);
    const wasSharing = existing?.activeSend?.code;
    const nowSharing = peerData.activeSend?.code;

    discoveredPeers.set(peerId, peerData);

    if (!existing || wasSharing !== nowSharing) {
        onPeersUpdated(getDiscoveredPeers());
    }
}

function broadcastDiscovery({ getHttpPort, getActiveSend }) {
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
        const configs = getNetworkInterfaceConfigs();

        // 1. Multicast group
        udpSocket.send(buf, 0, buf.length, UDP_PORT, MULTICAST_ADDR, () => {});

        // 2. Global broadcast
        udpSocket.send(buf, 0, buf.length, UDP_PORT, '255.255.255.255', () => {});

        // 3. Interface-specific subnet broadcasts (e.g. 192.168.1.255)
        for (const conf of configs) {
            if (conf.broadcast) {
                udpSocket.send(buf, 0, buf.length, UDP_PORT, conf.broadcast, () => {});
            }
        }
    } catch (e) {}
}

/**
 * Sweeps the local /24 subnet over HTTP port 9876 /api/p2p/info
 * Discovers peers even when UDP broadcast is 100% blocked on the router.
 */
async function sweepSubnetForPeers({ getHttpPort, onPeersUpdated }) {
    const configs = getNetworkInterfaceConfigs();
    const localIps = new Set(configs.map(c => c.address));

    for (const conf of configs) {
        const prefix = conf.subnetPrefix;
        if (!prefix) continue;

        // Generate 1..254 IP list
        const ipsToScan = [];
        for (let i = 1; i <= 254; i++) {
            const targetIp = `${prefix}.${i}`;
            if (!localIps.has(targetIp)) {
                ipsToScan.push(targetIp);
            }
        }

        // Scan in batches of 40 for ultra-fast discovery without socket saturation
        const batchSize = 40;
        for (let i = 0; i < ipsToScan.length; i += batchSize) {
            const batch = ipsToScan.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(ip => checkPeerHttp(ip, onPeersUpdated)));
        }
    }
}

function checkPeerHttp(ip, onPeersUpdated) {
    return new Promise((resolve) => {
        const req = http.get(`http://${ip}:9876/api/p2p/info`, { timeout: 700 }, (res) => {
            if (res.statusCode === 200) {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.peerId && json.peerId !== localPeerId) {
                            registerPeer(json.peerId, {
                                id: json.peerId,
                                name: json.name,
                                ip: ip,
                                port: 9876,
                                activeSend: json.activeSend,
                                lastSeen: Date.now()
                            }, onPeersUpdated);
                        }
                    } catch (e) {}
                    resolve();
                });
            } else {
                resolve();
            }
        });

        req.on('error', () => resolve());
        req.on('timeout', () => {
            req.destroy();
            resolve();
        });
    });
}

/**
 * Searches the local subnet in parallel for a specific 6-digit PIN code
 */
async function findPeerByTransferCode(code) {
    // 1. Check memory cache first
    const peers = getDiscoveredPeers();
    const cached = peers.find(p => p.activeSend && (p.activeSend.code === code || p.activeSend.token === code));
    if (cached) {
        const verified = await probeIpForCode(cached.ip, code);
        if (verified) return verified;
    }

    // 2. Perform parallel HTTP subnet probe
    const configs = getNetworkInterfaceConfigs();
    const localIps = new Set(configs.map(c => c.address));

    for (const conf of configs) {
        const prefix = conf.subnetPrefix;
        if (!prefix) continue;

        const ipsToScan = [];
        for (let i = 1; i <= 254; i++) {
            const targetIp = `${prefix}.${i}`;
            if (!localIps.has(targetIp)) {
                ipsToScan.push(targetIp);
            }
        }

        const probePromises = ipsToScan.map(ip => {
            return new Promise((resolve, reject) => {
                probeIpForCode(ip, code).then(res => {
                    if (res) resolve(res);
                    else reject();
                }).catch(reject);
            });
        });

        try {
            const match = await Promise.any(probePromises);
            if (match) return match;
        } catch (e) {}
    }

    return null;
}

function probeIpForCode(ip, code) {
    return new Promise((resolve) => {
        const req = http.get(`http://${ip}:9876/api/p2p/probe?code=${encodeURIComponent(code)}`, { timeout: 1400 }, (res) => {
            if (res.statusCode === 200) {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.match) {
                            resolve({
                                ip,
                                port: 9876,
                                peerId: json.peerId,
                                name: json.name,
                                file: json.file
                            });
                            return;
                        }
                    } catch (e) {}
                    resolve(null);
                });
            } else {
                resolve(null);
            }
        });

        req.on('error', () => resolve(null));
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
    });
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
    if (httpSweepTimer) {
        clearInterval(httpSweepTimer);
        httpSweepTimer = null;
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
    getDiscoveredPeers,
    findPeerByTransferCode
};
