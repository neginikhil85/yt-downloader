const path = require('path');
const fs = require('fs');
const { app, dialog, shell } = require('electron');

/**
 * Gets default save directory
 */
function getDefaultSavePath() {
    const defaultPath = path.join(app.getPath('downloads'), 'YT_Downloads');
    if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath, { recursive: true });
    }
    return defaultPath;
}

/**
 * Opens native folder selection dialog
 */
async function selectFolder(browserWindow) {
    const result = await dialog.showOpenDialog(browserWindow, {
        properties: ['openDirectory', 'createDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
}

/**
 * Reveals a file or folder in macOS Finder
 */
function openInFinder(targetPath) {
    if (fs.existsSync(targetPath)) {
        if (fs.lstatSync(targetPath).isDirectory()) {
            shell.openPath(targetPath);
        } else {
            shell.showItemInFolder(targetPath);
        }
        return true;
    }
    return false;
}

/**
 * Directly opens / launches a file in its default system application
 */
function openFile(targetPath) {
    if (fs.existsSync(targetPath)) {
        shell.openPath(targetPath);
        return true;
    }
    return false;
}

/**
 * Scans directory for local media files
 */
function getLibraryFiles(dirPath) {
    const targetDir = dirPath || getDefaultSavePath();
    if (!fs.existsSync(targetDir)) return [];

    const files = fs.readdirSync(targetDir);
    return files
        .filter((f) => /\.(mp4|mkv|webm|mp3|m4a)$/i.test(f))
        .map((f) => {
            const fullPath = path.join(targetDir, f);
            const stats = fs.statSync(fullPath);
            const sizeMb = (stats.size / (1024 * 1024)).toFixed(1);
            return {
                name: f,
                fullPath,
                size: `${sizeMb} MB`,
                date: stats.mtime.toLocaleDateString(),
                ext: path.extname(f).slice(1).toUpperCase()
            };
        });
}

/**
 * Opens native file selection dialog to select a file for direct P2P sharing
 */
async function selectFileToSend(browserWindow) {
    const result = await dialog.showOpenDialog(browserWindow, {
        title: 'Select File to Send',
        buttonLabel: 'Select File',
        properties: ['openFile']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
}

module.exports = {
    getDefaultSavePath,
    selectFolder,
    selectFileToSend,
    openInFinder,
    openFile,
    getLibraryFiles
};
