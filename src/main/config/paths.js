const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

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
        // 1. Packaged production extraResources (priority inside built .app / standalone)
        process.resourcesPath && path.join(process.resourcesPath, 'bin', platform, exeName),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', `${platform}-${arch}`, exeName),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', exeName),

        // 2. Project root bin directory (for local development & portable bundles)
        path.join(PROJECT_ROOT, 'bin', platform, exeName),
        path.join(PROJECT_ROOT, 'bin', `${platform}-${arch}`, exeName),
        path.join(PROJECT_ROOT, 'bin', exeName),

        // 3. Local venv (only on Windows or if valid python exists)
        isWin && path.join(PROJECT_ROOT, 'venv', 'Scripts', exeName),
        isWin && process.resourcesPath && path.join(process.resourcesPath, 'app', 'venv', 'Scripts', exeName),

        // 4. UserData bin directory (for self-updating binaries)
        path.join(os.homedir(), '.yt_downloader', 'bin', exeName)
    ].filter(Boolean);

    for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate)) {
            ensureExecutable(candidate);
            return candidate;
        }
    }

    // 2. Search common system directories
    if (!isWin) {
        const standardLocations = [
            `/opt/homebrew/bin/${exeName}`,
            `/usr/local/bin/${exeName}`,
            `/usr/bin/${exeName}`,
            `/bin/${exeName}`,
            path.join(os.homedir(), '.local', 'bin', exeName)
        ];
        for (const loc of standardLocations) {
            if (fs.existsSync(loc)) {
                ensureExecutable(loc);
                return loc;
            }
        }
    }

    // 3. Fallback to system PATH
    const systemFound = findInSystemPath(isWin ? 'yt-dlp.exe' : 'yt-dlp');
    if (systemFound) {
        return systemFound;
    }

    return exeName;
}

function findFileRecursive(dir, filename, maxDepth = 6) {
    if (maxDepth <= 0 || !fs.existsSync(dir)) return null;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const res = findFileRecursive(fullPath, filename, maxDepth - 1);
                if (res) return res;
            } else if (entry.isFile() && (entry.name.toLowerCase() === filename.toLowerCase())) {
                return fullPath;
            }
        }
    } catch (e) {
        // ignore errors
    }
    return null;
}

function getFfmpegInfo() {
    const isWin = process.platform === 'win32';
    const ffmpegExe = isWin ? 'ffmpeg.exe' : 'ffmpeg';
    const platform = process.platform;
    const arch = process.arch;

    // 1. Check bundled standalone binary locations
    const candidatePaths = [
        // Electron production packaged resourcesPath
        process.resourcesPath && path.join(process.resourcesPath, 'bin', platform, ffmpegExe),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', `${platform}-${arch}`, ffmpegExe),
        process.resourcesPath && path.join(process.resourcesPath, 'bin', ffmpegExe),
        // Project root bin directory
        path.join(PROJECT_ROOT, 'bin', platform, ffmpegExe),
        path.join(PROJECT_ROOT, 'bin', `${platform}-${arch}`, ffmpegExe),
        path.join(PROJECT_ROOT, 'bin', ffmpegExe),
        // UserData bin directory
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

    // 2. Search common system directories (fast exact paths)
    if (!isWin) {
        const standardLocations = [
            `/opt/homebrew/bin/${ffmpegExe}`,
            `/usr/local/bin/${ffmpegExe}`,
            `/usr/bin/${ffmpegExe}`,
            `/bin/${ffmpegExe}`
        ];
        for (const loc of standardLocations) {
            if (fs.existsSync(loc)) {
                ensureExecutable(loc);
                return { dir: path.dirname(loc), path: loc };
            }
        }
    }

    // 3. Fallback to system PATH
    const systemFound = findInSystemPath(ffmpegExe);
    if (systemFound) {
        return {
            dir: path.dirname(systemFound),
            path: systemFound
        };
    }

    // 4. Last resort: Check dynamic venv or static-ffmpeg
    const venvPath = path.join(PROJECT_ROOT, 'venv');
    let found = findFileRecursive(venvPath, ffmpegExe);

    if (!found) {
        const staticFfmpegHome = path.join(os.homedir(), '.static_ffmpeg');
        found = findFileRecursive(staticFfmpegHome, ffmpegExe);
    }

    if (found) {
        ensureExecutable(found);
        return {
            dir: path.dirname(found),
            path: found
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


