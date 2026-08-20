const { BrowserWindow } = require('electron');
const path = require('path');
const { attachWindowCrashHandler } = require('./services/crashReporter');

let mainWindow = null;

function createMainWindow() {
    const isMac = process.platform === 'darwin';

    mainWindow = new BrowserWindow({
        width: 1240,
        height: 860,
        minWidth: 980,
        minHeight: 680,
        title: 'YT Studio Pro',
        titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
        titleBarOverlay: isMac ? false : {
            color: '#08090b',
            symbolColor: '#94a3b8',
            height: 38
        },
        trafficLightPosition: isMac ? { x: 18, y: 20 } : undefined,
        autoHideMenuBar: true,
        backgroundColor: '#0c0d0e',
        webPreferences: {
            preload: path.join(__dirname, '..', '..', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true
        }
    });

    attachWindowCrashHandler(mainWindow);

    mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));

    // Forward renderer console logs and errors directly to terminal stdout
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const lvl = level === 3 ? 'ERROR' : (level === 2 ? 'WARN' : 'INFO');
        console.log(`[Renderer ${lvl} L${line}]: ${message}`);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

function getMainWindow() {
    return mainWindow;
}

module.exports = {
    createMainWindow,
    getMainWindow
};
