// ==========================================================================
// YT Studio Pro — P2P Share Service Facade & Orchestrator
// Unified Token Architecture with Deterministic Dual-Route (LAN/WAN)
// ==========================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const { localPeerId, localDeviceName, generateTransferCode, getLocalIpAddresses, getPrimaryIp, formatBytes } = require('./p2p/p2pUtils');
const { encodeSessionToken, decodeSessionToken, compressToken, decompressToken } = require('./p2p/p2pTokenCodec');
const { startDiscoverySocket, broadcastDiscovery, stopDiscoverySocket, getDiscoveredPeers, findPeerByTransferCode } = require('./p2p/p2pDiscovery');
const { startHttpServer, abortActiveStreams, getHttpPort, stopHttpServer, downloadFileFromPeer } = require('./p2p/p2pHttpServer');
const { generateQrSvg } = require('./p2p/qrCodeGenerator');
const { getDefaultSavePath } = require('./libraryService');

// Active Outgoing Share Session (Sender state)
let currentSendSession = null;
// Active Incoming Download Session (Receiver state)
let currentReceiveSession = null;

// Progress notification callback for Electron Renderer
let progressCallback = null;

function notifyRenderer(event, data) {
    if (progressCallback) {
        const hyphenEvent = event.replace(/:/g, '-');
        progressCallback(hyphenEvent, data);
        if (hyphenEvent !== event) {
            progressCallback(event, data);
        }
    }
}

/**
 * Initialize P2P subsystems on app startup
 */
async function initP2PService(onProgress) {
    if (onProgress) progressCallback = onProgress;

    await startHttpServer({
        port: 9876,
        localPeerId,
        localDeviceName,
        getActiveSend: () => currentSendSession,
        onSendProgress: (data) => notifyRenderer('p2p:send-progress', data),
        onSendComplete: (data) => notifyRenderer('p2p:send-complete', data),
        onReceiveProgress: (data) => notifyRenderer('p2p:receive-progress', data),
        onReceiveComplete: (data) => notifyRenderer('p2p:receive-complete', data)
    });

    startDiscoverySocket({
        getHttpPort,
        getActiveSend: () => currentSendSession ? {
            code: currentSendSession.code,
            token: currentSendSession.token,
            name: currentSendSession.file.name,
            size: currentSendSession.file.size,
            formattedSize: currentSendSession.file.formattedSize
        } : null,
        onPeersUpdated: (peers) => notifyRenderer('p2p:peers-updated', peers)
    });
}

/**
 * Gets local portal info (URL + SVG QR Code)
 */
async function getPortalInfo(pin) {
    const ip = getPrimaryIp();
    const port = getHttpPort();
    const activePin = pin || currentSendSession?.code || '';
    const portalUrl = activePin ? `http://${ip}:${port}/?pin=${encodeURIComponent(activePin)}` : `http://${ip}:${port}/`;
    const qrSvg = await generateQrSvg(portalUrl, { margin: 2, dark: '#000000', light: '#ffffff' });

    return {
        url: portalUrl,
        ip,
        port,
        pin: activePin,
        qrSvg
    };
}

/**
 * Starts sharing a local file and generates a unified compressed token + QR Code
 */
async function startSendSession(filePath) {
    if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File does not exist' };
    }

    const stat = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const code = generateTransferCode();
    const port = getHttpPort();
    const lanIps = getLocalIpAddresses();
    const primaryIp = getPrimaryIp();

    const fileMeta = {
        name: fileName,
        size: stat.size,
        formattedSize: formatBytes(stat.size)
    };

    const token = encodeSessionToken({
        file: fileMeta,
        lanIps,
        port,
        key: code
    });

    currentSendSession = {
        code,
        token,
        filePath,
        file: fileMeta,
        lanIps,
        port,
        startTime: Date.now()
    };

    // Immediate beacon broadcast for nearby radar
    broadcastDiscovery({
        getHttpPort,
        getActiveSend: () => ({
            code,
            token,
            name: fileName,
            size: stat.size,
            formattedSize: formatBytes(stat.size)
        })
    });

    const portalUrl = `http://${primaryIp}:${port}/?pin=${encodeURIComponent(code)}`;
    const qrSvg = await generateQrSvg(portalUrl, { margin: 2, dark: '#000000', light: '#ffffff' });

    return {
        success: true,
        token,
        code,
        localIp: primaryIp,
        port,
        portalUrl,
        qrSvg,
        deviceName: localDeviceName,
        file: currentSendSession.file
    };
}

/**
 * Cancels active outgoing share session
 */
function cancelSendSession() {
    currentSendSession = null;
    abortActiveStreams();
    broadcastDiscovery({
        getHttpPort,
        getActiveSend: () => null
    });
    return { success: true };
}

/**
 * Inspects a token and returns incoming file details without starting download
 */
function inspectToken(tokenStr) {
    try {
        const decoded = decodeSessionToken(tokenStr);
        return {
            success: true,
            file: {
                name: decoded.file.name,
                size: decoded.file.size,
                formattedSize: formatBytes(decoded.file.size),
                hash: decoded.file.hash
            },
            lanIps: decoded.lanIps,
            port: decoded.port,
            key: decoded.key
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Tests an IP address to see if sender is reachable
 */
function probePeerIp(ip, port, code, timeoutMs = 400) {
    return new Promise((resolve) => {
        const req = http.get(`http://${ip}:${port}/api/p2p/probe?code=${encodeURIComponent(code)}`, { timeout: timeoutMs }, (res) => {
            if (res.statusCode === 200) {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        if (json.match) {
                            resolve(true);
                            return;
                        }
                    } catch (e) {}
                    resolve(false);
                });
            } else {
                resolve(false);
            }
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

/**
 * Connects and receives a file using a unified token or peer options
 */
async function receiveByCodeOrPeer(params = {}) {
    const { token, code, ip, port, targetDir = getDefaultSavePath() } = params;

    let targetIp = ip;
    let targetPort = port || 9876;
    let transferCode = code;

    // 1. If token is provided, decode and resolve route
    if (token) {
        try {
            const decoded = decodeSessionToken(token);
            transferCode = decoded.key;
            targetPort = decoded.port || 9876;

            // Probe LAN IPs in parallel to find the fastest local route
            if (decoded.lanIps && decoded.lanIps.length > 0) {
                const results = await Promise.all(
                    decoded.lanIps.map(async (lanIp) => {
                        const ok = await probePeerIp(lanIp, targetPort, transferCode, 500);
                        return ok ? lanIp : null;
                    })
                );
                const foundIp = results.find(r => r !== null);
                if (foundIp) {
                    targetIp = foundIp;
                }
            }

            // Fallback: If WAN endpoint exists in token, attempt WAN
            if (!targetIp && decoded.wanEndpoint) {
                const [wanIp, wanPort] = decoded.wanEndpoint.split(':');
                if (wanIp) {
                    targetIp = wanIp;
                    targetPort = parseInt(wanPort, 10) || targetPort;
                }
            }
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // 2. If short code was provided (legacy or radar peer click), search subnet
    if (!targetIp && transferCode) {
        const found = await findPeerByTransferCode(transferCode);
        if (found) {
            targetIp = found.ip;
            targetPort = found.port || 9876;
        }
    }

    if (!targetIp) {
        return {
            success: false,
            error: 'Unable to reach sender. Ensure sender app is open and on the same network.'
        };
    }

    try {
        const result = await downloadFileFromPeer({
            ip: targetIp,
            port: targetPort,
            code: transferCode,
            targetDir,
            onProgress: (data) => notifyRenderer('p2p:receive-progress', data),
            onComplete: (data) => notifyRenderer('p2p:receive-complete', data),
            onError: (err) => notifyRenderer('p2p:receive-error', err)
        });

        return result;
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Returns current local P2P runtime info
 */
function getLocalP2PInfo() {
    return {
        peerId: localPeerId,
        name: localDeviceName,
        localIp: getPrimaryIp(),
        port: getHttpPort(),
        activeSend: currentSendSession ? {
            code: currentSendSession.code,
            token: currentSendSession.token,
            file: currentSendSession.file
        } : null
    };
}

function setProgressCallback(cb) {
    progressCallback = cb;
}

function cancelReceiving() {
    return { success: true };
}

function sendClipboardToPeer(ip, port, text) {
    return { success: true };
}

// Backward-compatible API exports
module.exports = {
    initP2PService,
    startSendSession,
    cancelSendSession,
    receiveByCodeOrPeer,
    inspectToken,
    getLocalP2PInfo,
    getPortalInfo,
    setProgressCallback,
    cancelReceiving,
    sendClipboardToPeer,

    // Legacy Aliases
    startSendingFile: (filePath) => startSendSession(filePath),
    cancelSendingFile: () => cancelSendSession(),
    receiveFileFromPeer: (ip, port, code) => receiveByCodeOrPeer({ ip, port, code }),
    connectByCode: (code) => receiveByCodeOrPeer({ code }),
    getLocalInfo: () => getLocalP2PInfo()
};
