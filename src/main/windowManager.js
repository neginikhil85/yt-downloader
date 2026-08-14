const { BrowserWindow } = require('electron');
const path = require('path');

let mainWindow = null;

function createMainWindow() {
    const isMac = process.platform === 'darwin';

    mainWindow = new BrowserWindow({
        width: 1240,
        height: 860,
        minWidth: 980,
        minHeight: 680,
        title: 'YT Studio Pro',
        titleBarStyle: isMac ? 'hiddenInset' : 'default',
        trafficLightPosition: isMac ? { x: 18, y: 18 } : undefined,
        autoHideMenuBar: !isMac,
        backgroundColor: '#0c0d0e',
        webPreferences: {
            preload: path.join(__dirname, '..', '..', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));

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
