// ==========================================================================
// YT Studio Pro / Bruno — Universal Standalone Packager
// ==========================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
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
async function resolveElectronRuntime(platform, arch = 'x64', spinner = null) {
    if (platform === process.platform && fs.existsSync(electronDist)) {
        return { isDistFolder: true, path: electronDist };
    }

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

    const projectCache = path.join(rootDir, '.cache', 'electron');
    fs.mkdirSync(projectCache, { recursive: true });
    const targetZipPath = path.join(projectCache, zipNamePattern);

    if (spinner) {
        spinner.message(`Downloading Electron v${electronVersion} for ${platform}-${arch}...`);
    }

    const downloadUrl = `https://github.com/electron/electron/releases/download/v${electronVersion}/electron-v${electronVersion}-${platform}-${arch}.zip`;
    try {
        await downloadFile(downloadUrl, targetZipPath);
        return { isDistFolder: false, zipPath: targetZipPath };
    } catch (err) {
        return null;
    }
}

// ==========================================================================
// 1. macOS Standalone Packaging
// ==========================================================================
async function packageMac(spinner = null) {
    if (spinner) spinner.message('Setting up macOS binaries...');
    await ensurePlatformBinaries('darwin');

    const macOutputDir = path.join(releaseDir, 'mac');
    if (fs.existsSync(macOutputDir)) {
        try { fs.rmSync(macOutputDir, { recursive: true, force: true }); } catch (e) {}
    }
    fs.mkdirSync(macOutputDir, { recursive: true });

    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    if (spinner) spinner.message(`Resolving macOS Electron runtime (${arch})...`);
    const runtime = await resolveElectronRuntime('darwin', arch, spinner);

    if (!runtime) {
        throw new Error('macOS Electron runtime could not be resolved.');
    }

    if (spinner) spinner.message('Configuring macOS application bundle...');
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

    if (spinner) spinner.message('Bundling app resources & dependencies...');
    populateAppResources(resourcesDir);

    // Apply ad-hoc codesign and clear quarantine if packaging on macOS
    if (isHostMac) {
        try {
            execSync(`xattr -cr "${destApp}"`, { stdio: 'ignore' });
            execSync(`codesign --force --deep --sign - "${destApp}"`, { stdio: 'ignore' });
        } catch (e) {}
    }

    return destApp;
}

// ==========================================================================
// 2. Windows Standalone Packaging
// ==========================================================================
async function packageWindows(spinner = null) {
    if (spinner) spinner.message('Setting up Windows binaries...');
    await ensurePlatformBinaries('win32');

    const winOutputDir = path.join(releaseDir, 'windows');
    if (fs.existsSync(winOutputDir)) {
        try { fs.rmSync(winOutputDir, { recursive: true, force: true }); } catch (e) {}
    }
    fs.mkdirSync(winOutputDir, { recursive: true });

    if (spinner) spinner.message('Resolving Windows Electron runtime (win32-x64)...');
    const runtime = await resolveElectronRuntime('win32', 'x64', spinner);
    if (!runtime) {
        throw new Error('Windows Electron runtime could not be resolved.');
    }

    if (spinner) spinner.message('Extracting Windows runtime & configuring executable...');
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
    }

    const winResources = path.join(winOutputDir, 'resources');
    fs.mkdirSync(winResources, { recursive: true });

    if (spinner) spinner.message('Bundling Windows app resources & dependencies...');
    populateAppResources(winResources);

    // Create windows-portable.zip
    const zipPath = path.join(releaseDir, 'windows-portable.zip');
    if (spinner) spinner.message('Creating release/windows-portable.zip archive...');
    createZip(winOutputDir, zipPath);

    return newWinExe;
}

// ==========================================================================
// 3. Linux Standalone Packaging
// ==========================================================================
async function packageLinux(spinner = null) {
    if (spinner) spinner.message('Setting up Linux binaries...');
    await ensurePlatformBinaries('linux');

    const linuxOutputDir = path.join(releaseDir, 'linux');
    if (fs.existsSync(linuxOutputDir)) {
        try { fs.rmSync(linuxOutputDir, { recursive: true, force: true }); } catch (e) {}
    }
    fs.mkdirSync(linuxOutputDir, { recursive: true });

    if (spinner) spinner.message('Resolving Linux Electron runtime (linux-x64)...');
    const runtime = await resolveElectronRuntime('linux', 'x64', spinner);
    if (!runtime) {
        throw new Error('Linux Electron runtime could not be resolved.');
    }

    if (spinner) spinner.message('Extracting Linux runtime & configuring executable...');
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
    }

    const linuxResources = path.join(linuxOutputDir, 'resources');
    fs.mkdirSync(linuxResources, { recursive: true });

    if (spinner) spinner.message('Bundling Linux app resources & dependencies...');
    populateAppResources(linuxResources);

    return path.join(linuxOutputDir, processName);
}

// ==========================================================================
// Interactive CLI
// ==========================================================================
async function runCLI() {
    const clack = await import('@clack/prompts');
    const args = process.argv.slice(2);

    const hasAll = args.includes('--all');
    const hasWin = args.includes('--win') || args.includes('--windows');
    const hasMac = args.includes('--mac') || args.includes('--darwin');
    const hasLinux = args.includes('--linux');
    const hasCurrent = args.includes('--current') || args.includes('--host');

    cleanReleaseDirectory();

    let selectedPlatforms = [];

    if (hasAll) {
        selectedPlatforms = ['darwin', 'win32', 'linux'];
    } else if (hasWin || hasMac || hasLinux || hasCurrent) {
        if (hasMac) selectedPlatforms.push('darwin');
        if (hasWin) selectedPlatforms.push('win32');
        if (hasLinux) selectedPlatforms.push('linux');
        if (hasCurrent) selectedPlatforms.push(process.platform);
        selectedPlatforms = Array.from(new Set(selectedPlatforms));
    } else if (process.stdin.isTTY) {
        clack.intro('YT Studio Pro / Bruno — Standalone Packager');

        const choice = await clack.multiselect({
            message: 'Select target platform(s) to package:',
            options: [
                {
                    value: 'darwin',
                    label: 'macOS Standalone',
                    hint: isHostMac ? 'Current Host (bruno.app)' : 'bruno.app'
                },
                {
                    value: 'win32',
                    label: 'Windows Standalone',
                    hint: isHostWin ? 'Current Host (bruno.exe & zip)' : 'bruno.exe & windows-portable.zip'
                },
                {
                    value: 'linux',
                    label: 'Linux Standalone',
                    hint: isHostLinux ? 'Current Host (bruno)' : 'bruno'
                }
            ],
            initialValues: [process.platform],
            required: true
        });

        if (clack.isCancel(choice)) {
            clack.cancel('Packaging cancelled.');
            process.exit(0);
        }

        selectedPlatforms = choice;
    } else {
        selectedPlatforms = [process.platform];
    }

    const s = clack.spinner();
    const results = [];

    for (const platform of selectedPlatforms) {
        if (platform === 'darwin') {
            s.start('Building macOS Standalone...');
            try {
                const outPath = await packageMac(s);
                s.stop('macOS Standalone ready: release/mac/bruno.app');
                results.push({ label: 'macOS App', path: 'release/mac/bruno.app' });
            } catch (err) {
                s.stop('Failed to build macOS Standalone: ' + err.message);
            }
        } else if (platform === 'win32') {
            s.start('Building Windows Standalone...');
            try {
                const outPath = await packageWindows(s);
                s.stop('Windows Standalone ready: release/windows/bruno.exe');
                results.push({ label: 'Windows App', path: 'release/windows/bruno.exe' });
                results.push({ label: 'Windows Portable ZIP', path: 'release/windows-portable.zip' });
            } catch (err) {
                s.stop('Failed to build Windows Standalone: ' + err.message);
            }
        } else if (platform === 'linux') {
            s.start('Building Linux Standalone...');
            try {
                const outPath = await packageLinux(s);
                s.stop('Linux Standalone ready: release/linux/bruno');
                results.push({ label: 'Linux App', path: 'release/linux/bruno' });
            } catch (err) {
                s.stop('Failed to build Linux Standalone: ' + err.message);
            }
        }
    }

    if (results.length > 0) {
        const noteSummary = results.map(r => `• ${r.label}: ${r.path}`).join('\n');
        clack.note(noteSummary, 'Release Artifacts');
        clack.outro('Packaging finished successfully.');
    } else {
        clack.outro('No packages were generated.');
    }
}

if (require.main === module) {
    runCLI().catch(err => {
        console.error('[ERROR] Build failed:', err.message);
        process.exit(1);
    });
}
