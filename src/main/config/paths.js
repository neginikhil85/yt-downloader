const path = require('path');
const fs = require('fs');
const os = require('os');

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

function ensureExecutable(filePath) {
    if (process.platform !== 'win32' && fs.existsSync(filePath)) {
        try {
            const stat = fs.statSync(filePath);
            if ((stat.mode & 0o111) === 0) {
                fs.chmodSync(filePath, 0o755);
            }
        } catch (e) {
            // ignore chmod errors if read-only filesystem
        }
    }
}

function getYtDlpPath() {
    const isWin = process.platform === 'win32';
    const exeName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
    const platform = process.platform;
    const arch = process.arch;

    const candidatePaths = [
        // 1. Packaged production extraResources (Standalone .app / .exe bundle)
        process.resourcesPath && path.join(process.resourcesPath, 'bin', platform, exeName),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', `${platform}-${arch}`, exeName),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', exeName),

        // 2. Project root bin directory (Development & portable builds)
        path.join(PROJECT_ROOT, 'bin', platform, exeName),
        path.join(PROJECT_ROOT, 'bin', `${platform}-${arch}`, exeName),
        path.join(PROJECT_ROOT, 'bin', exeName),

        // 3. UserData directory (In-app self-updater)
        path.join(os.homedir(), '.yt_downloader', 'bin', exeName)
    ].filter(Boolean);

    for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate)) {
            ensureExecutable(candidate);
            return candidate;
        }
    }

    return path.join(PROJECT_ROOT, 'bin', platform, exeName);
}

function getFfmpegInfo() {
    const isWin = process.platform === 'win32';
    const ffmpegExe = isWin ? 'ffmpeg.exe' : 'ffmpeg';
    const platform = process.platform;
    const arch = process.arch;

    const candidatePaths = [
        // 1. Packaged production extraResources (Standalone .app / .exe bundle)
        process.resourcesPath && path.join(process.resourcesPath, 'bin', platform, ffmpegExe),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', `${platform}-${arch}`, ffmpegExe),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', ffmpegExe),

        // 2. Project root bin directory (Development & portable builds)
        path.join(PROJECT_ROOT, 'bin', platform, ffmpegExe),
        path.join(PROJECT_ROOT, 'bin', `${platform}-${arch}`, ffmpegExe),
        path.join(PROJECT_ROOT, 'bin', ffmpegExe),

        // 3. UserData directory (In-app self-updater)
        path.join(os.homedir(), '.yt_downloader', 'bin', ffmpegExe)
    ].filter(Boolean);

    for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate)) {
            ensureExecutable(candidate);
            return {
                dir: path.dirname(candidate),
                path: candidate
            };
        }
    }

    const defaultPath = path.join(PROJECT_ROOT, 'bin', platform, ffmpegExe);
    return { dir: path.dirname(defaultPath), path: defaultPath };
}

const YT_DLP_PATH = getYtDlpPath();
const { dir: FFMPEG_DIR, path: FFMPEG_PATH } = getFfmpegInfo();

module.exports = {
    YT_DLP_PATH,
    FFMPEG_DIR,
    FFMPEG_PATH
};


