// ==========================================================================
// YT Studio Pro — P2P Share Service Facade & Orchestrator
// Coordinates HTTP Server, UDP Discovery, Token Codec, and Session State
// ==========================================================================

const fs = require('fs');
const path = require('path');
const { localPeerId, localDeviceName, generateTransferCode, getLocalIpAddresses, getPrimaryIp, formatBytes } = require('./p2p/p2pUtils');
const { compressToken, decompressToken } = require('./p2p/p2pTokenCodec');
const { startDiscoverySocket, broadcastDiscovery, stopDiscoverySocket, getDiscoveredPeers } = require('./p2p/p2pDiscovery');
const { startHttpServer, getHttpPort, stopHttpServer, downloadFileFromPeer } = require('./p2p/p2pHttpServer');

// Active Outgoing Share Session (Sender state)
let currentSendSession = null;
// Active Incoming Download Session (Receiver state)
let currentReceiveSession = null;

// Progress notification callback for Electron Renderer
let progressCallback = null;

function notifyRenderer(event, data) {
    if (progressCallback) {
        progressCallback(event, data);
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
        onSendProgress: (data) => notifyRenderer('p2p:send-progress', data)
    });

    startDiscoverySocket({
        localPeerId,
        localDeviceName,
        getHttpPort,
        getActiveSend: () => currentSendSession ? {
            code: currentSendSession.code,
            name: currentSendSession.file.name,
            size: currentSendSession.file.size,
            formattedSize: currentSendSession.file.formattedSize
        } : null,
        onPeersUpdated: (peers) => notifyRenderer('p2p:peers-updated', peers)
    });
}

/**
 * Starts sharing a local file
 */
async function startSendSession(filePath) {
    if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File does not exist' };
    }

    const stat = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const code = generateTransferCode();

    currentSendSession = {
        code,
        filePath,
        file: {
            name: fileName,
            size: stat.size,
            formattedSize: formatBytes(stat.size)
        },
        startTime: Date.now()
    };

    // Immediate beacon broadcast
    broadcastDiscovery({
        localPeerId,
        localDeviceName,
        getHttpPort,
        getActiveSend: () => ({
            code,
            name: fileName,
            size: stat.size,
            formattedSize: formatBytes(stat.size)
        })
    });

    return {
        success: true,
        code,
        localIp: getPrimaryIp(),
        port: getHttpPort(),
        deviceName: localDeviceName,
        file: currentSendSession.file
    };
}

/**
 * Cancels active outgoing share session
 */
function cancelSendSession() {
    currentSendSession = null;
    broadcastDiscovery({
        localPeerId,
        localDeviceName,
        getHttpPort,
        getActiveSend: () => null
    });
    return { success: true };
}

/**
 * Connects and receives a file by 6-digit code or peer IP
 */
async function receiveByCodeOrPeer(params = {}) {
    const { code, ip, port, targetDir } = params;

    let targetIp = ip;
    let targetPort = port || 9876;

    // If only code is provided, search discovered LAN peers table first
    if (!targetIp && code) {
        const peers = getDiscoveredPeers();
        const found = peers.find(p => p.activeSend && p.activeSend.code === code);
        if (found) {
            targetIp = found.ip;
            targetPort = found.port || 9876;
        }
    }

    if (!targetIp) {
        return {
            success: false,
            error: 'Could not find a device hosting this transfer code on the local network.'
        };
    }

    try {
        const result = await downloadFileFromPeer({
            ip: targetIp,
            port: targetPort,
            code,
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

module.exports = {
    initP2PService,
    setProgressCallback,
    startSendSession,
    startSendingFile: startSendSession,
    cancelSendSession,
    cancelSendingFile: cancelSendSession,
    receiveByCodeOrPeer,
    connectByCode: (code) => receiveByCodeOrPeer({ code }),
    receiveFileFromPeer: (ip, port, code) => receiveByCodeOrPeer({ ip, port, code }),
    cancelReceiving,
    sendClipboardToPeer,
    getLocalP2PInfo,
    getLocalInfo: getLocalP2PInfo,
    getDiscoveredPeers,
    compressToken,
    decompressToken
};
