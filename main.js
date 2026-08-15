const { app, BrowserWindow, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { createMainWindow, getMainWindow } = require('./src/main/windowManager');
const { registerIpcHandlers } = require('./src/main/ipcHandlers');

// Suppress verbose Chromium internal debug logs
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-logging');

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

const CHROME_UA_DESKTOP = process.platform === 'darwin'
    ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

app.userAgentFallback = CHROME_UA_DESKTOP;

function configureBrowserSession(sess) {
    if (!sess) return;
    sess.setUserAgent(CHROME_UA_DESKTOP);

    // Filter and sanitize request headers for all outgoing requests (Google Sign-In / OAuth / Media)
    sess.webRequest.onBeforeSendHeaders((details, callback) => {
        const headers = { ...details.requestHeaders };

        // Strip any electron, builder, or custom app identifiers from User-Agent
        let currentUa = headers['User-Agent'] || headers['user-agent'] || CHROME_UA_DESKTOP;
        currentUa = currentUa
            .replace(/Electron\/\S+\s*/gi, '')
            .replace(/yt-downloader-pro\/\S+\s*/gi, '')
            .replace(/bruno\/\S+\s*/gi, '')
            .trim();
        headers['User-Agent'] = currentUa || CHROME_UA_DESKTOP;

        // Ensure proper Client Hints for Google and OAuth authentication
        if (
            details.url.includes('google.com') ||
            details.url.includes('googleapis.com') ||
            details.url.includes('gstatic.com') ||
            details.url.includes('openai.com') ||
            details.url.includes('chatgpt.com')
        ) {
            headers['sec-ch-ua'] = '"Chromium";v="133", "Google Chrome";v="133", "Not?A_Brand";v="99"';
            headers['sec-ch-ua-mobile'] = '?0';
            headers['sec-ch-ua-platform'] = process.platform === 'darwin' ? '"macOS"' : '"Windows"';
        }

        // YouTube referer/origin headers to bypass error 153 and domain embed blocks
        if (details.url.includes('youtube.com') || details.url.includes('googlevideo.com') || details.url.includes('youtube-nocookie.com')) {
            headers['Referer'] = 'https://www.youtube.com/';
            headers['Origin'] = 'https://www.youtube.com';
        }

        callback({ requestHeaders: headers });
    });

    // Strip frame and CSP restrictions for embedded windows
    sess.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders };
        if (details.url.includes('youtube.com') || details.url.includes('youtube-nocookie.com')) {
            delete responseHeaders['x-frame-options'];
            delete responseHeaders['X-Frame-Options'];
            delete responseHeaders['content-security-policy'];
            delete responseHeaders['Content-Security-Policy'];
        }
        callback({ responseHeaders });
    });
}

app.whenReady().then(() => {
    // Configure default session and persistent research browser session
    configureBrowserSession(session.defaultSession);
    configureBrowserSession(session.fromPartition('persist:main'));
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
    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

