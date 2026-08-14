// ==========================================================================
// YT Studio Pro — P2P Local HTTP Streaming & Download Engine
// High-speed direct TCP binary transfer with Range header partial resume
// Progressive SHA-256 verification & real-time telemetry
// ==========================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { formatBytes, getPrimaryIp } = require('./p2pUtils');
const { getDefaultSavePath } = require('../libraryService');

let httpServer = null;
let httpPort = 9876;
const activeHttpResponses = new Set();

function startHttpServer(options = {}) {
    if (httpServer) return Promise.resolve(httpPort);

    const {
        port = 9876,
        localPeerId,
        localDeviceName,
        getActiveSend = () => null,
        onSendProgress = () => {}
    } = options;

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
                    name: localDeviceName,
                    activeSend: getActiveSend()
                }));
                return;
            }

            // Probe endpoint: check if a code matches current active share
            if (pathname === '/api/p2p/probe') {
                const code = urlObj.searchParams.get('code');
                const active = getActiveSend();
                if (active && (active.code === code || active.token === code || active.token?.includes(code))) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        match: true,
                        peerId: localPeerId,
                        name: localDeviceName,
                        file: active.file
                    }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ match: false }));
                }
                return;
            }

            // Stream / Download endpoint
            if (pathname === '/api/p2p/download') {
                const code = req.headers['x-transfer-code'] || urlObj.searchParams.get('code');
                const active = getActiveSend();

                if (!active || (active.code !== code && active.token !== code)) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Transfer session expired or closed by sender' }));
                    return;
                }

                const filePath = active.filePath;
                if (!fs.existsSync(filePath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'File no longer exists on sender machine' }));
                    return;
                }

                const stat = fs.statSync(filePath);
                const fileSize = stat.size;
                const fileName = path.basename(filePath);

                // Handle Partial Content Range Header (Resumable Streaming)
                let start = 0;
                let end = fileSize - 1;
                const rangeHeader = req.headers.range;

                if (rangeHeader) {
                    const parts = rangeHeader.replace(/bytes=/, '').split('-');
                    start = parseInt(parts[0], 10);
                    if (parts[1]) {
                        end = parseInt(parts[1], 10);
                    }
                }

                const chunkSize = (end - start) + 1;
                const isPartial = start > 0 || end < (fileSize - 1);

                const responseHeaders = {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': chunkSize,
                    'Accept-Ranges': 'bytes',
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
                    'X-File-Name': encodeURIComponent(fileName),
                    'X-File-Size': String(fileSize)
                };

                if (isPartial) {
                    responseHeaders['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
                }

                res.writeHead(isPartial ? 206 : 200, responseHeaders);

                activeHttpResponses.add(res);
                res.on('finish', () => activeHttpResponses.delete(res));
                res.on('close', () => activeHttpResponses.delete(res));

                let sentBytes = start;
                let lastReportTime = Date.now();
                let lastReportBytes = start;

                const fileStream = fs.createReadStream(filePath, { start, end, highWaterMark: 2 * 1024 * 1024 });

                fileStream.on('data', (chunk) => {
                    sentBytes += chunk.length;
                    const now = Date.now();

                    if (now - lastReportTime >= 350 || sentBytes === fileSize) {
                        const elapsedSec = (now - lastReportTime) / 1000;
                        const deltaBytes = sentBytes - lastReportBytes;
                        const speedMBps = elapsedSec > 0 ? (deltaBytes / (1024 * 1024) / elapsedSec).toFixed(1) : '0.0';
                        const progress = fileSize > 0 ? (sentBytes / fileSize) * 100 : 100;
                        const remainingBytes = fileSize - sentBytes;
                        const etaSeconds = parseFloat(speedMBps) > 0 ? Math.ceil((remainingBytes / (1024 * 1024)) / parseFloat(speedMBps)) : 0;

                        onSendProgress({
                            sentBytes,
                            totalBytes: fileSize,
                            progress,
                            speedMBps,
                            etaSeconds,
                            fileName
                        });

                        lastReportTime = now;
                        lastReportBytes = sentBytes;
                    }
                });

                fileStream.on('error', (err) => {
                    console.error('[P2P HTTP Stream] Error reading file:', err);
                    activeHttpResponses.delete(res);
                    if (!res.headersSent) {
                        res.writeHead(500);
                    }
                    res.end();
                });

                fileStream.pipe(res);

                req.on('close', () => {
                    activeHttpResponses.delete(res);
                    fileStream.destroy();
                });

                return;
            }

            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Endpoint not found' }));
        });

        httpServer.listen(port, '0.0.0.0', () => {
            console.log(`[P2P Stream Server] Active on port ${port}`);
            resolve(port);
        });

        httpServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.warn(`[P2P Stream Server] Port ${port} busy, trying ${port + 1}...`);
                httpPort = port + 1;
                httpServer.listen(httpPort, '0.0.0.0', () => resolve(httpPort));
            } else {
                console.error('[P2P Stream Server] Error:', err);
                resolve(port);
            }
        });
    });
}

function abortActiveStreams() {
    for (const res of activeHttpResponses) {
        try {
            res.destroy(new Error('Session cancelled by sender'));
        } catch (e) {}
    }
    activeHttpResponses.clear();
}

function getHttpPort() {
    return httpPort;
}

function stopHttpServer() {
    abortActiveStreams();
    if (httpServer) {
        try {
            httpServer.close();
        } catch (e) {}
        httpServer = null;
    }
}

/**
 * Downloads a file directly from a sender peer HTTP endpoint
 */
function downloadFileFromPeer(options = {}) {
    const {
        ip,
        port,
        code,
        targetDir = getDefaultSavePath(),
        onProgress = () => {},
        onComplete = () => {},
        onError = () => {}
    } = options;

    return new Promise((resolve, reject) => {
        const url = `http://${ip}:${port}/api/p2p/download?code=${encodeURIComponent(code)}`;

        const req = http.get(url, {
            headers: {
                'X-Transfer-Code': code
            }
        }, (res) => {
            if (res.statusCode !== 200 && res.statusCode !== 206) {
                let errBody = '';
                res.on('data', (d) => errBody += d);
                res.on('end', () => {
                    const msg = `Transfer rejected (${res.statusCode}): ${errBody || 'Session closed'}`;
                    onError({ error: msg });
                    reject(new Error(msg));
                });
                return;
            }

            const rawName = res.headers['x-file-name'] || 'downloaded_file';
            const fileName = decodeURIComponent(rawName);
            const totalBytes = parseInt(res.headers['x-file-size'] || res.headers['content-length'] || '0', 10);

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            const finalPath = path.join(targetDir, fileName);
            const partPath = `${finalPath}.part`;
            const metaPath = `${finalPath}.part.meta.json`;

            const writeStream = fs.createWriteStream(partPath, { flags: 'w' });
            const hash = crypto.createHash('sha256');

            let receivedBytes = 0;
            let lastReportTime = Date.now();
            let lastReportBytes = 0;

            res.on('data', (chunk) => {
                receivedBytes += chunk.length;
                hash.update(chunk);
                writeStream.write(chunk);

                const now = Date.now();
                if (now - lastReportTime >= 350 || receivedBytes === totalBytes) {
                    const elapsedSec = (now - lastReportTime) / 1000;
                    const deltaBytes = receivedBytes - lastReportBytes;
                    const speedMBps = elapsedSec > 0 ? (deltaBytes / (1024 * 1024) / elapsedSec).toFixed(1) : '0.0';
                    const progress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 100;
                    const remainingBytes = totalBytes - receivedBytes;
                    const etaSeconds = parseFloat(speedMBps) > 0 ? Math.ceil((remainingBytes / (1024 * 1024)) / parseFloat(speedMBps)) : 0;

                    onProgress({
                        receivedBytes,
                        totalBytes,
                        progress,
                        speedMBps,
                        etaSeconds,
                        fileName
                    });

                    lastReportTime = now;
                    lastReportBytes = receivedBytes;
                }
            });

            res.on('end', () => {
                writeStream.end(() => {
                    // Check if stream ended prematurely
                    if (totalBytes > 0 && receivedBytes < totalBytes) {
                        try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
                        const abortedMsg = 'Transfer aborted: Sender closed or cancelled the session.';
                        onError({ error: abortedMsg });
                        reject(new Error(abortedMsg));
                        return;
                    }

                    const calculatedHash = hash.digest('hex');

                    // Rename .part to final file
                    try {
                        if (fs.existsSync(finalPath)) {
                            fs.unlinkSync(finalPath);
                        }
                        fs.renameSync(partPath, finalPath);

                        if (fs.existsSync(metaPath)) {
                            fs.unlinkSync(metaPath);
                        }

                        const result = {
                            success: true,
                            fileName,
                            filePath: finalPath,
                            fileSize: totalBytes,
                            formattedSize: formatBytes(totalBytes),
                            sha256: calculatedHash
                        };

                        onComplete(result);
                        resolve(result);
                    } catch (renameErr) {
                        onError({ error: `Could not finalize file: ${renameErr.message}` });
                        reject(renameErr);
                    }
                });
            });

            res.on('error', (err) => {
                writeStream.destroy();
                try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
                onError({ error: `Connection dropped: ${err.message}` });
                reject(err);
            });
        });

        req.on('error', (err) => {
            onError({ error: `Connection failed: ${err.message}` });
            reject(err);
        });

        req.setTimeout(30000, () => {
            req.destroy(new Error('Connection timed out'));
        });
    });
}

module.exports = {
    startHttpServer,
    abortActiveStreams,
    getHttpPort,
    stopHttpServer,
    downloadFileFromPeer
};
