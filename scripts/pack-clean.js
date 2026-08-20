// ==========================================================================
// YT Studio Pro / Bruno — Universal Standalone Packager for macOS, Windows & Linux
// ==========================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync } = require('child_process');
const { ensurePlatformBinaries, downloadFile, extractZip } = require('./setup-binaries');

const rootDir = path.join(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');
const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist');

// Read electron version dynamically
let electronVersion = '34.0.0';
try {
    const electronPkg = require(path.join(rootDir, 'node_modules', 'electron', 'package.json'));
    electronVersion = electronPkg.version || electronVersion;
} catch (e) {}

const processName = process.env.PROCESS_NAME || 'bruno';
const appName = process.env.APP_NAME || 'bruno';

const isHostMac = process.platform === 'darwin';
const isHostWin = process.platform === 'win32';
const isHostLinux = process.platform === 'linux';

function cleanReleaseDirectory() {
    console.log('\n=== Cleaning Release Directory ===');
    if (fs.existsSync(releaseDir)) {
        const items = fs.readdirSync(releaseDir);
        items.forEach(item => {
            const itemPath = path.join(releaseDir, item);
            if (
                item.endsWith('.zip') ||
                item.endsWith('.dmg') ||
                item.endsWith('.blockmap') ||
                item.endsWith('.yml') ||
                item.startsWith('.icon') ||
                item.includes('temp-') ||
                item.includes('extract-')
            ) {
                try {
                    fs.rmSync(itemPath, { recursive: true, force: true });
                } catch (e) {}
            }
        });
    } else {
        fs.mkdirSync(releaseDir, { recursive: true });
    }
}

function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.cpSync(src, dest, { recursive: true, force: true });
}

function updateInfoPlist(plistPath, updates) {
    if (!fs.existsSync(plistPath)) return;
    let content = fs.readFileSync(plistPath, 'utf8');
    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`, 'g');
        if (regex.test(content)) {
            content = content.replace(regex, `$1${value}$2`);
        } else {
            content = content.replace('</dict>', `\t<key>${key}</key>\n\t<string>${value}</string>\n</dict>`);
        }
    }
    fs.writeFileSync(plistPath, content, 'utf8');
}

const filesToCopy = ['package.json', 'main.js', 'preload.js', 'src', 'renderer', 'assets'];
const binSrc = path.join(rootDir, 'bin');

/**
 * Copies production dependencies reliably into app/node_modules
 */
function bundleProdDependencies(targetAppDir) {
    const targetNodeModules = path.join(targetAppDir, 'node_modules');
    fs.mkdirSync(targetNodeModules, { recursive: true });

    let prodDeps = ['qrcode', 'dijkstrajs', 'pngjs'];
    try {
        const pkg = require(path.join(rootDir, 'package.json'));
        if (pkg.dependencies) {
            prodDeps = Array.from(new Set([...prodDeps, ...Object.keys(pkg.dependencies)]));
        }
    } catch (e) {}

    // Also include common sub-dependencies
    const extraSubs = ['yargs', 'yargs-parser', 'string-width', 'strip-ansi', 'ansi-regex', 'is-fullwidth-code-point', 'emoji-regex'];
    prodDeps = Array.from(new Set([...prodDeps, ...extraSubs]));

    prodDeps.forEach(dep => {
        const srcPath = path.join(rootDir, 'node_modules', dep);
        const destPath = path.join(targetNodeModules, dep);
        if (fs.existsSync(srcPath)) {
            copyRecursive(srcPath, destPath);
        }
    });
}

function populateAppResources(resourcesDir) {
    const appDir = path.join(resourcesDir, 'app');
    fs.mkdirSync(appDir, { recursive: true });

    const defaultAppAsar = path.join(resourcesDir, 'default_app.asar');
    if (fs.existsSync(defaultAppAsar)) {
        try { fs.rmSync(defaultAppAsar, { force: true }); } catch (e) {}
    }

    filesToCopy.forEach((item) => {
        const srcPath = path.join(rootDir, item);
        if (fs.existsSync(srcPath)) {
            copyRecursive(srcPath, path.join(appDir, item));
        }
    });

    bundleProdDependencies(appDir);

    if (fs.existsSync(binSrc)) {
        copyRecursive(binSrc, path.join(resourcesDir, 'bin'));
    }
}

function createZip(sourceDir, destZipPath) {
    try {
        if (fs.existsSync(destZipPath)) {
            fs.rmSync(destZipPath, { force: true });
        }
        if (process.platform === 'win32') {
            execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${destZipPath}' -Force"`, { stdio: 'ignore' });
        } else {
            const baseDir = path.dirname(sourceDir);
            const folderName = path.basename(sourceDir);
            execSync(`cd "${baseDir}" && zip -r -q "${destZipPath}" "${folderName}"`, { stdio: 'ignore' });
        }
        return fs.existsSync(destZipPath);
    } catch (e) {
        return false;
    }
}

/**
 * Ensures Electron runtime zip exists (in local cache or downloaded from GitHub releases)
 */
async function resolveElectronRuntime(platform, arch = 'x64') {
    // If target platform and architecture match current host and node_modules/electron/dist is populated
    if (platform === process.platform && fs.existsSync(electronDist)) {
        return { isDistFolder: true, path: electronDist };
    }

    // Check system and local caches
    const cacheDirs = [
        path.join(rootDir, '.cache', 'electron'),
        path.join(os.homedir(), '.cache', 'electron'),
        path.join(os.homedir(), 'Library', 'Caches', 'electron'),
        path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'electron', 'Cache')
    ];

    const zipNamePattern = `electron-v${electronVersion}-${platform}-${arch}.zip`;
    const fallbackZipPattern = `electron-v${electronVersion}-${platform}`;

    for (const cDir of cacheDirs) {
        if (fs.existsSync(cDir)) {
            const files = fs.readdirSync(cDir);
            const foundZip = files.find(f => f === zipNamePattern || (f.startsWith(fallbackZipPattern) && f.endsWith('.zip')));
            if (foundZip) {
                return { isDistFolder: false, zipPath: path.join(cDir, foundZip) };
            }
        }
    }

    // Not found in cache — auto-download from official GitHub releases
    const projectCache = path.join(rootDir, '.cache', 'electron');
    fs.mkdirSync(projectCache, { recursive: true });
    const targetZipPath = path.join(projectCache, zipNamePattern);

    console.log(`\n📥 Electron runtime for [${platform}-${arch}] not found in cache.`);
    console.log(` 🌐 Auto-downloading Electron v${electronVersion} from GitHub releases...`);

    const downloadUrl = `https://github.com/electron/electron/releases/download/v${electronVersion}/electron-v${electronVersion}-${platform}-${arch}.zip`;
    try {
        await downloadFile(downloadUrl, targetZipPath);
        return { isDistFolder: false, zipPath: targetZipPath };
    } catch (err) {
        console.warn(` ⚠️ Could not download Electron runtime: ${err.message}`);
        return null;
    }
}

// ==========================================================================
// 1. macOS Standalone Packaging
// ==========================================================================
async function packageMac() {
    console.log('\n=============================================');
    console.log('🍏 Packaging macOS Standalone (bruno.app)');
    console.log('=============================================');

    await ensurePlatformBinaries('darwin');

    const macOutputDir = path.join(releaseDir, 'mac');
    if (fs.existsSync(macOutputDir)) {
        try { fs.rmSync(macOutputDir, { recursive: true, force: true }); } catch (e) {}
    }
    fs.mkdirSync(macOutputDir, { recursive: true });

    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const runtime = await resolveElectronRuntime('darwin', arch);

    if (!runtime) {
        console.warn('❌ Skipping macOS package: Electron runtime could not be resolved.');
        return false;
    }

    const destApp = path.join(macOutputDir, `${appName}.app`);

    if (runtime.isDistFolder) {
        const distItems = fs.readdirSync(runtime.path);
        const appFolder = distItems.find(item => item.endsWith('.app')) || 'Electron.app';
        copyRecursive(path.join(runtime.path, appFolder), destApp);
    } else {
        const tempExtract = path.join(releaseDir, 'temp-mac');
        fs.mkdirSync(tempExtract, { recursive: true });
        extractZip(runtime.zipPath, tempExtract);
        const extractedItems = fs.readdirSync(tempExtract);
        const appFolder = extractedItems.find(item => item.endsWith('.app')) || 'Electron.app';
        copyRecursive(path.join(tempExtract, appFolder), destApp);
        try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch (e) {}
    }

    // Rename main executable in Contents/MacOS
    const macOsDir = path.join(destApp, 'Contents', 'MacOS');
    if (fs.existsSync(macOsDir)) {
        const exeFiles = fs.readdirSync(macOsDir);
        const mainExeName = exeFiles[0] || 'Electron';
        const oldExe = path.join(macOsDir, mainExeName);
        const newExe = path.join(macOsDir, processName);
        if (fs.existsSync(oldExe)) {
            if (oldExe !== newExe) fs.renameSync(oldExe, newExe);
            try { fs.chmodSync(newExe, 0o755); } catch (e) {}
            console.log(` - Configured executable: ${processName}`);
        }
    }

    // Update main Info.plist
    const mainPlist = path.join(destApp, 'Contents', 'Info.plist');
    updateInfoPlist(mainPlist, {
        CFBundleExecutable: processName,
        CFBundleDisplayName: appName,
        CFBundleName: processName,
        CFBundleIdentifier: `com.${processName}.${appName}`,
        CFBundleIconFile: 'icon.icns'
    });

    // Rename and update Helper apps in Contents/Frameworks
    const frameworksDir = path.join(destApp, 'Contents', 'Frameworks');
    if (fs.existsSync(frameworksDir)) {
        const fwItems = fs.readdirSync(frameworksDir);
        fwItems.forEach(item => {
            if (item.endsWith('.app')) {
                const oldHelperPath = path.join(frameworksDir, item);
                const suffixMatch = item.match(/\((.*?)\)/);
                const helperSuffix = suffixMatch ? ` (${suffixMatch[1]})` : '';
                const newHelperName = `${processName} Helper${helperSuffix}`;
                const newHelperApp = `${newHelperName}.app`;
                const newHelperPath = path.join(frameworksDir, newHelperApp);

                const helperMacOsDir = path.join(oldHelperPath, 'Contents', 'MacOS');
                if (fs.existsSync(helperMacOsDir)) {
                    const helperExes = fs.readdirSync(helperMacOsDir);
                    if (helperExes.length > 0) {
                        const oldHelperExe = path.join(helperMacOsDir, helperExes[0]);
                        const newHelperExe = path.join(helperMacOsDir, newHelperName);
                        if (oldHelperExe !== newHelperExe) fs.renameSync(oldHelperExe, newHelperExe);
                        try { fs.chmodSync(newHelperExe, 0o755); } catch (e) {}
                    }
                }

                const helperPlist = path.join(oldHelperPath, 'Contents', 'Info.plist');
                updateInfoPlist(helperPlist, {
                    CFBundleExecutable: newHelperName,
                    CFBundleName: newHelperName,
                    CFBundleDisplayName: newHelperName,
                    CFBundleIdentifier: `com.${processName}.helper.${newHelperName.replace(/[^a-zA-Z0-9]/g, '')}`
                });

                if (oldHelperPath !== newHelperPath) fs.renameSync(oldHelperPath, newHelperPath);
            }
        });
    }

    const resourcesDir = path.join(destApp, 'Contents', 'Resources');
    fs.mkdirSync(resourcesDir, { recursive: true });

    // Copy icons
    const icnsSource = path.join(rootDir, 'assets', 'icon.icns');
    if (fs.existsSync(icnsSource)) {
        fs.copyFileSync(icnsSource, path.join(resourcesDir, 'icon.icns'));
        fs.copyFileSync(icnsSource, path.join(resourcesDir, 'electron.icns'));
    }

    // Populate app files & node_modules & binaries
    populateAppResources(resourcesDir);

    // Apply ad-hoc codesign and clear quarantine if packaging on macOS
    if (isHostMac) {
        try {
            execSync(`xattr -cr "${destApp}"`, { stdio: 'ignore' });
            execSync(`codesign --force --deep --sign - "${destApp}"`, { stdio: 'ignore' });
            console.log(' - macOS ad-hoc signature applied & quarantine cleared.');
        } catch (e) {}
    }

    console.log(`✅ macOS Standalone ready: ${destApp}`);
    return true;
}

// ==========================================================================
// 2. Windows Standalone Packaging
// ==========================================================================
async function packageWindows() {
    console.log('\n=============================================');
    console.log('🪟 Packaging Windows Standalone (bruno.exe)');
    console.log('=============================================');

    await ensurePlatformBinaries('win32');

    const winOutputDir = path.join(releaseDir, 'windows');
    if (fs.existsSync(winOutputDir)) {
        try { fs.rmSync(winOutputDir, { recursive: true, force: true }); } catch (e) {}
    }
    fs.mkdirSync(winOutputDir, { recursive: true });

    const runtime = await resolveElectronRuntime('win32', 'x64');
    if (!runtime) {
        console.warn('❌ Skipping Windows package: Electron runtime could not be resolved.');
        return false;
    }

    if (runtime.isDistFolder) {
        copyRecursive(runtime.path, winOutputDir);
    } else {
        extractZip(runtime.zipPath, winOutputDir);
    }

    // Rename electron.exe to bruno.exe
    const oldWinExe = path.join(winOutputDir, 'electron.exe');
    const newWinExe = path.join(winOutputDir, `${processName}.exe`);
    if (fs.existsSync(oldWinExe)) {
        fs.renameSync(oldWinExe, newWinExe);
        console.log(` - Renamed binary to: ${processName}.exe`);
    }

    const winResources = path.join(winOutputDir, 'resources');
    fs.mkdirSync(winResources, { recursive: true });

    populateAppResources(winResources);

    console.log(`✅ Windows Standalone ready: ${newWinExe}`);

    // Create windows-portable.zip
    const zipPath = path.join(releaseDir, 'windows-portable.zip');
    console.log(' - Creating release/windows-portable.zip...');
    const zipCreated = createZip(winOutputDir, zipPath);
    if (zipCreated) {
        console.log(`✅ windows-portable.zip ready: ${zipPath}`);
    }

    return true;
}

// ==========================================================================
// 3. Linux Standalone Packaging
// ==========================================================================
async function packageLinux() {
    console.log('\n=============================================');
    console.log('🐧 Packaging Linux Standalone (bruno)');
    console.log('=============================================');

    await ensurePlatformBinaries('linux');

    const linuxOutputDir = path.join(releaseDir, 'linux');
    if (fs.existsSync(linuxOutputDir)) {
        try { fs.rmSync(linuxOutputDir, { recursive: true, force: true }); } catch (e) {}
    }
    fs.mkdirSync(linuxOutputDir, { recursive: true });

    const runtime = await resolveElectronRuntime('linux', 'x64');
    if (!runtime) {
        console.warn('❌ Skipping Linux package: Electron runtime could not be resolved.');
        return false;
    }

    if (runtime.isDistFolder) {
        copyRecursive(runtime.path, linuxOutputDir);
    } else {
        extractZip(runtime.zipPath, linuxOutputDir);
    }

    const oldLinuxExe = path.join(linuxOutputDir, 'electron');
    const newLinuxExe = path.join(linuxOutputDir, processName);
    if (fs.existsSync(oldLinuxExe)) {
        fs.renameSync(oldLinuxExe, newLinuxExe);
        try { fs.chmodSync(newLinuxExe, 0o755); } catch (e) {}
        console.log(` - Renamed binary to: ${processName}`);
    }

    const linuxResources = path.join(linuxOutputDir, 'resources');
    fs.mkdirSync(linuxResources, { recursive: true });

    populateAppResources(linuxResources);

    console.log(`✅ Linux Standalone ready: ${path.join(linuxOutputDir, processName)}`);
    return true;
}

// ==========================================================================
// Interactive CLI & Execution Router
// ==========================================================================
async function runCLI() {
    const args = process.argv.slice(2);

    const hasAll = args.includes('--all');
    const hasWin = args.includes('--win') || args.includes('--windows');
    const hasMac = args.includes('--mac') || args.includes('--darwin');
    const hasLinux = args.includes('--linux');
    const hasCurrent = args.includes('--current') || args.includes('--host');

    cleanReleaseDirectory();

    if (hasAll) {
        await packageMac();
        await packageWindows();
        await packageLinux();
        printSummary();
        return;
    }

    if (hasWin || hasMac || hasLinux || hasCurrent) {
        if (hasMac) await packageMac();
        if (hasWin) await packageWindows();
        if (hasLinux) await packageLinux();
        if (hasCurrent) {
            if (isHostMac) await packageMac();
            else if (isHostWin) await packageWindows();
            else if (isHostLinux) await packageLinux();
        }
        printSummary();
        return;
    }

    // Check if running interactively in a TTY terminal
    if (process.stdin.isTTY) {
        const hostName = isHostMac ? 'macOS' : isHostWin ? 'Windows' : 'Linux';
        console.log('============================================================');
        console.log('📦 YT Studio Pro / Bruno — Standalone Multi-OS Packager');
        console.log('============================================================');
        console.log(` Detected Host OS: ${hostName} (${process.arch})\n`);
        console.log(' Please select which standalone packages you want to build:');
        console.log(`   [1] Current Host OS (${hostName}) [Default / Quickest]`);
        console.log('   [2] Windows x64 Standalone (.exe & windows-portable.zip)');
        console.log('   [3] macOS Standalone (bruno.app)');
        console.log('   [4] Linux Standalone (bruno)');
        console.log('   [5] All Platforms (macOS + Windows + Linux)');
        console.log('   [0] Cancel\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(' Enter choice [1-5] (default: 1): ', async (answer) => {
            rl.close();
            const choice = (answer || '1').trim();

            switch (choice) {
                case '1':
                    if (isHostMac) await packageMac();
                    else if (isHostWin) await packageWindows();
                    else await packageLinux();
                    break;
                case '2':
                    await packageWindows();
                    break;
                case '3':
                    await packageMac();
                    break;
                case '4':
                    await packageLinux();
                    break;
                case '5':
                    await packageMac();
                    await packageWindows();
                    await packageLinux();
                    break;
                case '0':
                    console.log('Build cancelled.');
                    return;
                default:
                    console.log(`Unknown choice "${choice}". Building for Current Host OS...`);
                    if (isHostMac) await packageMac();
                    else if (isHostWin) await packageWindows();
                    else await packageLinux();
            }
            printSummary();
        });
    } else {
        // Non-interactive fallback (CI / scripts)
        if (isHostMac) await packageMac();
        else if (isHostWin) await packageWindows();
        else await packageLinux();
        printSummary();
    }
}

function printSummary() {
    console.log('\n============================================================');
    console.log('🎉 Packaging Pipeline Completed!');
    console.log('============================================================');
    console.log(' 📂 Standalone outputs in release/ folder:');
    if (fs.existsSync(path.join(releaseDir, 'mac', `${appName}.app`))) {
        console.log(`  🍏 macOS App: release/mac/${appName}.app`);
    }
    if (fs.existsSync(path.join(releaseDir, 'windows', `${processName}.exe`))) {
        console.log(`  🪟 Windows App: release/windows/${processName}.exe`);
    }
    if (fs.existsSync(path.join(releaseDir, 'windows-portable.zip'))) {
        console.log(`  📦 Windows Portable ZIP: release/windows-portable.zip`);
    }
    if (fs.existsSync(path.join(releaseDir, 'linux', processName))) {
        console.log(`  🐧 Linux App: release/linux/${processName}`);
    }
    console.log('============================================================\n');
}

if (require.main === module) {
    runCLI().catch(err => {
        console.error('❌ Build failed:', err);
        process.exit(1);
    });
}
