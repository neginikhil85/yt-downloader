const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

// Ensure system environment PATH includes standard bin directories on macOS / Linux GUI app launch
if (process.platform !== 'win32') {
    const extraPaths = [
        path.join(os.homedir(), 'homebrew', 'bin'),
        path.join(os.homedir(), 'homebrew', 'sbin'),
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/bin',
        '/usr/local/sbin',
        path.join(os.homedir(), '.local/bin'),
        '/usr/bin',
        '/bin'
    ];
    const currentPaths = (process.env.PATH || '').split(':');
    const merged = Array.from(new Set([...extraPaths, ...currentPaths].filter(p => p && fs.existsSync(p))));
    process.env.PATH = merged.join(':');
}

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

function findInSystemPath(commandName) {
    try {
        const checkCmd = process.platform === 'win32' ? `where ${commandName}` : `which ${commandName}`;
        const output = execSync(checkCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        const firstLine = output.split(/[\r\n]+/)[0];
        if (firstLine && fs.existsSync(firstLine)) {
            return firstLine;
        }
    } catch (e) {
        // not found in PATH
    }
    return null;
}

function getYtDlpPath() {
    const isWin = process.platform === 'win32';
    const exeName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
    const platform = process.platform;
    const arch = process.arch;

    const candidatePaths = [
        // 1. System / Homebrew locations (Executes via system Python with root CAs — bypasses corporate proxy on macOS)
        path.join(os.homedir(), 'homebrew', 'bin', exeName),
        !isWin && `/opt/homebrew/bin/${exeName}`,
        !isWin && `/usr/local/bin/${exeName}`,
        !isWin && path.join(os.homedir(), '.local', 'bin', exeName),

        // 2. Packaged production extraResources (Priority inside built standalone .app / .exe on target machines)
        process.resourcesPath && path.join(process.resourcesPath, 'bin', platform, exeName),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', `${platform}-${arch}`, exeName),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', exeName),

        // 3. Project root bin directory (For standalone dev testing & portable bundles)
        path.join(PROJECT_ROOT, 'bin', platform, exeName),
        path.join(PROJECT_ROOT, 'bin', `${platform}-${arch}`, exeName),
        path.join(PROJECT_ROOT, 'bin', exeName),

        // 4. UserData directory (For self-updating binaries)
        path.join(os.homedir(), '.yt_downloader', 'bin', exeName)
    ].filter(Boolean);

    for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate)) {
            ensureExecutable(candidate);
            return candidate;
        }
    }

    // 5. Dynamic fallback via system PATH
    const systemFound = findInSystemPath(isWin ? 'yt-dlp.exe' : 'yt-dlp');
    if (systemFound) {
        return systemFound;
    }

    return exeName;
}

function getFfmpegInfo() {
    const isWin = process.platform === 'win32';
    const ffmpegExe = isWin ? 'ffmpeg.exe' : 'ffmpeg';
    const platform = process.platform;
    const arch = process.arch;

    // 1. Packaged standalone and bundled project binary locations
    const candidatePaths = [
        // Electron production packaged resourcesPath
        process.resourcesPath && path.join(process.resourcesPath, 'bin', platform, ffmpegExe),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', `${platform}-${arch}`, ffmpegExe),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', ffmpegExe),

        // System / Homebrew locations
        path.join(os.homedir(), 'homebrew', 'bin', ffmpegExe),
        !isWin && `/opt/homebrew/bin/${ffmpegExe}`,
        !isWin && `/usr/local/bin/${ffmpegExe}`,
        !isWin && path.join(os.homedir(), '.local', 'bin', ffmpegExe),

        // Project root bin directory
        path.join(PROJECT_ROOT, 'bin', platform, ffmpegExe),
        path.join(PROJECT_ROOT, 'bin', `${platform}-${arch}`, ffmpegExe),
        path.join(PROJECT_ROOT, 'bin', ffmpegExe),

        // UserData bin directory
        path.join(os.homedir(), '.yt_downloader', 'bin', ffmpegExe),

        // Standard OS locations
        !isWin && `/usr/bin/${ffmpegExe}`,
        !isWin && `/bin/${ffmpegExe}`
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

    // 2. Dynamic fallback via system PATH
    const systemFound = findInSystemPath(ffmpegExe);
    if (systemFound) {
        return {
            dir: path.dirname(systemFound),
            path: systemFound
        };
    }

    return { dir: '', path: ffmpegExe };
}

const YT_DLP_PATH = getYtDlpPath();
const { dir: FFMPEG_DIR, path: FFMPEG_PATH } = getFfmpegInfo();

module.exports = {
    YT_DLP_PATH,
    FFMPEG_DIR,
    FFMPEG_PATH
};


