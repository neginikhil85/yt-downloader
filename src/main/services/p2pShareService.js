// ==========================================================================
// YT Studio Pro — ToffeeShare Style App-to-App Direct P2P Transfer Engine
// 100% Direct Stream, End-to-End Local P2P, Zero-Cloud, Auto LAN Discovery
// ==========================================================================

const http = require('http');
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDefaultSavePath } = require('./libraryService');

let httpServer = null;
let udpSocket = null;
let httpPort = 9876;
const UDP_PORT = 9877;

const localPeerId = 'peer_' + Math.random().toString(36).substring(2, 10);
const localDeviceName = `${os.hostname()} (${process.platform === 'darwin' ? 'Mac' : (process.platform === 'win32' ? 'Windows' : 'Linux')})`;

// Active Outgoing Share Session (Sender state)
let currentSendSession = null;
// Active Incoming Download Session (Receiver state)
let currentReceiveSession = null;

// Discovered LAN peers on the same network
const discoveredPeers = new Map(); // peerId -> { id, name, ip, port, activeSend, lastSeen }

// Event listeners for Electron main process to notify renderer
let progressCallback = null;

function generateCode() {
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

/**
 * 1. Embedded HTTP Server for Direct P2P File Streaming
 */
function startHttpServer(port = 9876) {
    if (httpServer) return Promise.resolve(httpPort);

    return new Promise((resolve) => {
        httpPort = port;
        httpServer = http.createServer((req, res) => {
            const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const pathname = urlObj.pathname;

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Transfer-Code');

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
                        code: currentSendSession.code
                    } : null
                }));
                return;
            }

            // Direct P2P File Stream (Receiver downloading from Sender)
            if (pathname.startsWith('/api/p2p/stream/')) {
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

                res.writeHead(200, {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': fileSize,
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
                    'X-File-Name': encodeURIComponent(fileName),
                    'X-File-Size': fileSize
                });

                let sentBytes = 0;
                let startTime = Date.now();
                let lastTime = startTime;
                let lastBytes = 0;

                notifyRenderer('p2p-send-start', {
                    fileName,
                    fileSize,
                    receiverIp: req.socket.remoteAddress
                });

                const fileStream = fs.createReadStream(currentSendSession.path, { highWaterMark: 256 * 1024 });

                fileStream.on('data', (chunk) => {
                    sentBytes += chunk.length;
                    const now = Date.now();
                    
                    // Update speed every 300ms
                    if (now - lastTime > 300 || sentBytes === fileSize) {
                        const duration = (now - lastTime) / 1000;
                        const speed = duration > 0 ? (sentBytes - lastBytes) / duration : 0; // Bytes/sec
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
                        totalTimeSeconds: ((Date.now() - startTime) / 1000).toFixed(1)
                    });
                });

                fileStream.on('error', (err) => {
                    notifyRenderer('p2p-send-error', { error: err.message });
                    res.destroy();
                });

                req.on('close', () => {
                    fileStream.destroy();
                });

                fileStream.pipe(res);
                return;
            }

            // Direct Clipboard Sync Endpoint
            if (pathname === '/api/p2p/clipboard' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const { text, from } = JSON.parse(body || '{}');
                        notifyRenderer('p2p-clipboard-received', { text, from: from || 'Remote App' });
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
            res.end('Not Found');
        });

        httpServer.listen(httpPort, '0.0.0.0', () => {
            console.log(`[ToffeeShare P2P] HTTP server running on port ${httpPort}`);
            resolve(httpPort);
        });

        httpServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                httpPort++;
                httpServer.listen(httpPort, '0.0.0.0');
            } else {
                console.error('[ToffeeShare P2P] Server error:', err);
            }
        });
    });
}

/**
 * 2. UDP Auto-Discovery Service (Discovers other YT Studio Pro apps on the LAN)
 */
function startUdpDiscovery() {
    if (udpSocket) return;

    try {
        udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        udpSocket.on('error', (err) => {
            console.warn('[ToffeeShare UDP] Socket error:', err.message);
        });

        udpSocket.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.app === 'yt-studio-p2p' && data.id !== localPeerId) {
                    discoveredPeers.set(data.id, {
                        id: data.id,
                        name: data.name,
                        ip: rinfo.address,
                        port: data.port,
                        activeSend: data.activeSend || null,
                        lastSeen: Date.now()
                    });
                    notifyRenderer('p2p-peers-updated', getDiscoveredPeers());
                }
            } catch {}
        });

        udpSocket.bind(UDP_PORT, () => {
            try {
                udpSocket.setBroadcast(true);
            } catch {}
            console.log(`[ToffeeShare UDP] Discovery listening on port ${UDP_PORT}`);
        });

        // Broadcast presence every 2.5 seconds
        setInterval(() => {
            broadcastPresence();
            cleanStalePeers();
        }, 2500);

    } catch (e) {
        console.warn('[ToffeeShare UDP] Failed to initialize discovery:', e.message);
    }
}

function broadcastPresence() {
    if (!udpSocket) return;
    const payload = Buffer.from(JSON.stringify({
        app: 'yt-studio-p2p',
        id: localPeerId,
        name: localDeviceName,
        port: httpPort,
        activeSend: currentSendSession ? {
            name: currentSendSession.name,
            size: currentSendSession.size,
            code: currentSendSession.code
        } : null
    }));

    try {
        udpSocket.send(payload, 0, payload.length, UDP_PORT, '255.255.255.255');
    } catch {}
}

function cleanStalePeers() {
    const now = Date.now();
    let updated = false;
    for (const [id, peer] of discoveredPeers.entries()) {
        if (now - peer.lastSeen > 7000) {
            discoveredPeers.delete(id);
            updated = true;
        }
    }
    if (updated) {
        notifyRenderer('p2p-peers-updated', getDiscoveredPeers());
    }
}

function getDiscoveredPeers() {
    return Array.from(discoveredPeers.values());
}

/**
 * 3. Sender Engine: Prepare a file to share with a 6-digit Code
 */
function startSendingFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File does not exist' };
    }

    const stat = fs.statSync(filePath);
    const code = generateCode();
    const fileName = path.basename(filePath);

    currentSendSession = {
        path: filePath,
        name: fileName,
        size: stat.size,
        code: code,
        startedAt: Date.now()
    };

    // Immediate UDP broadcast so nearby receivers see the file instantly
    broadcastPresence();

    return {
        success: true,
        code,
        file: {
            name: fileName,
            size: stat.size,
            formattedSize: (stat.size / (1024 * 1024)).toFixed(1) + ' MB'
        },
        localIp: getPrimaryIp(),
        port: httpPort
    };
}

function cancelSendingFile() {
    currentSendSession = null;
    broadcastPresence();
    return { success: true };
}

/**
 * 4. Receiver Engine: Connect to Sender using 6-Digit Code or Peer IP and Stream Directly to Disk
 */
async function receiveFileFromPeer(targetIp, targetPort, code) {
    if (currentReceiveSession) {
        return { success: false, error: 'A transfer is already in progress' };
    }

    const saveDir = getDefaultSavePath();
    fs.mkdirSync(saveDir, { recursive: true });

    return new Promise((resolve) => {
        const streamUrl = `http://${targetIp}:${targetPort}/api/p2p/stream/download?code=${code}`;

        const req = http.get(streamUrl, (res) => {
            if (res.statusCode !== 200) {
                notifyRenderer('p2p-receive-error', { error: `Connection failed with status ${res.statusCode}` });
                resolve({ success: false, error: `Transfer failed: HTTP ${res.statusCode}` });
                return;
            }

            const rawFileName = res.headers['x-file-name'] ? decodeURIComponent(res.headers['x-file-name']) : 'received_file';
            const fileSize = parseInt(res.headers['content-length'] || res.headers['x-file-size'] || '0', 10);
            
            // Avoid overwriting existing files
            let targetPath = path.join(saveDir, rawFileName);
            let counter = 1;
            const ext = path.extname(rawFileName);
            const base = path.basename(rawFileName, ext);
            while (fs.existsSync(targetPath)) {
                targetPath = path.join(saveDir, `${base}_${counter}${ext}`);
                counter++;
            }

            const fileWriteStream = fs.createWriteStream(targetPath);
            let receivedBytes = 0;
            const startTime = Date.now();
            let lastTime = startTime;
            let lastBytes = 0;

            currentReceiveSession = { req, fileWriteStream, targetPath };

            notifyRenderer('p2p-receive-start', {
                fileName: path.basename(targetPath),
                fileSize,
                targetPath
            });

            res.on('data', (chunk) => {
                receivedBytes += chunk.length;
                const now = Date.now();

                if (now - lastTime > 300 || receivedBytes === fileSize) {
                    const duration = (now - lastTime) / 1000;
                    const speed = duration > 0 ? (receivedBytes - lastBytes) / duration : 0;
                    const progress = fileSize > 0 ? (receivedBytes / fileSize) * 100 : 0;
                    const eta = speed > 0 ? Math.round((fileSize - receivedBytes) / speed) : 0;

                    notifyRenderer('p2p-receive-progress', {
                        fileName: path.basename(targetPath),
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

            res.pipe(fileWriteStream);

            fileWriteStream.on('finish', () => {
                currentReceiveSession = null;
                const finalInfo = {
                    fileName: path.basename(targetPath),
                    fileSize,
                    savedPath: targetPath,
                    totalTimeSeconds: ((Date.now() - startTime) / 1000).toFixed(1)
                };
                notifyRenderer('p2p-receive-complete', finalInfo);
                resolve({ success: true, file: finalInfo });
            });

            fileWriteStream.on('error', (err) => {
                currentReceiveSession = null;
                notifyRenderer('p2p-receive-error', { error: err.message });
                resolve({ success: false, error: err.message });
            });
        });

        req.on('error', (err) => {
            currentReceiveSession = null;
            notifyRenderer('p2p-receive-error', { error: err.message });
            resolve({ success: false, error: err.message });
        });

        req.setTimeout(15000, () => {
            req.destroy();
            currentReceiveSession = null;
            notifyRenderer('p2p-receive-error', { error: 'Connection timed out' });
            resolve({ success: false, error: 'Connection timed out' });
        });
    });
}

/**
 * 5. Auto-Find by 6-digit Code (Scans discovered peers or local subnet)
 */
async function connectByCode(code) {
    const cleanCode = code.replace(/\s+/g, '');
    
    // First, check if any discovered peer has this active code
    for (const peer of discoveredPeers.values()) {
        if (peer.activeSend && peer.activeSend.code === cleanCode) {
            return receiveFileFromPeer(peer.ip, peer.port, cleanCode);
        }
    }

    // If not in discovery cache, scan local subnet on standard port
    const localIps = getLocalIpAddresses();
    const primaryIp = localIps[0] || '192.168.1.1';
    const subnetPrefix = primaryIp.substring(0, primaryIp.lastIndexOf('.') + 1);

    // Quick parallel probe on local subnet
    const probePromises = [];
    for (let i = 1; i <= 254; i++) {
        const testIp = subnetPrefix + i;
        probePromises.push(new Promise((resolve) => {
            const req = http.get(`http://${testIp}:${httpPort}/api/p2p/info`, { timeout: 1200 }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.activeFile && parsed.activeFile.code === cleanCode) {
                            resolve({ ip: testIp, port: httpPort });
                            return;
                        }
                    } catch {}
                    resolve(null);
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
        }));
    }

    const results = await Promise.all(probePromises);
    const found = results.find(r => r !== null);

    if (found) {
        return receiveFileFromPeer(found.ip, found.port, cleanCode);
    }

    return { success: false, error: `No device found with Code: ${code}. Make sure both apps are on the same Wi-Fi network.` };
}

function cancelReceiving() {
    if (currentReceiveSession) {
        if (currentReceiveSession.req) currentReceiveSession.req.destroy();
        if (currentReceiveSession.fileWriteStream) currentReceiveSession.fileWriteStream.destroy();
        currentReceiveSession = null;
    }
    return { success: true };
}

function sendClipboardToPeer(targetIp, targetPort, text) {
    return new Promise((resolve) => {
        const payload = JSON.stringify({ text, from: localDeviceName });
        const req = http.request(`http://${targetIp}:${targetPort}/api/p2p/clipboard`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 5000
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
    startHttpServer(9876).then(() => {
        startUdpDiscovery();
    });
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
    getLocalInfo: () => ({
        peerId: localPeerId,
        deviceName: localDeviceName,
        ip: getPrimaryIp(),
        port: httpPort,
        activeSend: currentSendSession
    })
};
