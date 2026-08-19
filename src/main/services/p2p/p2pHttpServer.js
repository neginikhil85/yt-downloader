// ==========================================================================
// YT Studio Pro — P2P Local HTTP Streaming & Mobile Web Portal Engine
// High-speed direct TCP binary transfer, 2-Way Mobile Web Portal (Zero-Config),
// Resumable Partial Streaming & Progressive SHA-256 telemetry
// ==========================================================================

const http = require('http');
const https = require('https');
const net = require('net');
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
        onSendProgress = () => {},
        onSendComplete = () => {},
        onReceiveProgress = () => {},
        onReceiveComplete = () => {}
    } = options;

    return new Promise((resolve) => {
        httpPort = port;
        httpServer = http.createServer((req, res) => {
            const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const pathname = urlObj.pathname;

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Transfer-Code, X-File-Name, X-File-Size, Range');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            // Handle direct proxy GET requests (if forwarded as absolute URL)
            if (req.url.startsWith('http://') && !pathname.startsWith('/api') && !pathname.startsWith('/portal')) {
                const parsed = new URL(req.url);
                const proxyReq = http.request({
                    hostname: parsed.hostname,
                    port: parsed.port || 80,
                    path: parsed.pathname + parsed.search,
                    method: req.method,
                    headers: req.headers
                }, (proxyRes) => {
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    proxyRes.pipe(res);
                });
                proxyReq.on('error', () => {
                    if (!res.headersSent) res.writeHead(502);
                    res.end('Bad Gateway');
                });
                req.pipe(proxyReq);
                return;
            }

            // 0. Universal Cross-Platform Video Stream Proxy (HTTP Range 206 Support)
            if (pathname === '/api/stream') {
                const targetUrl = urlObj.searchParams.get('url');
                if (!targetUrl) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Missing target url parameter' }));
                }

                try {
                    const parsedTarget = new URL(targetUrl);
                    const isAndroidClient = targetUrl.includes('c=ANDROID') || targetUrl.includes('c=TV');
                    const ua = isAndroidClient
                        ? 'com.google.android.youtube/19.29.37 (Linux; U; Android 11; en_US)'
                        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';

                    const clientHeaders = {
                        'User-Agent': ua,
                        'Accept': '*/*',
                        'Accept-Encoding': 'identity;q=1, *;q=0',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Connection': 'keep-alive'
                    };

                    if (req.headers.range) {
                        clientHeaders['Range'] = req.headers.range;
                    }

                    const isHttps = parsedTarget.protocol === 'https:';
                    const client = isHttps ? https : http;

                    const proxyReq = client.request({
                        protocol: parsedTarget.protocol,
                        hostname: parsedTarget.hostname,
                        port: parsedTarget.port || (isHttps ? 443 : 80),
                        path: parsedTarget.pathname + parsedTarget.search,
                        method: 'GET',
                        headers: clientHeaders,
                        rejectUnauthorized: false
                    }, (proxyRes) => {
                        // Handle redirect if any
                        if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
                            res.writeHead(302, { 'Location': `/api/stream?url=${encodeURIComponent(proxyRes.headers.location)}` });
                            return res.end();
                        }

                        const responseHeaders = {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
                            'Accept-Ranges': 'bytes',
                            'Cache-Control': 'no-cache'
                        };

                        if (proxyRes.headers['content-length']) responseHeaders['Content-Length'] = proxyRes.headers['content-length'];
                        if (proxyRes.headers['content-range']) responseHeaders['Content-Range'] = proxyRes.headers['content-range'];

                        res.writeHead(proxyRes.statusCode || 200, responseHeaders);
                        proxyRes.pipe(res);
                    });

                    proxyReq.on('error', (err) => {
                        console.error('[StreamProxy Error]:', err.message);
                        if (!res.headersSent) {
                            res.writeHead(502, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: err.message }));
                        }
                    });

                    req.on('close', () => {
                        proxyReq.destroy();
                    });

                    proxyReq.end();
                } catch (err) {
                    console.error('[StreamProxy Parse Error]:', err.message);
                    if (!res.headersSent) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid stream URL' }));
                    }
                }
                return;
            }

            // 1. Mobile Web Portal (GET / or GET /?pin=...)
            if (pathname === '/' || pathname === '/portal') {
                const active = getActiveSend();
                const pin = urlObj.searchParams.get('pin') || active?.code || '';
                const html = renderMobilePortalHtml({
                    deviceName: localDeviceName,
                    activeSend: active,
                    pin
                });
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            }

            // 2. Info / Handshake endpoint
            if (pathname === '/api/p2p/info' || pathname === '/api/p2p/status') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    peerId: localPeerId,
                    name: localDeviceName,
                    activeSend: getActiveSend()
                }));
                return;
            }

            // 3. Probe endpoint: check if a code matches current active share
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

            // 4. Stream / Download endpoint (Desktop-to-Peer & Desktop-to-Mobile)
            if (pathname === '/api/p2p/download') {
                const code = req.headers['x-transfer-code'] || urlObj.searchParams.get('code');
                const active = getActiveSend();

                if (!active || (active.code !== code && active.token !== code && code !== 'mobile_direct')) {
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
                res.on('finish', () => {
                    activeHttpResponses.delete(res);
                    if (sentBytes >= fileSize) {
                        onSendComplete({
                            fileName,
                            fileSize,
                            formattedSize: formatBytes(fileSize)
                        });
                    }
                });
                res.on('close', () => activeHttpResponses.delete(res));

                let sentBytes = start;
                let lastReportTime = Date.now();
                let lastReportBytes = start;

                const fileStream = fs.createReadStream(filePath, { start, end, highWaterMark: 2 * 1024 * 1024 });

                fileStream.on('data', (chunk) => {
                    sentBytes += chunk.length;
                    const now = Date.now();

                    if (now - lastReportTime >= 300 || sentBytes === fileSize) {
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

            // 5. Mobile-to-Desktop Upload Endpoint (POST /api/p2p/upload)
            if (pathname === '/api/p2p/upload' && req.method === 'POST') {
                const rawName = req.headers['x-file-name'] || urlObj.searchParams.get('name') || 'mobile_upload_file';
                let fileName = decodeURIComponent(rawName).replace(/[/\\]/g, '_');
                const totalBytes = parseInt(req.headers['content-length'] || req.headers['x-file-size'] || '0', 10);

                const saveDir = getDefaultSavePath();
                if (!fs.existsSync(saveDir)) {
                    fs.mkdirSync(saveDir, { recursive: true });
                }

                // If file already exists, deduplicate name
                let finalPath = path.join(saveDir, fileName);
                let counter = 1;
                const ext = path.extname(fileName);
                const base = path.basename(fileName, ext);
                while (fs.existsSync(finalPath)) {
                    fileName = `${base}_${counter}${ext}`;
                    finalPath = path.join(saveDir, fileName);
                    counter++;
                }

                const partPath = `${finalPath}.part`;
                const writeStream = fs.createWriteStream(partPath);
                let receivedBytes = 0;
                let lastReportTime = Date.now();
                let lastReportBytes = 0;

                req.on('data', (chunk) => {
                    receivedBytes += chunk.length;
                    writeStream.write(chunk);

                    const now = Date.now();
                    if (now - lastReportTime >= 300 || (totalBytes > 0 && receivedBytes === totalBytes)) {
                        const elapsedSec = (now - lastReportTime) / 1000;
                        const deltaBytes = receivedBytes - lastReportBytes;
                        const speedMBps = elapsedSec > 0 ? (deltaBytes / (1024 * 1024) / elapsedSec).toFixed(1) : '0.0';
                        const progress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 50;
                        const remainingBytes = totalBytes - receivedBytes;
                        const etaSeconds = parseFloat(speedMBps) > 0 ? Math.ceil((remainingBytes / (1024 * 1024)) / parseFloat(speedMBps)) : 0;

                        onReceiveProgress({
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

                req.on('end', () => {
                    writeStream.end(() => {
                        try {
                            if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
                            fs.renameSync(partPath, finalPath);

                            const result = {
                                success: true,
                                fileName,
                                filePath: finalPath,
                                fileSize: receivedBytes,
                                formattedSize: formatBytes(receivedBytes)
                            };

                            onReceiveComplete(result);

                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(result));
                        } catch (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: err.message }));
                        }
                    });
                });

                req.on('error', (err) => {
                    writeStream.destroy();
                    try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });

                return;
            }

            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Endpoint not found' }));
        });

        // HTTP CONNECT Tunnel Forwarding Proxy for Research Browser & Webviews (Netskope Bypass)
        httpServer.on('connect', (req, clientSocket, head) => {
            const [host, port] = req.url.split(':');
            const targetPort = parseInt(port, 10) || 443;

            const serverSocket = net.connect(targetPort, host, () => {
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                if (head && head.length > 0) {
                    serverSocket.write(head);
                }
                serverSocket.pipe(clientSocket);
                clientSocket.pipe(serverSocket);
            });

            serverSocket.on('error', () => {
                clientSocket.destroy();
            });

            clientSocket.on('error', () => {
                serverSocket.destroy();
            });

            serverSocket.on('close', () => clientSocket.destroy());
            clientSocket.on('close', () => serverSocket.destroy());
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
 * Downloads a file directly from a sender peer HTTP endpoint with retry protection
 */
function downloadFileFromPeer(options = {}, retries = 2) {
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
                if (now - lastReportTime >= 300 || receivedBytes === totalBytes) {
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
                    if (totalBytes > 0 && receivedBytes < totalBytes) {
                        try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (e) {}
                        const abortedMsg = 'Transfer aborted: Sender closed or cancelled the session.';
                        onError({ error: abortedMsg });
                        reject(new Error(abortedMsg));
                        return;
                    }

                    const calculatedHash = hash.digest('hex');

                    try {
                        if (fs.existsSync(finalPath)) {
                            fs.unlinkSync(finalPath);
                        }
                        fs.renameSync(partPath, finalPath);

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

        req.on('error', async (err) => {
            if (retries > 0 && (err.message.includes('EHOSTUNREACH') || err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT'))) {
                console.warn(`[P2P Download] Retrying connection to ${ip}:${port} (${retries} attempts left)...`);
                await new Promise(r => setTimeout(r, 400));
                downloadFileFromPeer(options, retries - 1).then(resolve).catch(reject);
                return;
            }
            onError({ error: `Connection failed: ${err.message}` });
            reject(err);
        });

        req.setTimeout(30000, () => {
            req.destroy(new Error('Connection timed out'));
        });
    });
}

/**
 * Renders the 100% Offline Standalone Mobile Web Portal HTML
 */
function renderMobilePortalHtml(context) {
    const { deviceName, activeSend, pin } = context;
    const hasFile = !!(activeSend && activeSend.file);
    const fileName = hasFile ? (activeSend.file.name || 'File') : '';
    const fileSize = hasFile ? (activeSend.file.formattedSize || '') : '';
    const code = activeSend ? activeSend.code : pin;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Direct Share</title>
    <style>
        :root {
            --bg-base: #0a0b0e;
            --card-bg: rgba(255, 255, 255, 0.03);
            --border-subtle: rgba(255, 255, 255, 0.08);
            --primary: #3b82f6;
            --primary-hover: #2563eb;
            --accent: #38bdf8;
            --text-primary: #ffffff;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
        }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg-base);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 16px 14px 40px 14px;
        }
        .ds-app-wrap {
            width: 100%;
            max-width: 480px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        /* 1. Header (Matching Desktop) */
        .ds-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 4px 4px 4px;
        }
        .ds-topbar-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .ds-title {
            font-size: 16px;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.3px;
        }
        .ds-subtitle-badge {
            font-size: 10px;
            font-weight: 600;
            background: rgba(59, 130, 246, 0.12);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.25);
            padding: 2px 8px;
            border-radius: 999px;
            letter-spacing: 0.3px;
        }
        .ds-connected-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: var(--text-secondary);
        }
        .ds-live-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 6px #10b981;
        }

        /* 2. Unified Card Container (Matching Desktop) */
        .ds-card {
            background: var(--card-bg);
            border: 1px solid var(--border-subtle);
            border-radius: 14px;
            padding: 18px 16px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        /* Dropzone Box */
        .ds-drop-zone {
            background: rgba(255, 255, 255, 0.02);
            border: 1.5px dashed rgba(255, 255, 255, 0.14);
            border-radius: 12px;
            padding: 24px 16px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            cursor: pointer;
        }
        .ds-drop-zone:active {
            border-color: rgba(59, 130, 246, 0.6);
            background: rgba(59, 130, 246, 0.04);
        }
        .ds-drop-icon-wrap {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-subtle);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--accent);
            margin-bottom: 10px;
        }
        .ds-drop-text h3 {
            font-size: 14.5px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 3px;
        }
        .ds-drop-text p {
            font-size: 11.5px;
            color: var(--text-secondary);
            margin-bottom: 14px;
        }
        .ds-btn-primary {
            background: var(--primary);
            color: #ffffff;
            border: none;
            padding: 9px 18px;
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
        }
        .ds-btn-primary:active { transform: scale(0.98); }

        /* Available File Download Box (if active) */
        .ds-file-download-box {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border-subtle);
            border-radius: 12px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .ds-file-meta-row {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .ds-file-icon {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: rgba(56, 189, 248, 0.12);
            border: 1px solid rgba(56, 189, 248, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--accent);
            flex-shrink: 0;
        }
        .ds-file-meta-text {
            flex: 1;
            min-width: 0;
        }
        .ds-file-meta-name {
            font-size: 13.5px;
            font-weight: 600;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .ds-file-meta-size {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 1px;
        }
        .ds-btn-download-full {
            background: var(--primary);
            color: #ffffff;
            text-decoration: none;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 11px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            border: none;
        }

        /* Divider (Matching Desktop) */
        .ds-divider-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 2px 0;
        }
        .ds-divider-line {
            flex: 1;
            height: 1px;
            background: var(--border-subtle);
        }
        .ds-divider-label {
            font-size: 9.5px;
            font-weight: 700;
            letter-spacing: 0.8px;
            color: var(--text-muted);
        }

        /* 6-Digit PIN Quick Box (Matching Desktop) */
        .ds-pin-entry-wrap {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .ds-pin-input-row {
            display: flex;
            gap: 8px;
            width: 100%;
        }
        .ds-pin-quick-input {
            flex: 1;
            background: #0f1013;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            padding: 9px 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13.5px;
            font-weight: 600;
            color: #ffffff;
            letter-spacing: 2px;
            outline: none;
        }
        .ds-pin-quick-input:focus {
            border-color: var(--primary);
        }
        .ds-btn-connect {
            white-space: nowrap;
            padding: 0 16px;
            height: 38px;
        }

        /* Progress Card */
        .ds-progress-box {
            display: none;
            flex-direction: column;
            gap: 8px;
            padding: 14px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border-subtle);
            border-radius: 10px;
        }
        .ds-progress-track {
            width: 100%;
            height: 7px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 7px;
            overflow: hidden;
        }
        .ds-progress-fill {
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #38bdf8);
            transition: width 0.15s;
        }
        .ds-progress-labels {
            display: flex;
            justify-content: space-between;
            font-size: 11.5px;
            color: var(--text-secondary);
        }
        .ds-success-banner {
            display: none;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.25);
            color: #34d399;
            font-size: 12px;
            font-weight: 500;
            padding: 10px 14px;
            border-radius: 8px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="ds-app-wrap">
        <!-- 1. Header -->
        <header class="ds-topbar">
            <div class="ds-topbar-left">
                <h2 class="ds-title">Direct Share</h2>
                <span class="ds-subtitle-badge">Peer-to-Peer LAN</span>
            </div>
            <div class="ds-connected-badge">
                <span class="ds-live-dot"></span>
                <span>${escapeHtml(deviceName)}</span>
            </div>
        </header>

        <!-- 2. Main Action Card -->
        <main class="ds-card">
            ${hasFile ? `
                <!-- File Ready for Download -->
                <div class="ds-file-download-box">
                    <div class="ds-file-meta-row">
                        <div class="ds-file-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                        </div>
                        <div class="ds-file-meta-text">
                            <div class="ds-file-meta-name">${escapeHtml(fileName)}</div>
                            <div class="ds-file-meta-size">${escapeHtml(fileSize)} • Ready from ${escapeHtml(deviceName)}</div>
                        </div>
                    </div>
                    <a href="/api/p2p/download?code=${encodeURIComponent(code)}" class="ds-btn-download-full" download="${escapeHtml(fileName)}">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                        <span>Download to Phone (${escapeHtml(fileSize)})</span>
                    </a>
                </div>

                <div class="ds-divider-row">
                    <span class="ds-divider-line"></span>
                    <span class="ds-divider-label">OR SEND FILES TO COMPUTER</span>
                    <span class="ds-divider-line"></span>
                </div>
            ` : ''}

            <!-- Send Photos/Files Dropzone -->
            <div class="ds-drop-zone" id="mobile-dropzone" onclick="document.getElementById('mobile-file-input').click();">
                <div class="ds-drop-icon-wrap">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
                <div class="ds-drop-text">
                    <h3>Send Photos & Files</h3>
                    <p>Direct peer-to-peer Wi-Fi transfer with zero cloud limits</p>
                </div>
                <button type="button" class="ds-btn-primary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    <span>Choose Photos or Files</span>
                </button>
                <input type="file" id="mobile-file-input" style="display: none;" onchange="handleMobileUpload(event)" />
            </div>

            <!-- Upload Live Progress -->
            <div class="ds-progress-box" id="upload-progress-wrap">
                <div class="ds-progress-labels">
                    <span id="upload-filename">Uploading...</span>
                    <span id="upload-percent">0%</span>
                </div>
                <div class="ds-progress-track">
                    <div class="ds-progress-fill" id="upload-progress-bar"></div>
                </div>
            </div>

            <!-- Upload Complete Banner -->
            <div class="ds-success-banner" id="upload-success-box">
                ✓ File received and saved to Computer!
            </div>

            <!-- Divider -->
            <div class="ds-divider-row">
                <span class="ds-divider-line"></span>
                <span class="ds-divider-label">OR RECEIVE VIA PIN</span>
                <span class="ds-divider-line"></span>
            </div>

            <!-- 6-Digit PIN Entry -->
            <div class="ds-pin-entry-wrap">
                <div class="ds-pin-input-row">
                    <input type="text" class="ds-pin-quick-input" id="mobile-pin-input" placeholder="Enter 6-digit PIN..." maxlength="6" autocomplete="off" />
                    <button class="ds-btn-primary ds-btn-connect" onclick="handlePinDownload()">
                        <span>Download</span>
                    </button>
                </div>
            </div>
        </main>
    </div>

    <script>
        function handleMobileUpload(event) {
            const files = event.target.files;
            if (!files || files.length === 0) return;
            const file = files[0];

            const dropzone = document.getElementById('mobile-dropzone');
            const progressWrap = document.getElementById('upload-progress-wrap');
            const progressBar = document.getElementById('upload-progress-bar');
            const filenameEl = document.getElementById('upload-filename');
            const percentEl = document.getElementById('upload-percent');
            const successBox = document.getElementById('upload-success-box');

            dropzone.style.display = 'none';
            successBox.style.display = 'none';
            progressWrap.style.display = 'flex';
            filenameEl.textContent = file.name;

            const xhr = new XMLHttpRequest();
            const uploadUrl = '/api/p2p/upload?name=' + encodeURIComponent(file.name);
            xhr.open('POST', uploadUrl, true);
            xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
            xhr.setRequestHeader('X-File-Size', file.size);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    progressBar.style.width = percent + '%';
                    percentEl.textContent = percent + '%';
                }
            };

            xhr.onload = () => {
                progressWrap.style.display = 'none';
                if (xhr.status === 200) {
                    successBox.style.display = 'block';
                    setTimeout(() => {
                        dropzone.style.display = 'flex';
                        event.target.value = '';
                    }, 4000);
                } else {
                    alert('Upload failed: ' + xhr.responseText);
                    dropzone.style.display = 'flex';
                }
            };

            xhr.onerror = () => {
                progressWrap.style.display = 'none';
                dropzone.style.display = 'flex';
                alert('Connection error while sending file');
            };

            xhr.send(file);
        }

        function handlePinDownload() {
            const pinInput = document.getElementById('mobile-pin-input');
            const pin = (pinInput.value || '').trim();
            if (pin.length !== 6) {
                alert('Please enter a valid 6-digit PIN');
                return;
            }
            window.location.href = '/api/p2p/download?code=' + encodeURIComponent(pin);
        }

        // Live Poll if waiting for file
        setInterval(async () => {
            try {
                const res = await fetch('/api/p2p/info');
                if (res.ok) {
                    const data = await res.json();
                    if (data.activeSend && !document.querySelector('.ds-file-download-box')) {
                        location.reload();
                    }
                }
            } catch (e) {}
        }, 3000);
    </script>
</body>
</html>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
    startHttpServer,
    abortActiveStreams,
    getHttpPort,
    stopHttpServer,
    downloadFileFromPeer
};
