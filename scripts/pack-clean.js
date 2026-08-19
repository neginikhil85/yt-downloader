// ==========================================================================
// YT Studio Pro / Bruno — Universal Standalone Packager for macOS, Windows & Linux
// ==========================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');
const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist');

const processName = process.env.PROCESS_NAME || 'bruno';
const appName = process.env.APP_NAME || 'bruno';

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';

console.log('=== Cleaning up release directory ===');

// 1. Clean release directory safely
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
            item.includes('openvpn') ||
            item === 'temp-mac' ||
            item === 'temp-win' ||
            item === 'standalone-mac' ||
            item === 'standalone-win' ||
            item === 'standalone-linux'
        ) {
            try {
                fs.rmSync(itemPath, { recursive: true, force: true });
                console.log(` - Removed old artifact: ${item}`);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });
} else {
    fs.mkdirSync(releaseDir, { recursive: true });
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

function bundleProdDependencies(targetAppDir) {
    const targetNodeModules = path.join(targetAppDir, 'node_modules');
    fs.mkdirSync(targetNodeModules, { recursive: true });

    // Copy production dependencies needed at runtime
    const depsToCopy = [
        'qrcode',
        'dijkstrajs',
        'pngjs',
        'yargs',
        'yargs-parser',
        'string-width',
        'strip-ansi',
        'ansi-regex',
        'is-fullwidth-code-point',
        'emoji-regex'
    ];

    depsToCopy.forEach(dep => {
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

    // Remove default_app.asar if present
    const defaultAppAsar = path.join(resourcesDir, 'default_app.asar');
    if (fs.existsSync(defaultAppAsar)) {
        try { fs.rmSync(defaultAppAsar, { force: true }); } catch (e) {}
    }

    // Copy source code
    filesToCopy.forEach((item) => {
        const srcPath = path.join(rootDir, item);
        if (fs.existsSync(srcPath)) {
            copyRecursive(srcPath, path.join(appDir, item));
        }
    });

    // Bundle production dependencies
    bundleProdDependencies(appDir);

    // Copy standalone binaries to resources/bin
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

// ==========================================================================
// 1. macOS Standalone Packaging
// ==========================================================================
function packageMac() {
    console.log('\n=== Packaging macOS Standalone (bruno.app) ===');
    const macOutputDir = path.join(releaseDir, 'mac');

    if (fs.existsSync(macOutputDir)) {
        try { fs.rmSync(macOutputDir, { recursive: true, force: true }); } catch (e) {}
    }
    fs.mkdirSync(macOutputDir, { recursive: true });

    let electronAppTemplate = null;

    if (fs.existsSync(electronDist)) {
        const distItems = fs.readdirSync(electronDist);
        const appFolder = distItems.find(item => item.endsWith('.app'));
        if (appFolder) {
            electronAppTemplate = path.join(electronDist, appFolder);
        }
    }

    // Optional cache fallback if not found in dist
    if (!electronAppTemplate) {
        const cacheLocations = [
            path.join(os.homedir(), 'Library', 'Caches', 'electron'),
            path.join(os.homedir(), '.cache', 'electron')
        ];
        for (const cacheDir of cacheLocations) {
            if (fs.existsSync(cacheDir)) {
                const zips = fs.readdirSync(cacheDir).filter(f => f.includes('darwin') && f.endsWith('.zip'));
                if (zips.length > 0) {
                    const zipPath = path.join(cacheDir, zips[0]);
                    console.log(` - Extracting macOS runtime from cache (${zips[0]})...`);
                    const tempExtract = path.join(releaseDir, 'temp-mac');
                    fs.mkdirSync(tempExtract, { recursive: true });
                    try {
                        execSync(`unzip -q -o "${zipPath}" -d "${tempExtract}"`);
                        const extractedItems = fs.readdirSync(tempExtract);
                        const appNameInZip = extractedItems.find(i => i.endsWith('.app'));
                        if (appNameInZip) {
                            electronAppTemplate = path.join(tempExtract, appNameInZip);
                        }
                    } catch (e) {}
                    break;
                }
            }
        }
    }

    if (!electronAppTemplate || !fs.existsSync(electronAppTemplate)) {
        console.warn(' - Notice: macOS Electron template not found on this host. Skipping macOS package.');
        return false;
    }

    const destApp = path.join(macOutputDir, `${appName}.app`);
    copyRecursive(electronAppTemplate, destApp);

    // Clean up temporary extract
    const tempMacExtract = path.join(releaseDir, 'temp-mac');
    if (fs.existsSync(tempMacExtract)) {
        try { fs.rmSync(tempMacExtract, { recursive: true, force: true }); } catch (e) {}
    }

    // Rename main executable inside Contents/MacOS to processName
    const macOsDir = path.join(destApp, 'Contents', 'MacOS');
    if (fs.existsSync(macOsDir)) {
        const exeFiles = fs.readdirSync(macOsDir);
        const mainExeName = exeFiles[0] || 'Electron';
        const oldExe = path.join(macOsDir, mainExeName);
        const newExe = path.join(macOsDir, processName);
        if (fs.existsSync(oldExe)) {
            if (oldExe !== newExe) {
                fs.renameSync(oldExe, newExe);
            }
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
                        if (oldHelperExe !== newHelperExe) {
                            fs.renameSync(oldHelperExe, newHelperExe);
                        }
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

                if (oldHelperPath !== newHelperPath) {
                    fs.renameSync(oldHelperPath, newHelperPath);
                }
            }
        });
    }

    const resourcesDir = path.join(destApp, 'Contents', 'Resources');
    fs.mkdirSync(resourcesDir, { recursive: true });

    // Copy icon
    const icnsSource = path.join(rootDir, 'assets', 'icon.icns');
    if (fs.existsSync(icnsSource)) {
        fs.copyFileSync(icnsSource, path.join(resourcesDir, 'icon.icns'));
        fs.copyFileSync(icnsSource, path.join(resourcesDir, 'electron.icns'));
    }

    // Populate app files & node_modules
    populateAppResources(resourcesDir);

    // Clear quarantine and apply ad-hoc codesign on macOS
    if (process.platform === 'darwin') {
        try {
            execSync(`xattr -cr "${destApp}"`, { stdio: 'ignore' });
            execSync(`codesign --force --deep --sign - "${destApp}"`, { stdio: 'ignore' });
            console.log(' - macOS xattr stripped & ad-hoc codesign applied.');
        } catch (e) {}
    }

    console.log(`✓ macOS Standalone ready: ${path.join(macOutputDir, `${appName}.app`)}`);
    return true;
}

// ==========================================================================
// 2. Windows Standalone Packaging
// ==========================================================================
function packageWindows() {
    console.log('\n=== Packaging Windows Standalone (bruno.exe) ===');
    const winOutputDir = path.join(releaseDir, 'windows');

    if (fs.existsSync(winOutputDir)) {
        try { fs.rmSync(winOutputDir, { recursive: true, force: true }); } catch (e) {}
    }

    let winRuntimeFound = false;

    // Check if host is Windows and node_modules/electron/dist contains electron.exe
    if (isWin && fs.existsSync(electronDist)) {
        const distFiles = fs.readdirSync(electronDist);
        if (distFiles.some(f => f.toLowerCase().endsWith('.exe'))) {
            fs.mkdirSync(winOutputDir, { recursive: true });
            copyRecursive(electronDist, winOutputDir);
            winRuntimeFound = true;
        }
    }

    // Check cache for windows electron zip
    if (!winRuntimeFound) {
        const cacheLocations = [
            path.join(os.homedir(), 'Library', 'Caches', 'electron'),
            path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'electron', 'Cache'),
            path.join(os.homedir(), '.cache', 'electron')
        ];

        for (const cacheDir of cacheLocations) {
            if (fs.existsSync(cacheDir)) {
                const zips = fs.readdirSync(cacheDir).filter(f => (f.includes('win32') || f.includes('windows')) && f.endsWith('.zip'));
                if (zips.length > 0) {
                    const zipPath = path.join(cacheDir, zips[0]);
                    console.log(` - Extracting Windows runtime from cache (${zips[0]})...`);
                    fs.mkdirSync(winOutputDir, { recursive: true });
                    try {
                        if (process.platform === 'win32') {
                            execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${winOutputDir}' -Force"`, { stdio: 'ignore' });
                        } else {
                            execSync(`unzip -q -o "${zipPath}" -d "${winOutputDir}"`, { stdio: 'ignore' });
                        }
                        winRuntimeFound = true;
                    } catch (e) {}
                    break;
                }
            }
        }
    }

    if (!winRuntimeFound) {
        console.warn(' - Notice: Windows Electron runtime not found on this host. Skipping Windows package.');
        return false;
    }

    // Rename electron.exe to bruno.exe
    const oldWinExe = path.join(winOutputDir, 'electron.exe');
    const newWinExe = path.join(winOutputDir, `${processName}.exe`);
    if (fs.existsSync(oldWinExe)) {
        fs.renameSync(oldWinExe, newWinExe);
        console.log(` - Renamed Windows binary to: ${processName}.exe`);
    }

    const winResources = path.join(winOutputDir, 'resources');
    fs.mkdirSync(winResources, { recursive: true });

    // Populate app files & dependencies
    populateAppResources(winResources);

    console.log(`✓ Windows Standalone ready: ${path.join(winOutputDir, `${processName}.exe`)}`);

    // Create windows-portable.zip if possible
    const zipPath = path.join(releaseDir, 'windows-portable.zip');
    const zipCreated = createZip(winOutputDir, zipPath);
    if (zipCreated) {
        console.log(`✓ windows-portable.zip created: ${zipPath}`);
    }

    return true;
}

// ==========================================================================
// 3. Linux Standalone Packaging
// ==========================================================================
function packageLinux() {
    console.log('\n=== Packaging Linux Standalone (bruno) ===');
    const linuxOutputDir = path.join(releaseDir, 'linux');

    if (fs.existsSync(linuxOutputDir)) {
        try { fs.rmSync(linuxOutputDir, { recursive: true, force: true }); } catch (e) {}
    }

    let linuxRuntimeFound = false;

    if (isLinux && fs.existsSync(electronDist)) {
        fs.mkdirSync(linuxOutputDir, { recursive: true });
        copyRecursive(electronDist, linuxOutputDir);
        linuxRuntimeFound = true;
    }

    if (!linuxRuntimeFound) {
        console.warn(' - Notice: Linux Electron runtime not found on this host. Skipping Linux package.');
        return false;
    }

    const oldLinuxExe = path.join(linuxOutputDir, 'electron');
    const newLinuxExe = path.join(linuxOutputDir, processName);
    if (fs.existsSync(oldLinuxExe)) {
        fs.renameSync(oldLinuxExe, newLinuxExe);
        try { fs.chmodSync(newLinuxExe, 0o755); } catch (e) {}
        console.log(` - Renamed Linux binary to: ${processName}`);
    }

    const linuxResources = path.join(linuxOutputDir, 'resources');
    fs.mkdirSync(linuxResources, { recursive: true });

    populateAppResources(linuxResources);

    console.log(`✓ Linux Standalone ready: ${path.join(linuxOutputDir, processName)}`);
    return true;
}

// ==========================================================================
// Execute Packaging Pipeline
// ==========================================================================
if (isMac) {
    packageMac();
    packageWindows(); // Also try building Windows if cached zip is present
} else if (isWin) {
    packageWindows();
    packageMac();
} else if (isLinux) {
    packageLinux();
    packageWindows();
} else {
    packageMac();
    packageWindows();
    packageLinux();
}

console.log('\n🎉 ALL DONE! Standalone packaging finished.');
console.log(` 📂 Check release/ directory for outputs.\n`);
