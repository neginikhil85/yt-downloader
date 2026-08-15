// ==========================================================================
// YT Studio Pro — P2P Local HTTP Streaming & Mobile Web Portal Engine
// High-speed direct TCP binary transfer, 2-Way Mobile Web Portal (Zero-Config),
// Resumable Partial Streaming & Progressive SHA-256 telemetry
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
    <title>Direct Share — ${escapeHtml(deviceName)}</title>
    <style>
        :root {
            --bg: #090a0f;
            --card: #12141c;
            --border: rgba(255, 255, 255, 0.1);
            --primary: #3b82f6;
            --accent: #38bdf8;
            --success: #10b981;
            --text: #f8fafc;
            --muted: #94a3b8;
        }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body {
            margin: 0;
            padding: 20px 16px 40px 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .app-container {
            width: 100%;
            max-width: 440px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .header {
            text-align: center;
            padding: 12px 0 6px 0;
        }
        .header h1 {
            margin: 0 0 4px 0;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .header p {
            margin: 0;
            font-size: 13px;
            color: var(--muted);
        }
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(16, 185, 129, 0.12);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.25);
            font-size: 11px;
            font-weight: 600;
            padding: 3px 10px;
            border-radius: 999px;
            margin-top: 8px;
        }
        .pulse-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #34d399;
            box-shadow: 0 0 6px #34d399;
        }
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .card-title {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.8px;
            color: var(--muted);
            text-transform: uppercase;
        }
        .file-box {
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 14px;
        }
        .file-icon {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            background: rgba(56, 189, 248, 0.12);
            border: 1px solid rgba(56, 189, 248, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--accent);
            flex-shrink: 0;
        }
        .file-meta { flex: 1; min-width: 0; }
        .file-name {
            font-size: 14px;
            font-weight: 600;
            color: #fff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 2px;
        }
        .file-size { font-size: 12px; color: var(--muted); }
        .btn-download {
            background: #2563eb;
            color: #fff;
            text-decoration: none;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 14px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        }
        .btn-download:active { transform: scale(0.98); }
        .upload-dropzone {
            border: 2px dashed rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            padding: 24px 16px;
            text-align: center;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }
        .upload-dropzone:active { border-color: var(--accent); background: rgba(56, 189, 248, 0.05); }
        .btn-upload-file {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border);
            color: #fff;
            padding: 10px 18px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }
        .progress-wrap {
            display: none;
            flex-direction: column;
            gap: 8px;
        }
        .progress-bar-track {
            width: 100%;
            height: 8px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            overflow: hidden;
        }
        .progress-bar-fill {
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #38bdf8);
            transition: width 0.15s;
        }
        .progress-status {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--muted);
        }
        .success-box {
            display: none;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 10px;
            padding: 12px;
            text-align: center;
            font-size: 13px;
            color: #34d399;
            font-weight: 500;
        }
        .empty-wait {
            text-align: center;
            padding: 16px;
            color: var(--muted);
            font-size: 13px;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 10px;
            border: 1px solid var(--border);
        }
    </style>
</head>
<body>
    <div class="app-container">
        <header class="header">
            <h1>⚡ Direct Share</h1>
            <p>Connected to <strong>${escapeHtml(deviceName)}</strong></p>
            <div class="status-badge"><span class="pulse-dot"></span> Local Wi-Fi Stream Active</div>
        </header>

        <!-- 1. Download Card (Desktop to Mobile) -->
        <section class="card" id="download-card">
            <span class="card-title">📥 Available from Computer</span>
            ${hasFile ? `
                <div class="file-box">
                    <div class="file-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                    </div>
                    <div class="file-meta">
                        <div class="file-name">${escapeHtml(fileName)}</div>
                        <div class="file-size">${escapeHtml(fileSize)}</div>
                    </div>
                </div>
                <a href="/api/p2p/download?code=${encodeURIComponent(code)}" class="btn-download" download="${escapeHtml(fileName)}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                    <span>Download to Phone (${escapeHtml(fileSize)})</span>
                </a>
            ` : `
                <div class="empty-wait">
                    <span>Waiting for computer to select a file...</span>
                </div>
            `}
        </section>

        <!-- 2. Upload Card (Mobile to Desktop) -->
        <section class="card">
            <span class="card-title">📤 Send Photos / Files to Computer</span>
            <div class="upload-dropzone" id="mobile-dropzone" onclick="document.getElementById('mobile-file-input').click();">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <button type="button" class="btn-upload-file">Choose Photo, Video or File</button>
                <input type="file" id="mobile-file-input" style="display: none;" onchange="handleMobileUpload(event)" />
            </div>

            <!-- Upload Progress -->
            <div class="progress-wrap" id="upload-progress-wrap">
                <div class="progress-status">
                    <span id="upload-filename">Uploading...</span>
                    <span id="upload-percent">0%</span>
                </div>
                <div class="progress-bar-track">
                    <div class="progress-bar-fill" id="upload-progress-bar"></div>
                </div>
                <div class="progress-status" style="justify-content: flex-end;">
                    <span id="upload-speed">Direct Wi-Fi</span>
                </div>
            </div>

            <div class="success-box" id="upload-success-box">
                ✓ File received and saved to Computer!
            </div>
        </section>
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

            let startTime = Date.now();
            let lastBytes = 0;

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

        // Live Poll if waiting for file
        setInterval(async () => {
            try {
                const res = await fetch('/api/p2p/info');
                if (res.ok) {
                    const data = await res.json();
                    if (data.activeSend && !document.querySelector('.btn-download')) {
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
