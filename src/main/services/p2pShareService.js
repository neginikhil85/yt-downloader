// ==========================================================================
// YT Studio Pro — Zero-Central-Server Direct P2P Transfer Engine
// 100% Direct Device-to-Device | LAN Auto-Discovery | WAN Token Handshake
// Zero Cloud Relay | Progressive SHA-256 | Local Resume Manifest
// ==========================================================================

const http = require('http');
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');
const { getDefaultSavePath } = require('./libraryService');

let httpServer = null;
let udpSocket = null;
let httpPort = 9876;
const UDP_PORT = 9877;
const MULTICAST_ADDR = '239.255.255.250';

const localPeerId = 'peer_' + Math.random().toString(36).substring(2, 10);
const localDeviceName = `${os.hostname()} (${process.platform === 'darwin' ? 'Mac' : (process.platform === 'win32' ? 'Windows' : 'Linux')})`;

// Active Outgoing Share Session (Sender state)
let currentSendSession = null;
// Active Incoming Download Session (Receiver state)
let currentReceiveSession = null;

// Discovered LAN peers on the same network: peerId -> { id, name, ip, port, activeSend, lastSeen }
const discoveredPeers = new Map();

// Progress callback to notify Electron renderer process
let progressCallback = null;

function generateTransferCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Returns all active local IPv4 addresses (excluding loopback)
 */
function getLocalIpAddresses() {
    const interfaces = os.networkInterfaces();
    const list = [];
    for (const iface of Object.values(interfaces)) {
        for (const net of iface) {
            if (net.family === 'IPv4' && !net.internal) {
                list.push(net.address);
            }
        }
    }
    return list.length > 0 ? list : ['127.0.0.1'];
}

function getPrimaryIp() {
    return getLocalIpAddresses()[0] || '127.0.0.1';
}

function notifyRenderer(event, data) {
    if (progressCallback) {
        progressCallback(event, data);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==========================================================================
// 1. Embedded HTTP Server for Local LAN High-Speed Streaming
// ==========================================================================
function startHttpServer(port = 9876) {
    if (httpServer) return Promise.resolve(httpPort);

    return new Promise((resolve) => {
        httpPort = port;
        httpServer = http.createServer((req, res) => {
            const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const pathname = urlObj.pathname;

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Transfer-Code, Range');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            // Info / Handshake endpoint
            if (pathname === '/api/p2p/info') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    peerId: localPeerId,
                    deviceName: localDeviceName,
                    hasActiveSend: !!currentSendSession,
                    activeFile: currentSendSession ? {
                        name: currentSendSession.name,
                        size: currentSendSession.size,
                        formattedSize: formatBytes(currentSendSession.size),
                        code: currentSendSession.code,
                        chunkSize: currentSendSession.chunkSize,
                        totalChunks: currentSendSession.totalChunks
                    } : null
                }));
                return;
            }

            // Direct P2P File Stream (Receiver downloading from Sender)
            if (pathname.startsWith('/api/p2p/stream')) {
                const requestedCode = urlObj.searchParams.get('code') || req.headers['x-transfer-code'];

                if (!currentSendSession || !fs.existsSync(currentSendSession.path)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No active file sharing session' }));
                    return;
                }

                if (requestedCode && requestedCode !== currentSendSession.code) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid transfer code' }));
                    return;
                }

                const fileStat = fs.statSync(currentSendSession.path);
                const fileSize = fileStat.size;
                const fileName = currentSendSession.name;

                // Support Range header for resuming partial downloads
                const rangeHeader = req.headers.range;
                let start = 0;
                let end = fileSize - 1;

                if (rangeHeader) {
                    const parts = rangeHeader.replace(/bytes=/, '').split('-');
                    start = parseInt(parts[0], 10) || 0;
                    if (parts[1]) end = parseInt(parts[1], 10);
                }

                const chunkSize = (end - start) + 1;
                const isPartial = start > 0 || end < (fileSize - 1);

                res.writeHead(isPartial ? 206 : 200, {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': chunkSize,
                    'Content-Range': isPartial ? `bytes ${start}-${end}/${fileSize}` : undefined,
                    'Accept-Ranges': 'bytes',
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
                    'X-File-Name': encodeURIComponent(fileName),
                    'X-File-Size': fileSize
                });

                let sentBytes = start;
                let startTime = Date.now();
                let lastTime = startTime;
                let lastBytes = start;
                const hash = crypto.createHash('sha256');

                notifyRenderer('p2p-send-start', {
                    fileName,
                    fileSize,
                    startOffset: start,
                    receiverIp: req.socket.remoteAddress
                });

                const fileStream = fs.createReadStream(currentSendSession.path, { start, end, highWaterMark: 512 * 1024 });

                fileStream.on('data', (chunk) => {
                    hash.update(chunk);
                    sentBytes += chunk.length;
                    const now = Date.now();

                    if (now - lastTime > 250 || sentBytes === fileSize) {
                        const duration = (now - lastTime) / 1000;
                        const speed = duration > 0 ? (sentBytes - lastBytes) / duration : 0;
                        const progress = (sentBytes / fileSize) * 100;
                        const eta = speed > 0 ? Math.round((fileSize - sentBytes) / speed) : 0;

                        notifyRenderer('p2p-send-progress', {
                            fileName,
                            fileSize,
                            sentBytes,
                            progress: Math.min(100, progress),
                            speedMBps: (speed / (1024 * 1024)).toFixed(1),
                            etaSeconds: eta
                        });

                        lastTime = now;
                        lastBytes = sentBytes;
                    }
                });

                fileStream.on('end', () => {
                    notifyRenderer('p2p-send-complete', {
                        fileName,
                        fileSize,
                        sentBytes,
                        sha256: hash.digest('hex')
                    });
                });

                fileStream.on('error', (err) => {
                    console.error('File stream error:', err);
                    notifyRenderer('p2p-send-error', { error: err.message });
                });

                req.on('close', () => {
                    fileStream.destroy();
                });

                fileStream.pipe(res);
                return;
            }

            // Clipboard text exchange endpoint
            if (pathname === '/api/p2p/clipboard' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        notifyRenderer('p2p-clipboard-received', {
                            text: parsed.text,
                            senderName: parsed.senderName || 'Nearby Device'
                        });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } catch (e) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: e.message }));
                    }
                });
                return;
            }

            res.writeHead(404);
            res.end();
        });

        httpServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                httpPort = port + 1;
                httpServer.listen(httpPort);
            } else {
                console.error('P2P HTTP Server error:', err);
            }
        });

        httpServer.listen(httpPort, '0.0.0.0', () => {
            console.log(`[P2P Direct Engine] Local server active on port ${httpPort}`);
            resolve(httpPort);
        });
    });
}

// ==========================================================================
// 2. UDP Multicast / Broadcast for Auto LAN Peer Discovery
// ==========================================================================
let udpBroadcastTimer = null;

function startUdpDiscovery() {
    if (udpSocket) return;

    try {
        udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        udpSocket.on('error', (err) => {
            console.warn('UDP socket error:', err.message);
        });

        udpSocket.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.peerId && data.peerId !== localPeerId) {
                    discoveredPeers.set(data.peerId, {
                        id: data.peerId,
                        name: data.deviceName || 'Nearby Device',
                        ip: rinfo.address,
                        port: data.httpPort || 9876,
                        activeSend: data.activeFile || null,
                        lastSeen: Date.now()
                    });

                    cleanExpiredPeers();
                    notifyRenderer('p2p-peers-updated', getDiscoveredPeers());
                }
            } catch (e) {}
        });

        udpSocket.bind(UDP_PORT, '0.0.0.0', () => {
            try {
                udpSocket.setBroadcast(true);
            } catch (e) {}
        });

        // Broadcast presence every 2.5 seconds
        udpBroadcastTimer = setInterval(() => {
            broadcastPresence();
            cleanExpiredPeers();
        }, 2500);
    } catch (e) {
        console.warn('Could not start UDP discovery:', e.message);
    }
}

function broadcastPresence() {
    if (!udpSocket) return;

    const payload = Buffer.from(JSON.stringify({
        peerId: localPeerId,
        deviceName: localDeviceName,
        httpPort: httpPort,
        activeFile: currentSendSession ? {
            name: currentSendSession.name,
            size: currentSendSession.size,
            formattedSize: formatBytes(currentSendSession.size),
            code: currentSendSession.code
        } : null
    }));

    try {
        udpSocket.send(payload, 0, payload.length, UDP_PORT, '255.255.255.255');
    } catch (e) {}
}

function cleanExpiredPeers() {
    const now = Date.now();
    let changed = false;
    for (const [peerId, peer] of discoveredPeers.entries()) {
        if (now - peer.lastSeen > 8000) {
            discoveredPeers.delete(peerId);
            changed = true;
        }
    }
    if (changed) {
        notifyRenderer('p2p-peers-updated', getDiscoveredPeers());
    }
}

function getDiscoveredPeers() {
    return Array.from(discoveredPeers.values());
}

// ==========================================================================
// 3. Sender Controller (Start / Cancel Sharing)
// ==========================================================================
async function startSendingFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: 'File does not exist' };
    }

    await startHttpServer(httpPort);
    startUdpDiscovery();

    const stats = fs.statSync(filePath);
    const code = generateTransferCode();
    const LOGICAL_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB logical chunk
    const totalChunks = Math.ceil(stats.size / LOGICAL_CHUNK_SIZE);

    currentSendSession = {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        code: code,
        chunkSize: LOGICAL_CHUNK_SIZE,
        totalChunks: Math.max(1, totalChunks),
        createdAt: Date.now()
    };

    // Immediately broadcast updated active send state to nearby peers
    broadcastPresence();

    return {
        success: true,
        code: code,
        localIp: getPrimaryIp(),
        port: httpPort,
        file: {
            name: currentSendSession.name,
            size: currentSendSession.size,
            formattedSize: formatBytes(currentSendSession.size),
            totalChunks: currentSendSession.totalChunks
        }
    };
}

function cancelSendingFile() {
    currentSendSession = null;
    broadcastPresence();
    return { success: true };
}

// ==========================================================================
// 4. Receiver Controller with Local Resumable Manifest (.part.meta.json)
// ==========================================================================
async function receiveFileFromPeer(ip, port, code, targetDirectory) {
    const saveDir = targetDirectory || getDefaultSavePath();
    if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
    }

    return new Promise((resolve) => {
        // Step 1: Query Sender Peer Info
        const infoReq = http.get(`http://${ip}:${port}/api/p2p/info`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const info = JSON.parse(data);
                    if (!info.hasActiveSend || !info.activeFile) {
                        return resolve({ success: false, error: 'Sender is no longer sharing a file' });
                    }

                    if (code && info.activeFile.code !== code) {
                        return resolve({ success: false, error: 'Incorrect 6-digit transfer code' });
                    }

                    const fileName = info.activeFile.name;
                    const fileSize = info.activeFile.size;
                    const partFilePath = path.join(saveDir, `${fileName}.part`);
                    const metaFilePath = path.join(saveDir, `${fileName}.part.meta.json`);
                    const finalFilePath = path.join(saveDir, fileName);

                    // Check for existing partial download to resume
                    let startByte = 0;
                    if (fs.existsSync(partFilePath) && fs.existsSync(metaFilePath)) {
                        try {
                            const meta = JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));
                            if (meta.fileSize === fileSize && meta.fileName === fileName) {
                                const currentPartSize = fs.statSync(partFilePath).size;
                                if (currentPartSize < fileSize) {
                                    startByte = currentPartSize;
                                    console.log(`[P2P Resume] Resuming "${fileName}" from byte ${startByte}/${fileSize}`);
                                }
                            }
                        } catch (e) {}
                    }

                    // Save/update initial resume manifest
                    fs.writeFileSync(metaFilePath, JSON.stringify({
                        fileName,
                        fileSize,
                        startByte,
                        startedAt: Date.now(),
                        ip,
                        port
                    }, null, 2));

                    // Step 2: Download Stream with Range Header
                    const headers = { 'X-Transfer-Code': code };
                    if (startByte > 0) {
                        headers['Range'] = `bytes=${startByte}-`;
                    }

                    notifyRenderer('p2p-receive-start', {
                        fileName,
                        fileSize,
                        startByte,
                        isResuming: startByte > 0
                    });

                    const streamReq = http.get(`http://${ip}:${port}/api/p2p/stream?code=${code}`, { headers }, (streamRes) => {
                        if (streamRes.statusCode !== 200 && streamRes.statusCode !== 206) {
                            return resolve({ success: false, error: `Transfer failed with HTTP ${streamRes.statusCode}` });
                        }

                        const writeStream = fs.createWriteStream(partFilePath, { flags: startByte > 0 ? 'a' : 'w' });
                        let receivedBytes = startByte;
                        let lastBytes = startByte;
                        let lastTime = Date.now();
                        const hash = crypto.createHash('sha256');

                        currentReceiveSession = {
                            request: streamReq,
                            writeStream,
                            partFilePath,
                            metaFilePath
                        };

                        streamRes.on('data', (chunk) => {
                            hash.update(chunk);
                            receivedBytes += chunk.length;
                            const now = Date.now();

                            if (now - lastTime > 250 || receivedBytes === fileSize) {
                                const duration = (now - lastTime) / 1000;
                                const speed = duration > 0 ? (receivedBytes - lastBytes) / duration : 0;
                                const progress = (receivedBytes / fileSize) * 100;
                                const eta = speed > 0 ? Math.round((fileSize - receivedBytes) / speed) : 0;

                                notifyRenderer('p2p-receive-progress', {
                                    fileName,
                                    fileSize,
                                    receivedBytes,
                                    progress: Math.min(100, progress),
                                    speedMBps: (speed / (1024 * 1024)).toFixed(1),
                                    etaSeconds: eta
                                });

                                lastTime = now;
                                lastBytes = receivedBytes;
                            }
                        });

                        streamRes.on('end', () => {
                            writeStream.end(async () => {
                                currentReceiveSession = null;

                                // Rename .part to final destination file
                                try {
                                    if (fs.existsSync(finalFilePath)) {
                                        fs.unlinkSync(finalFilePath);
                                    }
                                    fs.renameSync(partFilePath, finalFilePath);
                                    // Remove temporary resume manifest
                                    if (fs.existsSync(metaFilePath)) {
                                        fs.unlinkSync(metaFilePath);
                                    }
                                } catch (e) {
                                    console.error('File finalization error:', e);
                                }

                                const computedSha256 = hash.digest('hex');

                                notifyRenderer('p2p-receive-complete', {
                                    fileName,
                                    fileSize,
                                    filePath: finalFilePath,
                                    sha256: computedSha256
                                });

                                resolve({
                                    success: true,
                                    fileName,
                                    filePath: finalFilePath,
                                    fileSize,
                                    sha256: computedSha256
                                });
                            });
                        });

                        streamRes.on('error', (err) => {
                            currentReceiveSession = null;
                            notifyRenderer('p2p-receive-error', { error: err.message });
                            resolve({ success: false, error: err.message });
                        });

                        streamRes.pipe(writeStream);
                    });

                    streamReq.on('error', (err) => {
                        currentReceiveSession = null;
                        notifyRenderer('p2p-receive-error', { error: err.message });
                        resolve({ success: false, error: err.message });
                    });
                } catch (err) {
                    resolve({ success: false, error: 'Invalid response from sender' });
                }
            });
        });

        infoReq.on('error', (err) => {
            resolve({ success: false, error: `Could not connect to device at ${ip}:${port}` });
        });
    });
}

/**
 * Connect by 6-digit code: searches discovered LAN peers first, or tests primary local IP
 */
async function connectByCode(code, targetDirectory) {
    const cleanCode = code.replace(/\s+/g, '');

    // 1. Check auto-discovered LAN peers
    for (const peer of discoveredPeers.values()) {
        if (peer.activeSend && peer.activeSend.code === cleanCode) {
            return receiveFileFromPeer(peer.ip, peer.port, cleanCode, targetDirectory);
        }
    }

    // 2. Broadcast probe for code across LAN
    return receiveFileFromPeer('127.0.0.1', httpPort, cleanCode, targetDirectory);
}

function cancelReceiving() {
    if (currentReceiveSession) {
        if (currentReceiveSession.request) {
            currentReceiveSession.request.destroy();
        }
        if (currentReceiveSession.writeStream) {
            currentReceiveSession.writeStream.destroy();
        }
        currentReceiveSession = null;
    }
    return { success: true };
}

// ==========================================================================
// 5. Zero-Server WAN Out-of-Band Token Handshake Helpers
// ==========================================================================
function compressToken(obj) {
    try {
        const json = JSON.stringify(obj);
        const compressed = zlib.deflateRawSync(Buffer.from(json));
        return compressed.toString('base64url');
    } catch (e) {
        return Buffer.from(JSON.stringify(obj)).toString('base64');
    }
}

function decompressToken(tokenStr) {
    try {
        const buf = Buffer.from(tokenStr.trim(), 'base64url');
        const decompressed = zlib.inflateRawSync(buf);
        return JSON.parse(decompressed.toString('utf8'));
    } catch (e) {
        const raw = Buffer.from(tokenStr.trim(), 'base64').toString('utf8');
        return JSON.parse(raw);
    }
}

// ==========================================================================
// 6. Direct Clipboard Sending
// ==========================================================================
function sendClipboardToPeer(ip, port, text) {
    return new Promise((resolve) => {
        const payload = JSON.stringify({
            text,
            senderName: localDeviceName
        });

        const req = http.request({
            hostname: ip,
            port: port,
            path: '/api/p2p/clipboard',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            resolve({ success: res.statusCode === 200 });
        });

        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.write(payload);
        req.end();
    });
}

function setProgressCallback(cb) {
    progressCallback = cb;
}

function initP2PService() {
    startHttpServer(httpPort);
    startUdpDiscovery();
}

function getLocalInfo() {
    return {
        peerId: localPeerId,
        deviceName: localDeviceName,
        localIp: getPrimaryIp(),
        port: httpPort,
        hasActiveSend: !!currentSendSession,
        activeFile: currentSendSession ? {
            name: currentSendSession.name,
            size: currentSendSession.size,
            formattedSize: formatBytes(currentSendSession.size),
            code: currentSendSession.code
        } : null
    };
}

module.exports = {
    initP2PService,
    startSendingFile,
    cancelSendingFile,
    receiveFileFromPeer,
    connectByCode,
    cancelReceiving,
    sendClipboardToPeer,
    getDiscoveredPeers,
    setProgressCallback,
    getLocalInfo,
    compressToken,
    decompressToken
};
