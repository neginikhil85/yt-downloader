const {
    initP2PService,
    startSendingFile,
    cancelSendingFile,
    receiveFileFromPeer,
    connectByCode,
    cancelReceiving,
    sendClipboardToPeer,
    getDiscoveredPeers,
    setProgressCallback,
    getLocalInfo
} = require('./services/p2pShareService');

/**
 * Registers all IPC handlers
 */
function registerIpcHandlers(getMainWindow) {
    // Initialize P2P Background Discovery & Service
    initP2PService();

    // Hook P2P real-time events to the renderer window
    setProgressCallback((eventName, payload) => {
        const win = getMainWindow();
        if (win && win.webContents) {
            win.webContents.send(eventName, payload);
        }
    });

    ipcMain.handle('search-youtube', async (event, query, page = 1) => {
        return searchYouTube(query, page);
    });

    ipcMain.handle('get-stream-url', async (event, url) => {
        return getStreamUrl(url);
    });

    ipcMain.handle('start-download', async (event, options) => {
        return startDownload(event, options);
    });

    ipcMain.handle('cancel-download', async (event, downloadId) => {
        return cancelDownload(downloadId);
    });

    ipcMain.handle('select-folder', async () => {
        return selectFolder(getMainWindow());
    });

    ipcMain.handle('open-in-finder', async (event, targetPath) => {
        return openInFinder(targetPath);
    });

    ipcMain.handle('get-default-save-path', () => {
        return getDefaultSavePath();
    });

    ipcMain.handle('get-library-files', async (event, dirPath) => {
        return getLibraryFiles(dirPath);
    });

    // ======================================================================
    // ToffeeShare App-to-App Direct P2P IPC Handlers
    // ======================================================================
    ipcMain.handle('p2p-get-local-info', () => {
        return getLocalInfo();
    });

    ipcMain.handle('p2p-get-peers', () => {
        return getDiscoveredPeers();
    });

    ipcMain.handle('p2p-start-send', async (event, filePath) => {
        return startSendingFile(filePath);
    });

    ipcMain.handle('p2p-cancel-send', () => {
        return cancelSendingFile();
    });

    ipcMain.handle('p2p-receive-code', async (event, code) => {
        return connectByCode(code);
    });

    ipcMain.handle('p2p-receive-peer', async (event, { ip, port, code }) => {
        return receiveFileFromPeer(ip, port, code);
    });

    ipcMain.handle('p2p-cancel-receive', () => {
        return cancelReceiving();
    });

    ipcMain.handle('p2p-send-clipboard', async (event, { ip, port, text }) => {
        return sendClipboardToPeer(ip, port, text);
    });
}

module.exports = {
    registerIpcHandlers
};
