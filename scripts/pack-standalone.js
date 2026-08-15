const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist');
const platform = process.platform;
const isMac = platform === 'darwin';
const isWin = platform === 'win32';
const isLinux = platform === 'linux';

// Process/executable name and outer app name use the same bypassed name
const processName = process.env.PROCESS_NAME || process.argv[3] || 'bruno';

// Outer app name (CLI arg or APP_NAME env, default matches processName)
const appName = process.env.APP_NAME || process.argv[2] || processName;

const outputDir = path.join(rootDir, 'release', isMac ? 'standalone-mac' : (isWin ? 'standalone-win' : 'standalone-linux'));

console.log(`--- Packaging Standalone App for ${platform} ---`);
console.log(`- Outer App Name:   ${appName}`);
console.log(`- Process Name:     ${processName}`);
console.log(`- Output Directory: ${outputDir}\n`);

if (!fs.existsSync(electronDist)) {
    console.error('Error: Electron distribution not found. Run npm install first.');
    process.exit(1);
}

if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
}
fs.mkdirSync(outputDir, { recursive: true });

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

let appDir;
let resourcesDir;

if (isMac) {
    console.log('1. Copying and customizing macOS Electron.app template...');
    const srcApp = path.join(electronDist, 'Electron.app');
    const destApp = path.join(outputDir, `${appName}.app`);
    copyRecursive(srcApp, destApp);

    // 1a. Rename main executable inside Contents/MacOS to processName (svpn)
    const macOsDir = path.join(destApp, 'Contents', 'MacOS');
    const oldExe = path.join(macOsDir, 'Electron');
    const newExe = path.join(macOsDir, processName);
    if (fs.existsSync(oldExe)) {
        fs.renameSync(oldExe, newExe);
        fs.chmodSync(newExe, 0o755);
        console.log(` - Renamed main executable to: ${processName}`);
    }

    // 1b. Update main Info.plist
    const mainPlist = path.join(destApp, 'Contents', 'Info.plist');
    updateInfoPlist(mainPlist, {
        CFBundleExecutable: processName,
        CFBundleDisplayName: appName,
        CFBundleName: processName,
        CFBundleIdentifier: `com.${processName}.${appName}`,
        CFBundleIconFile: 'icon.icns'
    });
    console.log(` - Updated main Info.plist (Executable: ${processName}, CFBundleName: ${processName}, Display: ${appName})`);

    // 1c. Rename and update Helper apps in Contents/Frameworks
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
                // Rename inner executable
                const oldHelperExeName = h.oldApp.replace(/\.app$/, '');
                const oldHelperExe = path.join(oldHelperPath, 'Contents', 'MacOS', oldHelperExeName);
                const newHelperExe = path.join(oldHelperPath, 'Contents', 'MacOS', h.name);
                if (fs.existsSync(oldHelperExe)) {
                    fs.renameSync(oldHelperExe, newHelperExe);
                    fs.chmodSync(newHelperExe, 0o755);
                }

                // Update helper Info.plist
                const helperPlist = path.join(oldHelperPath, 'Contents', 'Info.plist');
                updateInfoPlist(helperPlist, {
                    CFBundleExecutable: h.name,
                    CFBundleName: h.name,
                    CFBundleDisplayName: h.name,
                    CFBundleIdentifier: `com.${processName}.helper.${h.name.replace(/[^a-zA-Z0-9]/g, '')}`
                });

                // Rename helper app folder
                fs.renameSync(oldHelperPath, newHelperPath);
                console.log(` - Customized helper: ${h.newApp}`);
            }
        });
    }

    resourcesDir = path.join(destApp, 'Contents', 'Resources');
    appDir = path.join(resourcesDir, 'app');

    // 1d. Copy custom icon.icns into Resources
    const icnsSource = path.join(rootDir, 'assets', 'icon.icns');
    if (fs.existsSync(icnsSource)) {
        fs.copyFileSync(icnsSource, path.join(resourcesDir, 'icon.icns'));
        fs.copyFileSync(icnsSource, path.join(resourcesDir, 'electron.icns'));
        console.log(' - Bundled custom icon.icns');
    }

    // 1e. Remove default_app.asar template
    const defaultAppAsar = path.join(resourcesDir, 'default_app.asar');
    if (fs.existsSync(defaultAppAsar)) {
        fs.rmSync(defaultAppAsar, { force: true });
    }
} else {
    console.log('1. Copying Electron runtime...');
    fs.readdirSync(electronDist).forEach((file) => {
        const srcFile = path.join(electronDist, file);
        let destName = file;
        if (isWin && file === 'electron.exe') destName = `${processName}.exe`;
        if (isLinux && file === 'electron') destName = processName;
        const destFile = path.join(outputDir, destName);
        copyRecursive(srcFile, destFile);
    });
    resourcesDir = path.join(outputDir, 'resources');
    appDir = path.join(resourcesDir, 'app');
}

console.log('2. Copying Application Source Code & Standalone Binaries...');
fs.mkdirSync(appDir, { recursive: true });

const filesToCopy = ['package.json', 'main.js', 'preload.js', 'src', 'renderer', 'assets'];
filesToCopy.forEach((item) => {
    const srcPath = path.join(rootDir, item);
    if (fs.existsSync(srcPath)) {
        const destPath = path.join(appDir, item);
        console.log(` - Copying ${item}...`);
        copyRecursive(srcPath, destPath);
    }
});

// Copy standalone binaries to resources/bin
const binSrc = path.join(rootDir, 'bin');
if (fs.existsSync(binSrc)) {
    const binDest = path.join(resourcesDir, 'bin');
    console.log(' - Copying standalone binaries to resources/bin...');
    copyRecursive(binSrc, binDest);
}

// 3. Ad-hoc codesign on macOS so modified bundle executes without restrictions
if (isMac) {
    console.log('3. Applying ad-hoc codesign signature...');
    try {
        const destApp = path.join(outputDir, `${appName}.app`);
        execSync(`xattr -cr "${destApp}"`, { stdio: 'ignore' });
        execSync(`codesign --force --deep --sign - "${destApp}"`, { stdio: 'inherit' });
        console.log(' - Codesign completed successfully.');
    } catch (err) {
        console.warn(' - Codesign warning:', err.message);
    }
}

console.log(`\n🎉 SUCCESS! Standalone package is ready in: ${outputDir}`);
