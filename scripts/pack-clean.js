// ==========================================================================
// YT Studio Pro — Clean Standalone Packager for macOS & Windows
// ==========================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');
const electronDistMac = path.join(rootDir, 'node_modules', 'electron', 'dist');

const processName = 'bruno';
const appName = 'bruno';

const macOutputDir = path.join(releaseDir, 'mac');
const winOutputDir = path.join(releaseDir, 'windows');

console.log('=== Cleaning up release directory ===');

// 1. Remove all old/temporary artifacts from release
if (fs.existsSync(releaseDir)) {
    const items = fs.readdirSync(releaseDir);
    items.forEach(item => {
        const itemPath = path.join(releaseDir, item);
        // Remove old openvpn, dmg, zip, blockmap, yml, and temporary folders
        if (
            item.endsWith('.zip') ||
            item.endsWith('.dmg') ||
            item.endsWith('.blockmap') ||
            item.endsWith('.yml') ||
            item.startsWith('.icon') ||
            item.includes('openvpn') ||
            item === 'mac-arm64' ||
            item === 'standalone-linux'
        ) {
            console.log(` - Removing old artifact: ${item}`);
            fs.rmSync(itemPath, { recursive: true, force: true });
        }
    });
}

function copyRecursive(src, dest) {
    if (process.platform === 'darwin' || process.platform === 'linux') {
        execSync(`cp -R "${src}" "${dest}"`);
    } else {
        fs.cpSync(src, dest, { recursive: true });
    }
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

// ==========================================================================
// 2. Package macOS Standalone (bruno.app)
// ==========================================================================
console.log('\n=== 1. Packaging macOS Standalone (bruno.app) ===');
const macZip = path.join(os.homedir(), 'Library', 'Caches', 'electron', 'electron-v34.5.8-darwin-arm64.zip');

if (fs.existsSync(macOutputDir)) {
    try { execSync(`rm -rf "${macOutputDir}"`); } catch {}
}
fs.mkdirSync(macOutputDir, { recursive: true });

let electronAppTemplate = path.join(electronDistMac, 'Electron.app');
if (!fs.existsSync(electronAppTemplate) && fs.existsSync(macZip)) {
    console.log(' - Extracting macOS Electron runtime from cache...');
    const tempMacExtract = path.join(releaseDir, 'temp-mac');
    fs.mkdirSync(tempMacExtract, { recursive: true });
    execSync(`unzip -q -o "${macZip}" -d "${tempMacExtract}"`);
    electronAppTemplate = path.join(tempMacExtract, 'Electron.app');
}

if (fs.existsSync(electronAppTemplate)) {
    const destApp = path.join(macOutputDir, `${appName}.app`);
    copyRecursive(electronAppTemplate, destApp);

    // Clean up temporary extract
    const tempMacExtract = path.join(releaseDir, 'temp-mac');
    if (fs.existsSync(tempMacExtract)) {
        try { execSync(`rm -rf "${tempMacExtract}"`); } catch {}
    }

    // Rename main executable inside Contents/MacOS to processName
    const macOsDir = path.join(destApp, 'Contents', 'MacOS');
    const oldExe = path.join(macOsDir, 'Electron');
    const newExe = path.join(macOsDir, processName);
    if (fs.existsSync(oldExe)) {
        fs.renameSync(oldExe, newExe);
        fs.chmodSync(newExe, 0o755);
        console.log(` - Renamed main executable to: ${processName}`);
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
        const helpers = [
            { oldApp: 'Electron Helper.app', newApp: `${processName} Helper.app`, name: `${processName} Helper` },
            { oldApp: 'Electron Helper (GPU).app', newApp: `${processName} Helper (GPU).app`, name: `${processName} Helper (GPU)` },
            { oldApp: 'Electron Helper (Plugin).app', newApp: `${processName} Helper (Plugin).app`, name: `${processName} Helper (Plugin)` },
            { oldApp: 'Electron Helper (Renderer).app', newApp: `${processName} Helper (Renderer).app`, name: `${processName} Helper (Renderer)` }
        ];

        helpers.forEach(h => {
            const oldHelperPath = path.join(frameworksDir, h.oldApp);
            const newHelperPath = path.join(frameworksDir, h.newApp);
            if (fs.existsSync(oldHelperPath)) {
                const oldHelperExeName = h.oldApp.replace(/\.app$/, '');
                const oldHelperExe = path.join(oldHelperPath, 'Contents', 'MacOS', oldHelperExeName);
                const newHelperExe = path.join(oldHelperPath, 'Contents', 'MacOS', h.name);
                if (fs.existsSync(oldHelperExe)) {
                    fs.renameSync(oldHelperExe, newHelperExe);
                    fs.chmodSync(newHelperExe, 0o755);
                }

                const helperPlist = path.join(oldHelperPath, 'Contents', 'Info.plist');
                updateInfoPlist(helperPlist, {
                    CFBundleExecutable: h.name,
                    CFBundleName: h.name,
                    CFBundleDisplayName: h.name,
                    CFBundleIdentifier: `com.${processName}.helper.${h.name.replace(/[^a-zA-Z0-9]/g, '')}`
                });

                fs.renameSync(oldHelperPath, newHelperPath);
            }
        });
    }

    const resourcesDir = path.join(destApp, 'Contents', 'Resources');
    const appDir = path.join(resourcesDir, 'app');
    fs.mkdirSync(appDir, { recursive: true });

    // Copy icon
    const icnsSource = path.join(rootDir, 'assets', 'icon.icns');
    if (fs.existsSync(icnsSource)) {
        fs.copyFileSync(icnsSource, path.join(resourcesDir, 'icon.icns'));
        fs.copyFileSync(icnsSource, path.join(resourcesDir, 'electron.icns'));
    }

    // Remove default_app.asar
    const defaultAppAsar = path.join(resourcesDir, 'default_app.asar');
    if (fs.existsSync(defaultAppAsar)) {
        fs.rmSync(defaultAppAsar, { force: true });
    }

    // Copy source code
    filesToCopy.forEach((item) => {
        const srcPath = path.join(rootDir, item);
        if (fs.existsSync(srcPath)) {
            copyRecursive(srcPath, path.join(appDir, item));
        }
    });

    // Copy binaries
    if (fs.existsSync(binSrc)) {
        copyRecursive(binSrc, path.join(resourcesDir, 'bin'));
    }

    // Clear quarantine and apply ad-hoc codesign
    try {
        execSync(`xattr -cr "${destApp}"`, { stdio: 'ignore' });
        execSync(`codesign --force --deep --sign - "${destApp}"`, { stdio: 'ignore' });
        console.log(' - macOS xattr stripped & codesign applied successfully.');
    } catch {}

    console.log(`✓ macOS Standalone ready: ${path.join(macOutputDir, 'bruno.app')}`);
}

// ==========================================================================
// 3. Package Universal Windows x64 Standalone (bruno.exe)
// ==========================================================================
console.log('\n=== 2. Packaging Windows x64 Standalone (bruno.exe) ===');
const winZip = path.join(os.homedir(), 'Library', 'Caches', 'electron', 'electron-v34.5.8-win32-x64.zip');

if (fs.existsSync(winOutputDir)) {
    try { execSync(`rm -rf "${winOutputDir}"`); } catch {}
}
fs.mkdirSync(winOutputDir, { recursive: true });

if (fs.existsSync(winZip)) {
    console.log(' - Extracting native Windows x64 Electron runtime...');
    execSync(`unzip -q -o "${winZip}" -d "${winOutputDir}"`);

    // Rename electron.exe to bruno.exe
    const oldWinExe = path.join(winOutputDir, 'electron.exe');
    const newWinExe = path.join(winOutputDir, 'bruno.exe');
    if (fs.existsSync(oldWinExe)) {
        fs.renameSync(oldWinExe, newWinExe);
        console.log(' - Renamed Windows binary to: bruno.exe');
    }

    // Prepare resources/app
    const winResources = path.join(winOutputDir, 'resources');
    const winAppDir = path.join(winResources, 'app');
    fs.mkdirSync(winAppDir, { recursive: true });

    // Remove default_app.asar
    const defaultAppAsar = path.join(winResources, 'default_app.asar');
    if (fs.existsSync(defaultAppAsar)) {
        fs.rmSync(defaultAppAsar, { force: true });
    }

    // Copy source code
    filesToCopy.forEach((item) => {
        const srcPath = path.join(rootDir, item);
        if (fs.existsSync(srcPath)) {
            copyRecursive(srcPath, path.join(winAppDir, item));
        }
    });

    // Copy standalone binaries to resources/bin
    if (fs.existsSync(binSrc)) {
        copyRecursive(binSrc, path.join(winResources, 'bin'));
    }

    console.log(`✓ Windows x64 Standalone ready: ${path.join(winOutputDir, 'bruno.exe')}`);

    // Create windows-portable.zip
    console.log('\n=== 3. Compressing Windows Portable Zip ===');
    const zipPath = path.join(releaseDir, 'windows-portable.zip');
    if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
    execSync(`cd "${releaseDir}" && zip -r -q "windows-portable.zip" windows/`);
    console.log(`✓ windows-portable.zip ready: ${zipPath}`);
} else {
    console.warn(' - Warning: Windows x64 electron zip not found.');
}

// Also remove standalone-mac if it was an old directory name, keep clean release/mac and release/windows
const oldStandaloneMac = path.join(releaseDir, 'standalone-mac');
if (fs.existsSync(oldStandaloneMac)) {
    try {
        execSync(`rm -rf "${oldStandaloneMac}"`);
    } catch {}
}

console.log('\n🎉 ALL CLEAN! Release folder now contains:');
console.log(` 📂 release/mac/                  -> bruno.app (macOS Standalone)`);
console.log(` 📂 release/windows/              -> bruno.exe + runtime (Windows Standalone)`);
console.log(` 📦 release/windows-portable.zip  -> Full Windows package ready to send & extract\n`);
