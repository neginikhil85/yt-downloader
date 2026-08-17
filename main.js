const { app, BrowserWindow, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { createMainWindow, getMainWindow } = require('./src/main/windowManager');
const { registerIpcHandlers } = require('./src/main/ipcHandlers');

// Suppress verbose Chromium internal debug logs & bypass corporate proxy SSL inspection errors
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-logging');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost');

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.mp4': return 'video/mp4';
        case '.mkv': return 'video/x-matroska';
        case '.webm': return 'video/webm';
        case '.mp3': return 'audio/mpeg';
        case '.m4a': return 'audio/mp4';
        case '.ogg': return 'audio/ogg';
        case '.wav': return 'audio/wav';
        default: return 'video/mp4';
    }
}

const DESKTOP_UA = process.platform === 'darwin'
    ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

const FIREFOX_UA = process.platform === 'darwin'
    ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';

function setupSessionSecurity(sess) {
    sess.setUserAgent(DESKTOP_UA);

    // Enterprise & Corporate Proxy SSL Bypass (Accepts corporate MITM inspection certificates)
    if (typeof sess.setCertificateVerifyProc === 'function') {
        sess.setCertificateVerifyProc((request, callback) => {
            callback(0); // 0 = CERT_OK, accept all certificates
        });
    }

    sess.webRequest.onBeforeSendHeaders((details, callback) => {
        const url = details.url || '';
        const isGoogleAuth = url.includes('accounts.google.com') ||
            url.includes('accounts.youtube.com') ||
            url.includes('oauth2.googleapis.com');

        // Always strip Electron and app identifiers from request headers
        if (details.requestHeaders['User-Agent']) {
            details.requestHeaders['User-Agent'] = details.requestHeaders['User-Agent']
                .replace(/Electron\/[0-9\.]+\s?/g, '')
                .replace(/yt-downloader-pro\/[0-9\.]+\s?/g, '');
        }

        if (isGoogleAuth) {
            // Google OAuth blocks Chromium WebViews; presenting modern Firefox UA allows seamless login
            details.requestHeaders['User-Agent'] = FIREFOX_UA;
            delete details.requestHeaders['sec-ch-ua'];
            delete details.requestHeaders['sec-ch-ua-mobile'];
            delete details.requestHeaders['sec-ch-ua-platform'];
            delete details.requestHeaders['sec-ch-ua-model'];
            delete details.requestHeaders['Sec-Ch-Ua'];
            delete details.requestHeaders['Sec-Ch-Ua-Mobile'];
            delete details.requestHeaders['Sec-Ch-Ua-Platform'];
            delete details.requestHeaders['Sec-Ch-Ua-Model'];
        }

        // Inject Referer & Origin headers to bypass Error 153 and domain embed blocks
        if (url.includes('youtube.com') || url.includes('youtube-nocookie.com') || url.includes('googlevideo.com')) {
            details.requestHeaders['Referer'] = 'https://www.youtube.com/';
            details.requestHeaders['Origin'] = 'https://www.youtube.com';
        }

        callback({ requestHeaders: details.requestHeaders });
    });

    sess.webRequest.onHeadersReceived((details, callback) => {
        const url = details.url || '';
        if (url.includes('youtube.com') || url.includes('youtube-nocookie.com')) {
            if (details.responseHeaders) {
                delete details.responseHeaders['x-frame-options'];
                delete details.responseHeaders['X-Frame-Options'];
                delete details.responseHeaders['content-security-policy'];
                delete details.responseHeaders['Content-Security-Policy'];
            }
        }
        callback({ responseHeaders: details.responseHeaders });
    });
}

// Register media protocol for high-performance offline video playback
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'media',
        privileges: {
            secure: true,
            standard: true,
            supportFetchAPI: true,
            stream: true,
            bypassCSP: true
        }
    }
]);

app.whenReady().then(() => {
    setupSessionSecurity(session.defaultSession);
    setupSessionSecurity(session.fromPartition('persist:main'));

    protocol.handle('media', (request) => {
        try {
            let rawPath = decodeURIComponent(request.url.replace(/^media:\/\//, ''));
            if (/^[a-zA-Z]\//.test(rawPath)) {
                rawPath = rawPath[0] + ':' + rawPath.slice(1);
            }
            if (process.platform === 'win32') {
                if (/^\/[a-zA-Z]:/.test(rawPath)) {
                    rawPath = rawPath.slice(1);
                }
            } else {
                if (!rawPath.startsWith('/')) {
                    rawPath = '/' + rawPath;
                }
            }

            const normalizedPath = path.normalize(rawPath);
            if (!fs.existsSync(normalizedPath)) {
                console.error('Media file does not exist:', normalizedPath);
                return new Response('File Not Found', { status: 404 });
            }

            const stats = fs.statSync(normalizedPath);
            const fileSize = stats.size;
            const mimeType = getMimeType(normalizedPath);
            const rangeHeader = request.headers.get('range');

            if (rangeHeader) {
                const parts = rangeHeader.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                if (start >= fileSize || end >= fileSize) {
                    return new Response('Requested Range Not Satisfiable', {
                        status: 416,
                        headers: { 'Content-Range': `bytes */${fileSize}` }
                    });
                }

                const chunkSize = (end - start) + 1;
                const nodeStream = fs.createReadStream(normalizedPath, { start, end });
                const webStream = Readable.toWeb(nodeStream);

                return new Response(webStream, {
                    status: 206,
                    statusText: 'Partial Content',
                    headers: {
                        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': String(chunkSize),
                        'Content-Type': mimeType
                    }
                });
            } else {
                const nodeStream = fs.createReadStream(normalizedPath);
                const webStream = Readable.toWeb(nodeStream);

                return new Response(webStream, {
                    status: 200,
                    headers: {
                        'Content-Length': String(fileSize),
                        'Accept-Ranges': 'bytes',
                        'Content-Type': mimeType
                    }
                });
            }
        } catch (err) {
            console.error('Media protocol error:', err);
            return new Response('Internal Server Error', { status: 500 });
        }
    });

    registerIpcHandlers(getMainWindow);

    // Route Electron sessions through local Node.js CONNECT forward proxy (Port 9876)
    // Completely bypasses corporate/Netskope browser category blocks (e.g. Generative AI, UX Pilot, ChatGPT)
    const { getHttpPort } = require('./src/main/services/p2p/p2pHttpServer');
    const proxyPort = getHttpPort() || 9876;
    const proxyRules = `http://127.0.0.1:${proxyPort}`;

    session.defaultSession.setProxy({ proxyRules }).catch(err => console.warn('Default session proxy setup:', err.message));
    session.fromPartition('persist:main').setProxy({ proxyRules }).catch(err => console.warn('Webview session proxy setup:', err.message));

    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // Prevent default Chromium cert rejection for enterprise/Netskope SSL inspection
    event.preventDefault();
    callback(true);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

