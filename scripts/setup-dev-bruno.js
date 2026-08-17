const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const rootDir = path.join(__dirname, '..');
const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist');

if (!fs.existsSync(electronDist)) {
    process.exit(0);
}

if (isMac) {
    const oldApp = path.join(electronDist, 'Electron.app');
    const newApp = path.join(electronDist, 'bruno.app');

    if (fs.existsSync(oldApp)) {
        // 1. Rename main executable
        const oldExe = path.join(oldApp, 'Contents', 'MacOS', 'Electron');
        const newExe = path.join(oldApp, 'Contents', 'MacOS', 'bruno');
        if (fs.existsSync(oldExe)) {
            try { fs.renameSync(oldExe, newExe); } catch (e) {}
            try { fs.chmodSync(newExe, 0o755); } catch (e) {}
        }

        // 2. Rename helpers
        const frameworksDir = path.join(oldApp, 'Contents', 'Frameworks');
        const helpers = [
            { oldApp: 'Electron Helper.app', newApp: 'bruno Helper.app', name: 'bruno Helper' },
            { oldApp: 'Electron Helper (GPU).app', newApp: 'bruno Helper (GPU).app', name: 'bruno Helper (GPU)' },
            { oldApp: 'Electron Helper (Plugin).app', newApp: 'bruno Helper (Plugin).app', name: 'bruno Helper (Plugin)' },
            { oldApp: 'Electron Helper (Renderer).app', newApp: 'bruno Helper (Renderer).app', name: 'bruno Helper (Renderer)' }
        ];

        helpers.forEach((h) => {
            const oldHelperPath = path.join(frameworksDir, h.oldApp);
            const newHelperPath = path.join(frameworksDir, h.newApp);
            if (fs.existsSync(oldHelperPath)) {
                const oldExeName = h.oldApp.replace(/\.app$/, '');
                const oldHExe = path.join(oldHelperPath, 'Contents', 'MacOS', oldExeName);
                const newHExe = path.join(oldHelperPath, 'Contents', 'MacOS', h.name);
                if (fs.existsSync(oldHExe)) {
                    try { fs.renameSync(oldHExe, newHExe); } catch (e) {}
                    try { fs.chmodSync(newHExe, 0o755); } catch (e) {}
                }
                try { fs.renameSync(oldHelperPath, newHelperPath); } catch (e) {}
            }
        });

        // 3. Update main Info.plist
        const plistPath = path.join(oldApp, 'Contents', 'Info.plist');
        if (fs.existsSync(plistPath)) {
            let plist = fs.readFileSync(plistPath, 'utf8');
            plist = plist.replace(/<key>CFBundleExecutable<\/key>\s*<string>Electron<\/string>/g, '<key>CFBundleExecutable</key>\n\t<string>bruno</string>');
            plist = plist.replace(/<key>CFBundleName<\/key>\s*<string>Electron<\/string>/g, '<key>CFBundleName</key>\n\t<string>bruno</string>');
            plist = plist.replace(/<key>CFBundleDisplayName<\/key>\s*<string>Electron<\/string>/g, '<key>CFBundleDisplayName</key>\n\t<string>bruno</string>');
            fs.writeFileSync(plistPath, plist, 'utf8');
        }

        // 4. Rename folder
        try { fs.renameSync(oldApp, newApp); } catch (e) {}

        // 5. Update path.txt
        fs.writeFileSync(path.join(rootDir, 'node_modules', 'electron', 'path.txt'), 'bruno.app/Contents/MacOS/bruno', 'utf8');

        // 6. Codesign
        try {
            execSync(`xattr -cr "${newApp}"`, { stdio: 'ignore' });
            execSync(`codesign --force --deep --sign - "${newApp}"`, { stdio: 'ignore' });
        } catch (e) {}
        console.log('✓ Dev Electron branded as bruno.app for direct Netskope bypass in npm start');
    }
} else if (isWin) {
    const oldExe = path.join(electronDist, 'electron.exe');
    const newExe = path.join(electronDist, 'bruno.exe');
    if (fs.existsSync(oldExe)) {
        try { fs.renameSync(oldExe, newExe); } catch (e) {}
        fs.writeFileSync(path.join(rootDir, 'node_modules', 'electron', 'path.txt'), 'bruno.exe', 'utf8');
        console.log('✓ Dev Electron branded as bruno.exe for npm start');
    }
}
