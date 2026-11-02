// ==========================================================================
// Research Browser — file downloads (Chrome-style download manager)
//
// Every download triggered inside a browser tab shows the native "Save As"
// dialog (pre-filled with the last folder used). Progress, pause/resume,
// cancel, failures and history are streamed to the renderer's downloads panel.
// ==========================================================================

const path = require('path');
const fs = require('fs');
const { app, shell } = require('electron');

const MAX_HISTORY = 100;
const UPDATE_THROTTLE_MS = 250;

let getMainWindow = () => null;
let downloadSession = null;
let lastDir = null;
let idSeq = 0;
let persistTimer = null;

const records = new Map(); // id -> serializable record shown in the UI
const liveItems = new Map(); // id -> Electron DownloadItem (while in flight)

const historyFile = () => path.join(app.getPath('userData'), 'browser-downloads.json');

function loadHistory() {
    try {
        const data = JSON.parse(fs.readFileSync(historyFile(), 'utf8'));
        if (data && typeof data.lastDir === 'string') lastDir = data.lastDir;
        for (const rec of (data && data.items) || []) {
            if (rec.state === 'progressing' || rec.state === 'paused') {
                rec.state = 'interrupted';
                rec.error = 'App was closed before the download finished';
            }
            rec.speed = 0;
            records.set(rec.id, rec);
        }
    } catch {
        // No history yet.
    }
}

function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
        const items = sortedRecords().slice(0, MAX_HISTORY);
        try {
            fs.writeFileSync(historyFile(), JSON.stringify({ lastDir, items }, null, 2));
        } catch (err) {
            console.warn('[BrowserDownloads] Could not save history:', err.message);
        }
    }, 400);
}

function sortedRecords() {
    return [...records.values()].sort((a, b) => b.startTime - a.startTime);
}

function withFileStatus(rec) {
    if (rec.state !== 'completed' || !rec.savePath) return { ...rec };
    return { ...rec, fileMissing: !fs.existsSync(rec.savePath) };
}

function emit(channel, payload) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function updateTaskbarProgress() {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;

    let received = 0;
    let total = 0;
    let active = 0;
    for (const rec of records.values()) {
        if (rec.state !== 'progressing' && rec.state !== 'paused') continue;
        active++;
        if (rec.total > 0) {
            received += rec.received;
            total += rec.total;
        }
    }
    if (!active) win.setProgressBar(-1);
    else win.setProgressBar(total > 0 ? received / total : 2); // >1 = indeterminate
}

function notify(rec) {
    emit('browser-download:updated', withFileStatus(rec));
    updateTaskbarProgress();
}

function defaultDirectory() {
    if (lastDir && fs.existsSync(lastDir)) return lastDir;
    return app.getPath('downloads');
}

function handleWillDownload(event, item) {
    const id = `${Date.now().toString(36)}-${(idSeq++).toString(36)}`;

    item.setSaveDialogOptions({
        title: 'Save As',
        defaultPath: path.join(defaultDirectory(), item.getFilename())
    });

    let rec = null;
    let lastSentAt = 0;
    let sample = { time: Date.now(), bytes: 0 };

    // Created lazily: until the user confirms the Save As dialog there is
    // nothing to show, and a cancelled dialog should leave no trace.
    const ensureRecord = () => {
        const savePath = item.getSavePath();
        if (rec || !savePath) return rec;

        rec = {
            id,
            filename: path.basename(savePath),
            url: item.getURL(),
            savePath,
            mime: item.getMimeType(),
            total: item.getTotalBytes(),
            received: item.getReceivedBytes(),
            speed: 0,
            state: 'progressing',
            error: null,
            startTime: Date.now(),
            endTime: null,
            isNew: true
        };
        records.set(id, rec);
        liveItems.set(id, item);

        lastDir = path.dirname(savePath);
        persist();
        notify(rec);
        rec.isNew = false;
        return rec;
    };

    item.on('updated', (e, state) => {
        if (!ensureRecord()) return;

        const now = Date.now();
        const received = item.getReceivedBytes();
        if (received < sample.bytes) sample = { time: now, bytes: received }; // auto-retry restarted
        const elapsed = now - sample.time;
        if (elapsed >= 500) {
            const instant = ((received - sample.bytes) / elapsed) * 1000;
            rec.speed = rec.speed ? rec.speed * 0.6 + instant * 0.4 : instant;
            sample = { time: now, bytes: received };
        }

        const prevState = rec.state;
        rec.received = received;
        rec.total = item.getTotalBytes();
        if (state === 'interrupted') {
            rec.state = 'interrupted';
            rec.error = 'Connection interrupted';
        } else {
            rec.state = item.isPaused() ? 'paused' : 'progressing';
            rec.error = null;
        }
        if (rec.state !== 'progressing') rec.speed = 0;

        if (rec.state !== prevState || now - lastSentAt >= UPDATE_THROTTLE_MS) {
            lastSentAt = now;
            if (rec.state !== prevState) persist();
            notify(rec);
        }
    });

    item.once('done', (e, state) => {
        liveItems.delete(id);

        if (!ensureRecord()) {
            // Save As dialog was dismissed — nothing was downloaded.
            return;
        }

        rec.speed = 0;
        rec.endTime = Date.now();
        rec.received = item.getReceivedBytes();
        rec.total = item.getTotalBytes() || rec.received;

        if (state === 'completed') {
            rec.state = 'completed';
            rec.error = null;
        } else if (state === 'cancelled') {
            rec.state = 'cancelled';
            rec.error = null;
        } else {
            rec.state = 'failed';
            rec.error = 'Download failed — network or server error';
        }

        persist();
        notify(rec);
    });
}

function initBrowserDownloads(browserSession, mainWindowGetter) {
    getMainWindow = mainWindowGetter;
    downloadSession = browserSession;
    loadHistory();
    browserSession.on('will-download', handleWillDownload);
}

// --------------------------------------------------------------------------
// Actions invoked from the renderer
// --------------------------------------------------------------------------

function listDownloads() {
    return sortedRecords().map(withFileStatus);
}

function pauseDownload(id) {
    const item = liveItems.get(id);
    if (item && !item.isPaused()) item.pause();
    return !!item;
}

function resumeDownload(id) {
    const item = liveItems.get(id);
    if (item && item.canResume()) {
        item.resume();
        return true;
    }
    return retryDownload(id);
}

function cancelDownload(id) {
    const item = liveItems.get(id);
    if (item) item.cancel();
    return !!item;
}

function retryDownload(id) {
    const rec = records.get(id);
    if (!rec || !rec.url || !downloadSession) return false;
    removeDownload(id);
    downloadSession.downloadURL(rec.url);
    return true;
}

function removeDownload(id) {
    const item = liveItems.get(id);
    if (item) item.cancel();
    liveItems.delete(id);
    if (records.delete(id)) {
        persist();
        emit('browser-download:removed', id);
        updateTaskbarProgress();
    }
    return true;
}

function clearFinishedDownloads() {
    for (const rec of [...records.values()]) {
        if (rec.state !== 'progressing' && rec.state !== 'paused') removeDownload(rec.id);
    }
    return listDownloads();
}

async function openDownload(id) {
    const rec = records.get(id);
    if (!rec || !rec.savePath || !fs.existsSync(rec.savePath)) return { success: false, error: 'File not found — it may have been moved or deleted' };
    const err = await shell.openPath(rec.savePath);
    return err ? { success: false, error: err } : { success: true };
}

function showDownloadInFolder(id) {
    const rec = records.get(id);
    if (rec && rec.savePath && fs.existsSync(rec.savePath)) {
        shell.showItemInFolder(rec.savePath);
        return true;
    }
    const dir = rec && rec.savePath ? path.dirname(rec.savePath) : defaultDirectory();
    if (fs.existsSync(dir)) shell.openPath(dir);
    return false;
}

function openDownloadsFolder() {
    shell.openPath(defaultDirectory());
    return defaultDirectory();
}

module.exports = {
    initBrowserDownloads,
    listDownloads,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    removeDownload,
    clearFinishedDownloads,
    openDownload,
    showDownloadInFolder,
    openDownloadsFolder
};
