// ==========================================================================
// YT Studio Pro / Bruno — Universal Binary Setup Engine
// ==========================================================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const BIN_DIR = path.join(PROJECT_ROOT, 'bin');

const SOURCES = {
    ytDlp: {
        darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
        win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
        linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux'
    },
    ffmpegZip: {
        darwin: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-osx-64.zip',
        win32: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-win-64.zip',
        linux: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-linux-64.zip'
    }
};

/**
 * Downloads a file with redirect follow support and fallback to curl
 */
function downloadFile(url, destPath, maxRedirects = 10) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            return reject(new Error(`Too many redirects for URL: ${url}`));
        }

        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (NodeJS yt-downloader-setup)'
            }
        }, (res) => {
            // Handle HTTP Redirects (301, 302, 303, 307, 308)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    const parsedUrl = new URL(url);
                    redirectUrl = new URL(redirectUrl, parsedUrl.origin).href;
                }
                res.resume();
                return downloadFile(redirectUrl, destPath, maxRedirects - 1)
                    .then(resolve)
                    .catch(reject);
            }

            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }

            const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
            let downloadedBytes = 0;
            let lastPercent = -1;

            const fileStream = fs.createWriteStream(destPath);
            res.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes > 0) {
                    const percent = Math.floor((downloadedBytes / totalBytes) * 100);
                    if (percent !== lastPercent && percent % 10 === 0) {
                        lastPercent = percent;
                        process.stdout.write(`  [DOWNLOADING] ${percent}% (${(downloadedBytes / (1024 * 1024)).toFixed(1)}MB / ${(totalBytes / (1024 * 1024)).toFixed(1)}MB)\r`);
                    }
                }
            });

            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close(() => {
                    process.stdout.write('\n');
                    resolve(destPath);
                });
            });

            fileStream.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });

        req.on('error', (err) => {
            // Fallback to system curl if available (e.g. proxy or local certificate issues)
            try {
                process.stdout.write(`  [INFO] Invoking curl fallback...\n`);
                execSync(`curl -L -s --retry 3 -o "${destPath}" "${url}"`, { stdio: 'inherit' });
                if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
                    return resolve(destPath);
                }
            } catch (curlErr) {
                // ignore
            }
            reject(err);
        });

        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error(`Connection timed out for: ${url}`));
        });
    });
}

/**
 * Extracts a zip archive to a destination directory
 */
function extractZip(zipPath, targetDir) {
    fs.mkdirSync(targetDir, { recursive: true });
    if (process.platform === 'win32') {
        execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`, { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
        try {
            execSync(`/usr/bin/ditto -x -k "${zipPath}" "${targetDir}"`, { stdio: 'ignore' });
        } catch (e) {
            execSync(`unzip -q -o "${zipPath}" -d "${targetDir}"`, { stdio: 'ignore' });
        }
    } else {
        execSync(`unzip -q -o "${zipPath}" -d "${targetDir}"`, { stdio: 'ignore' });
    }
}

/**
 * Ensure binaries are ready for a given platform
 */
async function ensurePlatformBinaries(platform, options = {}) {
    const isWin = platform === 'win32';
    const force = options.force || false;

    const platformBinDir = path.join(BIN_DIR, platform);
    fs.mkdirSync(platformBinDir, { recursive: true });

    const ytDlpName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
    const ffmpegName = isWin ? 'ffmpeg.exe' : 'ffmpeg';

    const ytDlpPath = path.join(platformBinDir, ytDlpName);
    const ffmpegPath = path.join(platformBinDir, ffmpegName);

    console.log(`[INFO] Checking binaries for [${platform}] in bin/${platform}...`);

    // 1. Check / Download yt-dlp
    const ytDlpValid = fs.existsSync(ytDlpPath) && fs.statSync(ytDlpPath).size > 100000;
    if (!ytDlpValid || force) {
        console.log(`[INFO] Fetching yt-dlp for ${platform}...`);
        const tempYtDlp = path.join(platformBinDir, `temp_${ytDlpName}`);
        try {
            await downloadFile(SOURCES.ytDlp[platform], tempYtDlp);
            if (fs.existsSync(ytDlpPath)) fs.unlinkSync(ytDlpPath);
            fs.renameSync(tempYtDlp, ytDlpPath);
            if (!isWin) fs.chmodSync(ytDlpPath, 0o755);
            console.log(`[SUCCESS] Installed: bin/${platform}/${ytDlpName}`);
        } catch (err) {
            console.warn(`[WARN] Failed to download yt-dlp: ${err.message}`);
            if (fs.existsSync(tempYtDlp)) fs.unlinkSync(tempYtDlp);
        }
    } else {
        if (!isWin) fs.chmodSync(ytDlpPath, 0o755);
        console.log(`[SUCCESS] Verified: bin/${platform}/${ytDlpName}`);
    }

    // 2. Check / Setup ffmpeg
    const ffmpegValid = fs.existsSync(ffmpegPath) && fs.statSync(ffmpegPath).size > 100000;
    if (!ffmpegValid || force) {
        let ffmpegCopied = false;

        // If target platform is current host platform, try copying from node_modules/ffmpeg-static
        if (platform === process.platform) {
            try {
                const ffmpegStaticPath = require('ffmpeg-static');
                if (ffmpegStaticPath && fs.existsSync(ffmpegStaticPath)) {
                    fs.copyFileSync(ffmpegStaticPath, ffmpegPath);
                    if (!isWin) fs.chmodSync(ffmpegPath, 0o755);
                    console.log(`[SUCCESS] Copied from ffmpeg-static: bin/${platform}/${ffmpegName}`);
                    ffmpegCopied = true;
                }
            } catch (e) {}
        }

        // If not copied, download official static build zip
        if (!ffmpegCopied) {
            console.log(`[INFO] Fetching static ffmpeg for ${platform}...`);
            const zipPath = path.join(platformBinDir, `ffmpeg_temp.zip`);
            const extractDir = path.join(platformBinDir, `ffmpeg_extract`);

            try {
                await downloadFile(SOURCES.ffmpegZip[platform], zipPath);
                extractZip(zipPath, extractDir);

                // Find ffmpeg binary inside extracted folder
                const files = fs.readdirSync(extractDir);
                const exeMatch = files.find(f => f.toLowerCase() === ffmpegName.toLowerCase());
                if (exeMatch) {
                    const extractedExePath = path.join(extractDir, exeMatch);
                    if (fs.existsSync(ffmpegPath)) fs.unlinkSync(ffmpegPath);
                    fs.copyFileSync(extractedExePath, ffmpegPath);
                    if (!isWin) fs.chmodSync(ffmpegPath, 0o755);
                    console.log(`[SUCCESS] Extracted: bin/${platform}/${ffmpegName}`);
                }

                // Cleanup temp files
                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
            } catch (err) {
                console.warn(`[WARN] Failed to download ffmpeg: ${err.message}`);
                if (fs.existsSync(zipPath)) try { fs.unlinkSync(zipPath); } catch (e) {}
                if (fs.existsSync(extractDir)) try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (e) {}
            }
        }
    } else {
        if (!isWin) fs.chmodSync(ffmpegPath, 0o755);
        console.log(`[SUCCESS] Verified: bin/${platform}/${ffmpegName}`);
    }

    return true;
}

/**
 * Main Setup Entrypoint
 */
async function main() {
    const args = process.argv.slice(2);
    const force = args.includes('--force') || args.includes('-f');
    const allPlatforms = args.includes('--all') || args.includes('--platform=all');
    const targetArg = args.find(a => a.startsWith('--platform='));
    const specifiedPlatform = targetArg ? targetArg.split('=')[1] : null;

    console.log('----------------------------------------------------');
    console.log('YT Studio Pro / Bruno — Binary Auto-Setup');
    console.log('----------------------------------------------------');

    if (allPlatforms) {
        for (const p of ['darwin', 'win32', 'linux']) {
            await ensurePlatformBinaries(p, { force });
        }
    } else if (specifiedPlatform) {
        if (['darwin', 'win32', 'linux'].includes(specifiedPlatform)) {
            await ensurePlatformBinaries(specifiedPlatform, { force });
        } else {
            console.error(`[ERROR] Unknown platform: ${specifiedPlatform}. Options: darwin, win32, linux.`);
        }
    } else {
        // Default to host OS
        await ensurePlatformBinaries(process.platform, { force });
    }

    console.log('\n[SUCCESS] Binary setup completed.\n');
}

if (require.main === module) {
    main().catch(err => {
        console.error(`\n[ERROR] Setup failed:`, err.message);
        process.exit(0);
    });
}

module.exports = {
    ensurePlatformBinaries,
    downloadFile,
    extractZip
};
