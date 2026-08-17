const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    searchYouTube: (query, page = 1) => ipcRenderer.invoke('search-youtube', query, page),
    getVideoFormats: (url) => ipcRenderer.invoke('get-video-formats', url),
    getStreamUrl: (url, quality = 'auto') => ipcRenderer.invoke('get-stream-url', url, quality),
    startDownload: (options) => ipcRenderer.invoke('start-download', options),
    pauseDownload: (downloadId) => ipcRenderer.invoke('pause-download', downloadId),
    cancelDownload: (downloadId) => ipcRenderer.invoke('cancel-download', downloadId),
    deleteDownloadFile: (filePath) => ipcRenderer.invoke('delete-download-file', filePath),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    selectFileToSend: () => ipcRenderer.invoke('select-file-to-send'),
    getFilePath: (file) => {
        try {
            if (webUtils && typeof webUtils.getPathForFile === 'function') {
                return webUtils.getPathForFile(file);
            }
        } catch (e) {}
        return file?.path || '';
    },
    openInFinder: (filePath) => ipcRenderer.invoke('open-in-finder', filePath),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    getDefaultSavePath: () => ipcRenderer.invoke('get-default-save-path'),
    getLibraryFiles: (dirPath) => ipcRenderer.invoke('get-library-files', dirPath),
    onDownloadProgress: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('download-progress', handler);
        return () => ipcRenderer.removeListener('download-progress', handler);
    },
    // Direct P2P Transfer APIs
    p2pGetLocalInfo: () => ipcRenderer.invoke('p2p-get-local-info'),
    p2pGetPortalInfo: (pin) => ipcRenderer.invoke('p2p-get-portal-info', pin),
    p2pGetPeers: () => ipcRenderer.invoke('p2p-get-peers'),
    p2pStartSend: (filePath) => ipcRenderer.invoke('p2p-start-send', filePath),
    p2pCancelSend: () => ipcRenderer.invoke('p2p-cancel-send'),
    p2pInspectToken: (tokenStr) => ipcRenderer.invoke('p2p-inspect-token', tokenStr),
    p2pReceiveToken: (options) => ipcRenderer.invoke('p2p-receive-token', options),
    p2pReceiveCode: (code) => ipcRenderer.invoke('p2p-receive-code', code),
    p2pReceivePeer: (options) => ipcRenderer.invoke('p2p-receive-peer', options),
    p2pCancelReceive: () => ipcRenderer.invoke('p2p-cancel-receive'),
    p2pSendClipboard: (options) => ipcRenderer.invoke('p2p-send-clipboard', options),
    p2pCompressToken: (obj) => ipcRenderer.invoke('p2p-compress-token', obj),
    p2pDecompressToken: (tokenStr) => ipcRenderer.invoke('p2p-decompress-token', tokenStr),

    // Real-time Event Listeners
    onP2PPeersUpdated: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-peers-updated', handler);
        ipcRenderer.on('p2p:peers-updated', handler);
        return () => {
            ipcRenderer.removeListener('p2p-peers-updated', handler);
            ipcRenderer.removeListener('p2p:peers-updated', handler);
        };
    },
    onP2PSendProgress: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-send-progress', handler);
        ipcRenderer.on('p2p:send-progress', handler);
        return () => {
            ipcRenderer.removeListener('p2p-send-progress', handler);
            ipcRenderer.removeListener('p2p:send-progress', handler);
        };
    },
    onP2PSendComplete: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-send-complete', handler);
        ipcRenderer.on('p2p:send-complete', handler);
        return () => {
            ipcRenderer.removeListener('p2p-send-complete', handler);
            ipcRenderer.removeListener('p2p:send-complete', handler);
        };
    },
    onP2PReceiveProgress: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-receive-progress', handler);
        ipcRenderer.on('p2p:receive-progress', handler);
        return () => {
            ipcRenderer.removeListener('p2p-receive-progress', handler);
            ipcRenderer.removeListener('p2p:receive-progress', handler);
        };
    },
    onP2PReceiveComplete: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-receive-complete', handler);
        ipcRenderer.on('p2p:receive-complete', handler);
        return () => {
            ipcRenderer.removeListener('p2p-receive-complete', handler);
            ipcRenderer.removeListener('p2p:receive-complete', handler);
        };
    },
    onP2PReceiveError: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-receive-error', handler);
        ipcRenderer.on('p2p:receive-error', handler);
        return () => {
            ipcRenderer.removeListener('p2p-receive-error', handler);
            ipcRenderer.removeListener('p2p:receive-error', handler);
        };
    },
    onP2PClipboardReceived: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-clipboard-received', handler);
        ipcRenderer.on('p2p:clipboard-received', handler);
        return () => {
            ipcRenderer.removeListener('p2p-clipboard-received', handler);
            ipcRenderer.removeListener('p2p:clipboard-received', handler);
        };
    }
});
