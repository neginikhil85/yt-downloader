// ==========================================================================
// Standalone Packager for Local Host OS
// ==========================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist');
const platform = process.platform;
const isMac = platform === 'darwin';
const isWin = platform === 'win32';
const isLinux = platform === 'linux';

const processName = process.env.PROCESS_NAME || process.argv[3] || 'bruno';
const appName = process.env.APP_NAME || process.argv[2] || processName;

const outputDir = path.join(rootDir, 'release', isMac ? 'standalone-mac' : (isWin ? 'standalone-win' : 'standalone-linux'));

console.log(`--- Packaging Standalone App for ${platform} ---`);
console.log(`- Outer App Name:   ${appName}`);
console.log(`- Process Name:     ${processName}`);
console.log(`- Output Directory: ${outputDir}\n`);

if (!fs.existsSync(electronDist)) {
    console.error('Error: Electron distribution not found in node_modules/electron/dist. Run npm install first.');
    process.exit(1);
}

if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
}
fs.mkdirSync(outputDir, { recursive: true });

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

let appDir;
let resourcesDir;

if (isMac) {
    console.log('1. Copying and customizing macOS Electron.app template...');
    const distItems = fs.readdirSync(electronDist);
    const appFolder = distItems.find(i => i.endsWith('.app')) || 'Electron.app';
    const srcApp = path.join(electronDist, appFolder);
    const destApp = path.join(outputDir, `${appName}.app`);
    copyRecursive(srcApp, destApp);

    // Rename main executable inside Contents/MacOS to processName
    const macOsDir = path.join(destApp, 'Contents', 'MacOS');
    if (fs.existsSync(macOsDir)) {
        const exeFiles = fs.readdirSync(macOsDir);
        const oldExe = path.join(macOsDir, exeFiles[0] || 'Electron');
        const newExe = path.join(macOsDir, processName);
        if (fs.existsSync(oldExe)) {
            if (oldExe !== newExe) fs.renameSync(oldExe, newExe);
            try { fs.chmodSync(newExe, 0o755); } catch (e) {}
            console.log(` - Renamed main executable to: ${processName}`);
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

                if (oldHelperPath !== newHelperPath) {
                    fs.renameSync(oldHelperPath, newHelperPath);
                }
            }
        });
    }

    resourcesDir = path.join(destApp, 'Contents', 'Resources');
    appDir = path.join(resourcesDir, 'app');

    const icnsSource = path.join(rootDir, 'assets', 'icon.icns');
    if (fs.existsSync(icnsSource)) {
        fs.copyFileSync(icnsSource, path.join(resourcesDir, 'icon.icns'));
        fs.copyFileSync(icnsSource, path.join(resourcesDir, 'electron.icns'));
    }

    const defaultAppAsar = path.join(resourcesDir, 'default_app.asar');
    if (fs.existsSync(defaultAppAsar)) {
        try { fs.rmSync(defaultAppAsar, { force: true }); } catch (e) {}
    }
} else {
    console.log('1. Copying Electron runtime...');
    copyRecursive(electronDist, outputDir);

    if (isWin) {
        const oldExe = path.join(outputDir, 'electron.exe');
        const newExe = path.join(outputDir, `${processName}.exe`);
        if (fs.existsSync(oldExe)) {
            fs.renameSync(oldExe, newExe);
        }
    } else if (isLinux) {
        const oldExe = path.join(outputDir, 'electron');
        const newExe = path.join(outputDir, processName);
        if (fs.existsSync(oldExe)) {
            fs.renameSync(oldExe, newExe);
            try { fs.chmodSync(newExe, 0o755); } catch (e) {}
        }
    }

    resourcesDir = path.join(outputDir, 'resources');
    appDir = path.join(resourcesDir, 'app');

    const defaultAppAsar = path.join(resourcesDir, 'default_app.asar');
    if (fs.existsSync(defaultAppAsar)) {
        try { fs.rmSync(defaultAppAsar, { force: true }); } catch (e) {}
    }
}

console.log('2. Copying Application Source Code & Standalone Binaries...');
fs.mkdirSync(appDir, { recursive: true });

const filesToCopy = ['package.json', 'main.js', 'preload.js', 'src', 'renderer', 'assets'];
filesToCopy.forEach((item) => {
    const srcPath = path.join(rootDir, item);
    if (fs.existsSync(srcPath)) {
        const destPath = path.join(appDir, item);
        copyRecursive(srcPath, destPath);
    }
});

// Copy standalone binaries to resources/bin
const binSrc = path.join(rootDir, 'bin');
if (fs.existsSync(binSrc)) {
    const binDest = path.join(resourcesDir, 'bin');
    copyRecursive(binSrc, binDest);
}

// 3. Ad-hoc codesign on macOS
if (isMac) {
    console.log('3. Applying ad-hoc codesign signature...');
    try {
        const destApp = path.join(outputDir, `${appName}.app`);
        execSync(`xattr -cr "${destApp}"`, { stdio: 'ignore' });
        execSync(`codesign --force --deep --sign - "${destApp}"`, { stdio: 'ignore' });
        console.log(' - Codesign completed successfully.');
    } catch (err) {
        console.warn(' - Codesign warning:', err.message);
    }
}

console.log(`\n🎉 SUCCESS! Standalone package is ready in: ${outputDir}`);
