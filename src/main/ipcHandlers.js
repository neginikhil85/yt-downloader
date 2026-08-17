const { ipcMain } = require('electron');
const { searchYouTube, getStreamUrl } = require('./services/youtubeService');
const { startDownload, pauseDownload, cancelDownload, deleteDownloadFile } = require('./services/downloadService');
const { selectFolder, selectFileToSend, openInFinder, openFile, getDefaultSavePath, getLibraryFiles } = require('./services/libraryService');
const {
    initP2PService,
    startSendingFile,
    cancelSendingFile,
    receiveByCodeOrPeer,
    inspectToken,
    connectByCode,
    cancelReceiving,
    sendClipboardToPeer,
    setProgressCallback,
    getLocalInfo,
    getPortalInfo
} = require('./services/p2pShareService');
const { getDiscoveredPeers } = require('./services/p2p/p2pDiscovery');

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

    ipcMain.handle('pause-download', async (event, downloadId) => {
        return pauseDownload(downloadId);
    });

    ipcMain.handle('cancel-download', async (event, downloadId) => {
        return cancelDownload(downloadId);
    });

    ipcMain.handle('delete-download-file', async (event, filePath) => {
        return deleteDownloadFile(filePath);
    });

    ipcMain.handle('select-folder', async () => {
        return selectFolder(getMainWindow());
    });

    ipcMain.handle('select-file-to-send', async () => {
        return selectFileToSend(getMainWindow());
    });

    ipcMain.handle('open-in-finder', async (event, targetPath) => {
        return openInFinder(targetPath);
    });

    ipcMain.handle('open-file', async (event, targetPath) => {
        return openFile(targetPath);
    });

    ipcMain.handle('get-default-save-path', () => {
        return getDefaultSavePath();
    });

    ipcMain.handle('get-library-files', async (event, dirPath) => {
        return getLibraryFiles(dirPath);
    });

    // ======================================================================
    // Direct P2P Transfer IPC Handlers
    // ======================================================================
    ipcMain.handle('p2p-get-local-info', () => {
        return getLocalInfo();
    });

    ipcMain.handle('p2p-get-portal-info', (event, pin) => {
        return getPortalInfo(pin);
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

    ipcMain.handle('p2p-inspect-token', (event, tokenStr) => {
        return inspectToken(tokenStr);
    });

    ipcMain.handle('p2p-receive-token', async (event, { token, targetDir }) => {
        return receiveByCodeOrPeer({ token, targetDir });
    });

    ipcMain.handle('p2p-receive-code', async (event, params) => {
        if (typeof params === 'string') {
            return receiveByCodeOrPeer({ code: params });
        }
        return receiveByCodeOrPeer(params);
    });

    ipcMain.handle('p2p-receive-peer', async (event, { ip, port, code, targetDir }) => {
        return receiveByCodeOrPeer({ ip, port, code, targetDir });
    });

    ipcMain.handle('p2p-cancel-receive', () => {
        return cancelReceiving();
    });

    ipcMain.handle('p2p-send-clipboard', async (event, { ip, port, text }) => {
        return sendClipboardToPeer(ip, port, text);
    });

    ipcMain.handle('p2p-compress-token', (event, obj) => {
        const { compressToken } = require('./services/p2p/p2pTokenCodec');
        return compressToken(obj);
    });

    ipcMain.handle('p2p-decompress-token', (event, tokenStr) => {
        const { decompressToken } = require('./services/p2p/p2pTokenCodec');
        return decompressToken(tokenStr);
    });
}

module.exports = {
    registerIpcHandlers
};
