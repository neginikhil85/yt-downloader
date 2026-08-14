const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    searchYouTube: (query, page = 1) => ipcRenderer.invoke('search-youtube', query, page),
    getStreamUrl: (url) => ipcRenderer.invoke('get-stream-url', url),
    startDownload: (options) => ipcRenderer.invoke('start-download', options),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    openInFinder: (filePath) => ipcRenderer.invoke('open-in-finder', filePath),
    getDefaultSavePath: () => ipcRenderer.invoke('get-default-save-path'),
    getLibraryFiles: (dirPath) => ipcRenderer.invoke('get-library-files', dirPath),
    onDownloadProgress: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('download-progress', handler);
        return () => ipcRenderer.removeListener('download-progress', handler);
    },
    // ToffeeShare App-to-App Direct P2P APIs
    p2pGetLocalInfo: () => ipcRenderer.invoke('p2p-get-local-info'),
    p2pGetPeers: () => ipcRenderer.invoke('p2p-get-peers'),
    p2pStartSend: (filePath) => ipcRenderer.invoke('p2p-start-send', filePath),
    p2pCancelSend: () => ipcRenderer.invoke('p2p-cancel-send'),
    p2pReceiveCode: (code) => ipcRenderer.invoke('p2p-receive-code', code),
    p2pReceivePeer: (options) => ipcRenderer.invoke('p2p-receive-peer', options),
    p2pCancelReceive: () => ipcRenderer.invoke('p2p-cancel-receive'),
    p2pSendClipboard: (options) => ipcRenderer.invoke('p2p-send-clipboard', options),

    // Real-time Event Listeners
    onP2PPeersUpdated: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-peers-updated', handler);
        return () => ipcRenderer.removeListener('p2p-peers-updated', handler);
    },
    onP2PSendProgress: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-send-progress', handler);
        return () => ipcRenderer.removeListener('p2p-send-progress', handler);
    },
    onP2PSendComplete: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-send-complete', handler);
        return () => ipcRenderer.removeListener('p2p-send-complete', handler);
    },
    onP2PReceiveProgress: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-receive-progress', handler);
        return () => ipcRenderer.removeListener('p2p-receive-progress', handler);
    },
    onP2PReceiveComplete: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-receive-complete', handler);
        return () => ipcRenderer.removeListener('p2p-receive-complete', handler);
    },
    onP2PReceiveError: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-receive-error', handler);
        return () => ipcRenderer.removeListener('p2p-receive-error', handler);
    },
    onP2PClipboardReceived: (cb) => {
        const handler = (event, data) => cb(data);
        ipcRenderer.on('p2p-clipboard-received', handler);
        return () => ipcRenderer.removeListener('p2p-clipboard-received', handler);
    }
});
