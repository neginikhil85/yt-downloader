const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { YT_DLP_PATH, FFMPEG_DIR } = require('../config/paths');

const activeDownloads = new Map();
const EXTRACTOR_ARGS = ['--no-check-certificates', '--extractor-args', 'youtube:player_client=web,android,ios,mweb'];

/**
 * Spawns yt-dlp download process with real-time progress parsing
 */
function startDownload(event, { downloadId, url, savePath, formatPreset }) {
    const targetDir = savePath || path.join(app.getPath('downloads'), 'YT_Downloads');
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    let formatOption = ['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4'];
    if (formatPreset === '1080p') {
        formatOption = ['-f', 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]', '--merge-output-format', 'mp4'];
    } else if (formatPreset === '720p') {
        formatOption = ['-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]', '--merge-output-format', 'mp4'];
    } else if (formatPreset === '480p') {
        formatOption = ['-f', 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]/best', '--merge-output-format', 'mp4'];
    } else if (formatPreset === '360p') {
        formatOption = ['-f', 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360]/best', '--merge-output-format', 'mp4'];
    } else if (formatPreset === '240p') {
        formatOption = ['-f', 'bestvideo[height<=240][ext=mp4]+bestaudio[ext=m4a]/best[height<=240]/best', '--merge-output-format', 'mp4'];
    } else if (formatPreset === 'MP3') {
        formatOption = ['-x', '--audio-format', 'mp3', '--audio-quality', '0'];
    }

    const args = [
        ...EXTRACTOR_ARGS,
        ...formatOption,
        '-c', // Continue resuming partial downloads
        '--ffmpeg-location', FFMPEG_DIR,
        '-o', path.join(targetDir, '%(title)s.%(ext)s'),
        '--newline',
        '--no-warnings',
        url
    ];

    const child = spawn(YT_DLP_PATH, args);
    const taskState = {
        child,
        url,
        savePath: targetDir,
        formatPreset,
        downloadedFilePath: '',
        isPaused: false,
        isCancelled: false
    };
    activeDownloads.set(downloadId, taskState);

    child.stdout.on('data', (chunk) => {
        const line = chunk.toString();

        const destMatch = line.match(/\[Merger\] Merging formats into "(.+)"/) ||
                          line.match(/\[download\] Destination: (.+)/) ||
                          line.match(/\[download\] (.+) has already been downloaded/);
        if (destMatch) {
            let raw = destMatch[1].replace(/^"+|"+$/g, '').trim();
            if (!path.isAbsolute(raw)) {
                raw = path.join(targetDir, raw);
            }
            if (!/\.f\d+\.(mp4|m4a|webm)$/i.test(raw) || !taskState.downloadedFilePath) {
                taskState.downloadedFilePath = raw;
            }
        }

        const progMatch = line.match(/\[download\]\s+([\d\.]+)%\s+of\s+~?([\d\.]+\w+)\s+at\s+([\d\.]+\w+\/s)\s+ETA\s+([\d:]+)/);
        if (progMatch) {
            const percent = parseFloat(progMatch[1]);
            const totalSize = progMatch[2];
            const speed = progMatch[3];
            const eta = progMatch[4];

            event.sender.send('download-progress', {
                downloadId,
                status: 'downloading',
                percent,
                totalSize,
                speed,
                eta
            });
        }
    });

    child.stderr.on('data', (chunk) => {
        console.error('yt-dlp stderr:', chunk.toString());
    });

    child.on('close', (code) => {
        const currentTask = activeDownloads.get(downloadId);
        activeDownloads.delete(downloadId);

        if (currentTask && currentTask.isPaused) {
            event.sender.send('download-progress', {
                downloadId,
                status: 'paused'
            });
            return;
        }

        if (currentTask && currentTask.isCancelled) {
            event.sender.send('download-progress', {
                downloadId,
                status: 'cancelled'
            });
            return;
        }

        if (code === 0) {
            let finalPath = currentTask ? currentTask.downloadedFilePath : '';
            
            // Clean temp extension if present (.f137.mp4 -> .mp4)
            if (finalPath && /\.f\d+\.(mp4|m4a|webm)$/i.test(finalPath)) {
                finalPath = finalPath.replace(/\.f\d+\.(mp4|m4a|webm)$/i, '.$1');
            }

            // Fallback scan if file does not exist directly (due to title character sanitization like '|')
            if (!finalPath || !fs.existsSync(finalPath)) {
                try {
                    const files = fs.readdirSync(targetDir);
                    let latestFile = '';
                    let latestMtime = 0;
                    for (const f of files) {
                        if (/\.(mp4|mkv|webm|mp3|m4a)$/i.test(f)) {
                            const full = path.join(targetDir, f);
                            const st = fs.statSync(full);
                            if (st.mtimeMs > latestMtime) {
                                latestMtime = st.mtimeMs;
                                latestFile = full;
                            }
                        }
                    }
                    if (latestFile) {
                        finalPath = latestFile;
                    }
                } catch (e) {
                    console.error('File scan error:', e);
                }
            }

            event.sender.send('download-progress', {
                downloadId,
                status: 'completed',
                percent: 100,
                filePath: finalPath,
                saveDir: targetDir
            });
        } else {
            event.sender.send('download-progress', {
                downloadId,
                status: 'error',
                error: `Process exited with code ${code}`
            });
        }
    });

    return { success: true, downloadId, targetDir };
}

function pauseDownload(downloadId) {
    if (activeDownloads.has(downloadId)) {
        const task = activeDownloads.get(downloadId);
        task.isPaused = true;
        try {
            task.child.kill('SIGTERM');
        } catch (e) {}
        return true;
    }
    return false;
}

function cancelDownload(downloadId) {
    if (activeDownloads.has(downloadId)) {
        const task = activeDownloads.get(downloadId);
        task.isCancelled = true;
        try {
            task.child.kill('SIGKILL');
        } catch (e) {}
        activeDownloads.delete(downloadId);
        return true;
    }
    return false;
}

function deleteDownloadFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true };
        }
    } catch (e) {
        console.error('Delete file error:', e);
        return { success: false, error: e.message };
    }
    return { success: true };
}

module.exports = {
    startDownload,
    pauseDownload,
    cancelDownload,
    deleteDownloadFile
};
