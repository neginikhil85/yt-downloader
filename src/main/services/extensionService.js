const { app, session, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

let extensionsDir = null;
let metadataFile = null;
let installedExtensions = [];
let isInitialized = false;

// 1. Curated Addons Catalog Metadata
const CURATED_ADDONS = [
    {
        id: 'cjpalhdlnbpafiamejdnhcphjbkeiagm',
        name: 'uBlock Origin',
        category: 'Privacy & Security',
        description: 'An efficient ad, tracker, and malware blocker. Fast, lightweight, and highly customizable.',
        badge: 'Top Rated',
        rating: '4.9 ★ (10M+)',
        author: 'Raymond Hill'
    },
    {
        id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh',
        name: 'Dark Reader',
        category: 'Visual & Themes',
        description: 'Invert brightness and contrast on every website with high-performance real-time dark mode.',
        badge: 'Essential',
        rating: '4.8 ★ (5M+)',
        author: 'Alexander Shutov'
    },
    {
        id: 'mnjggcdmjocbbbhaepdhchncahnbgone',
        name: 'SponsorBlock for YouTube',
        category: 'Media & Streaming',
        description: 'Automatically skip YouTube video sponsorships, intros, outros, and subscribe reminders.',
        badge: 'Popular',
        rating: '4.9 ★ (2M+)',
        author: 'Ajay Ramachandran'
    },
    {
        id: 'gebbhagfogifgggkldgodflihgfeippi',
        name: 'Return YouTube Dislike',
        category: 'Media & Streaming',
        description: 'Brings back the dislike count and ratio bar on all YouTube videos across the web.',
        badge: 'Must Have',
        rating: '4.9 ★ (4M+)',
        author: 'Return YouTube Dislike'
    },
    {
        id: 'ponfpcnoihfmfllpaingbgckeigkhjaa',
        name: 'Enhancer for YouTube',
        category: 'Media & Streaming',
        description: 'Control speed, volume boost, cinematic dark mode, and auto-HD resolution on YouTube.',
        badge: 'High Power',
        rating: '4.8 ★ (1M+)',
        author: 'Maxime RF'
    },
    {
        id: 'nngceckbapebfimnlniiiahkandclblb',
        name: 'Bitwarden Password Manager',
        category: 'Privacy & Security',
        description: 'Secure, open-source password manager to store logins, autofill credentials, and generate strong passwords.',
        badge: 'Security',
        rating: '4.9 ★ (3M+)',
        author: 'Bitwarden Inc.'
    },
    {
        id: 'pkehgijcmpdhfbdbbnkijodmdjhbjlgp',
        name: 'Privacy Badger',
        category: 'Privacy & Security',
        description: 'Automatically learns to block invisible third-party trackers spying on your web activities.',
        badge: 'EFF Verified',
        rating: '4.7 ★ (1.5M+)',
        author: 'EFF'
    },
    {
        id: 'lckanjdmomiammgiddabbcmddmnhokac',
        name: 'ClearURLs',
        category: 'Privacy & Security',
        description: 'Removes tracking elements and UTM parameters from URLs to protect online privacy.',
        badge: 'Privacy',
        rating: '4.8 ★ (500K+)',
        author: 'Kevin Roebert'
    },
    {
        id: 'hlkenndednhfkekhgcdicdfddnkalmdm',
        name: 'Cookie-Editor',
        category: 'Developer Tools',
        description: 'Create, edit, search, and export cookies for the current tab with zero friction.',
        badge: 'Dev Tool',
        rating: '4.8 ★ (800K+)',
        author: 'Moustachware'
    },
    {
        id: 'jinjaccalgkegednnccohejagnlnfdag',
        name: 'Violentmonkey',
        category: 'Developer Tools',
        description: 'Lightweight and open-source userscript manager supporting Greasemonkey & Tampermonkey scripts.',
        badge: 'Power Tool',
        rating: '4.8 ★ (600K+)',
        author: 'Violentmonkey Team'
    },
    {
        id: 'bcjindcccaagfpapjjmafapmmgkkhgoa',
        name: 'JSON Formatter',
        category: 'Developer Tools',
        description: 'Makes JSON documents readable with collapsible trees, syntax highlighting, and fast inspection.',
        badge: 'Dev Tool',
        rating: '4.8 ★ (1.2M+)',
        author: 'Callum Locke'
    },
    {
        id: 'jghecgabfgfdldnmbfkhmffcabddioke',
        name: 'Volume Master',
        category: 'Utilities',
        description: 'Boost audio up to 600% on any web tab with individual tab volume control slider.',
        badge: 'Audio Boost',
        rating: '4.7 ★ (4M+)',
        author: 'Peta Sittek'
    },
    {
        id: 'mpbjkejbpaphibgflfpfeelhnkhnabel',
        name: 'Buster: Captcha Solver',
        category: 'Utilities',
        description: 'Solves difficult audio captchas automatically using speech recognition with 1-click.',
        badge: 'AI Tool',
        rating: '4.6 ★ (700K+)',
        author: 'Armin Sebastian'
    },
    {
        id: 'aapbdbdomjkkjkaonfhkkikfgjllcleb',
        name: 'Google Translate',
        category: 'Utilities',
        description: 'View translations easily as you browse the web. Highlight or right-click text to translate.',
        badge: 'Official',
        rating: '4.4 ★ (10M+)',
        author: 'Google'
    },
    {
        id: 'djflhoibgkdhkhhcedjflbmhjenkljhe',
        name: 'User-Agent Switcher',
        category: 'Utilities',
        description: 'Quickly switch browser user-agent string to spoof mobile, tablet, or desktop devices.',
        badge: 'Utility',
        rating: '4.5 ★ (2M+)',
        author: 'Ray'
    }
];

function ensurePaths() {
    if (!extensionsDir) {
        try {
            const userData = app.isReady() ? app.getPath('userData') : path.join(require('os').homedir(), '.yt_downloader');
            extensionsDir = path.join(userData, 'extensions');
            if (!fs.existsSync(extensionsDir)) {
                fs.mkdirSync(extensionsDir, { recursive: true });
            }
            metadataFile = path.join(extensionsDir, 'extensions.json');
        } catch (e) {
            console.error('[ExtensionService] Path init error:', e);
        }
    }
}

function loadMetadata() {
    ensurePaths();
    if (metadataFile && fs.existsSync(metadataFile)) {
        try {
            const raw = fs.readFileSync(metadataFile, 'utf8');
            installedExtensions = JSON.parse(raw);
        } catch (e) {
            console.warn('[ExtensionService] Metadata read error, starting fresh:', e.message);
            installedExtensions = [];
        }
    } else {
        installedExtensions = [];
    }
    return installedExtensions;
}

function saveMetadata() {
    ensurePaths();
    if (metadataFile) {
        try {
            fs.writeFileSync(metadataFile, JSON.stringify(installedExtensions, null, 2), 'utf8');
        } catch (e) {
            console.error('[ExtensionService] Failed to save metadata:', e);
        }
    }
}

function extractZipBuffer(zipBuf, targetDir) {
    fs.mkdirSync(targetDir, { recursive: true });
    const tempZip = path.join(targetDir, 'temp_archive.zip');
    fs.writeFileSync(tempZip, zipBuf);

    if (process.platform === 'win32') {
        execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${targetDir}' -Force"`, { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
        try {
            execSync(`/usr/bin/ditto -x -k "${tempZip}" "${targetDir}"`, { stdio: 'ignore' });
        } catch (e) {
            execSync(`unzip -q -o "${tempZip}" -d "${targetDir}"`, { stdio: 'ignore' });
        }
    } else {
        execSync(`unzip -q -o "${tempZip}" -d "${targetDir}"`, { stdio: 'ignore' });
    }

    try { fs.unlinkSync(tempZip); } catch (e) {}
}

function downloadCrx(url, maxRedirects = 8) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects while downloading extension'));
        
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redir = res.headers.location;
                if (!redir.startsWith('http')) {
                    const parsed = new URL(url);
                    redir = new URL(redir, parsed.origin).href;
                }
                res.resume();
                return downloadCrx(redir, maxRedirects - 1).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Server returned HTTP ${res.statusCode}`));
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Extension download timed out'));
        });
    });
}

function parseExtensionId(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    // Match plain 32-character extension ID
    if (/^[a-z]{32}$/i.test(trimmed)) return trimmed.toLowerCase();
    
    // Match Chrome Web Store URL
    const urlMatch = trimmed.match(/\/detail\/(?:[^\/]+\/)?([a-z]{32})/i);
    if (urlMatch) return urlMatch[1].toLowerCase();

    // Match short parameter ?id=...
    const paramMatch = trimmed.match(/[?&]id=([a-z]{32})/i);
    if (paramMatch) return paramMatch[1].toLowerCase();

    return null;
}

function readExtensionManifest(extDir) {
    const manifestPath = path.join(extDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    try {
        const raw = fs.readFileSync(manifestPath, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

/**
 * Initializes the extension service and loads all enabled extensions into the Research Browser session
 */
async function initExtensionService() {
    if (isInitialized) return;
    isInitialized = true;

    ensurePaths();
    loadMetadata();

    const targetSession = session.fromPartition('persist:main');

    for (const item of installedExtensions) {
        if (item.enabled && item.path && fs.existsSync(item.path)) {
            try {
                await targetSession.loadExtension(item.path, { allowFileAccess: true });
                console.log(`[ExtensionService] Loaded extension: ${item.name} (${item.id})`);
            } catch (err) {
                console.warn(`[ExtensionService] Failed to load extension ${item.name}:`, err.message);
            }
        }
    }
}

function getInstalledExtensions() {
    loadMetadata();
    return installedExtensions;
}

function getCuratedAddons() {
    loadMetadata();
    return CURATED_ADDONS.map(curated => {
        const installed = installedExtensions.find(ext => ext.id === curated.id);
        return {
            ...curated,
            isInstalled: !!installed,
            isEnabled: installed ? installed.enabled : false,
            version: installed ? installed.version : null,
            installedPath: installed ? installed.path : null
        };
    });
}

/**
 * Downloads and installs an extension from Chrome Web Store
 */
async function installExtensionFromWebStore(idOrUrl) {
    ensurePaths();
    const extId = parseExtensionId(idOrUrl);
    if (!extId) {
        throw new Error('Invalid Chrome Web Store URL or Extension ID. Expected 32-character ID.');
    }

    const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=133.0.0.0&acceptformat=crx2,crx3&x=id%3D${extId}%26uc`;
    console.log(`[ExtensionService] Downloading CRX for [${extId}]...`);

    const crxBuffer = await downloadCrx(crxUrl);
    if (!crxBuffer || crxBuffer.length < 50) {
        throw new Error('Downloaded extension buffer was empty or invalid.');
    }

    // Find PKZip start offset
    const zipOffset = crxBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (zipOffset === -1) {
        throw new Error('CRX archive did not contain valid ZIP data.');
    }

    const zipBuffer = crxBuffer.slice(zipOffset);
    const targetDir = path.join(extensionsDir, extId);

    if (fs.existsSync(targetDir)) {
        try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch (e) {}
    }

    extractZipBuffer(zipBuffer, targetDir);

    const manifest = readExtensionManifest(targetDir);
    if (!manifest) {
        try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch (e) {}
        throw new Error('Extension unpacked successfully, but manifest.json was missing or invalid.');
    }

    // Load into Electron Session
    const targetSession = session.fromPartition('persist:main');
    try {
        await targetSession.loadExtension(targetDir, { allowFileAccess: true });
    } catch (loadErr) {
        console.warn('[ExtensionService] Session load notice:', loadErr.message);
    }

    const curatedMeta = CURATED_ADDONS.find(c => c.id === extId);
    const name = curatedMeta ? curatedMeta.name : (manifest.name || extId);
    const description = curatedMeta ? curatedMeta.description : (manifest.description || 'Custom extension');
    const version = manifest.version || '1.0.0';

    const extRecord = {
        id: extId,
        name,
        description,
        version,
        path: targetDir,
        enabled: true,
        isUnpacked: false,
        category: curatedMeta ? curatedMeta.category : 'Custom Addon',
        installedAt: new Date().toISOString()
    };

    installedExtensions = installedExtensions.filter(e => e.id !== extId);
    installedExtensions.unshift(extRecord);
    saveMetadata();

    console.log(`[ExtensionService] Successfully installed & activated: ${name} (v${version})`);
    return { success: true, extension: extRecord };
}

/**
 * Loads an unpacked extension from local disk directory
 */
async function installUnpackedExtension(targetFolderPath) {
    ensurePaths();
    if (!targetFolderPath || !fs.existsSync(targetFolderPath)) {
        throw new Error('Selected directory does not exist.');
    }

    const manifest = readExtensionManifest(targetFolderPath);
    if (!manifest) {
        throw new Error('The selected folder does not contain a valid manifest.json file.');
    }

    const targetSession = session.fromPartition('persist:main');
    let loadedExt = null;
    try {
        loadedExt = await targetSession.loadExtension(targetFolderPath, { allowFileAccess: true });
    } catch (loadErr) {
        throw new Error(`Failed to load unpacked extension: ${loadErr.message}`);
    }

    const extId = loadedExt?.id || `unpacked_${Date.now()}`;
    const name = manifest.name || path.basename(targetFolderPath);
    const description = manifest.description || 'Locally loaded unpacked extension';
    const version = manifest.version || '1.0.0';

    const extRecord = {
        id: extId,
        name,
        description,
        version,
        path: targetFolderPath,
        enabled: true,
        isUnpacked: true,
        category: 'Unpacked / Local',
        installedAt: new Date().toISOString()
    };

    installedExtensions = installedExtensions.filter(e => e.id !== extId);
    installedExtensions.unshift(extRecord);
    saveMetadata();

    return { success: true, extension: extRecord };
}

/**
 * Enables or disables an installed extension
 */
async function toggleExtension(extId, enabled) {
    loadMetadata();
    const item = installedExtensions.find(e => e.id === extId);
    if (!item) throw new Error('Extension not found.');

    const targetSession = session.fromPartition('persist:main');

    if (enabled) {
        if (item.path && fs.existsSync(item.path)) {
            try {
                await targetSession.loadExtension(item.path, { allowFileAccess: true });
            } catch (err) {
                console.warn('[ExtensionService] Enable error:', err.message);
            }
        }
        item.enabled = true;
    } else {
        try {
            targetSession.removeExtension(extId);
        } catch (err) {
            console.warn('[ExtensionService] Remove error:', err.message);
        }
        item.enabled = false;
    }

    saveMetadata();
    return { success: true, extension: item };
}

/**
 * Removes and deletes an installed extension
 */
function removeExtension(extId) {
    loadMetadata();
    const item = installedExtensions.find(e => e.id === extId);
    if (!item) return { success: true };

    const targetSession = session.fromPartition('persist:main');
    try {
        targetSession.removeExtension(extId);
    } catch (e) {}

    if (!item.isUnpacked && item.path && fs.existsSync(item.path)) {
        try {
            fs.rmSync(item.path, { recursive: true, force: true });
        } catch (e) {
            console.warn('[ExtensionService] Delete directory error:', e.message);
        }
    }

    installedExtensions = installedExtensions.filter(e => e.id !== extId);
    saveMetadata();

    return { success: true, id: extId };
}

function openExtensionFolder(extId) {
    loadMetadata();
    const item = installedExtensions.find(e => e.id === extId);
    if (item && item.path && fs.existsSync(item.path)) {
        shell.showItemInFolder(item.path);
        return { success: true };
    }
    if (extensionsDir && fs.existsSync(extensionsDir)) {
        shell.openPath(extensionsDir);
        return { success: true };
    }
    return { success: false, error: 'Path not found' };
}

module.exports = {
    initExtensionService,
    getInstalledExtensions,
    getCuratedAddons,
    installExtensionFromWebStore,
    installUnpackedExtension,
    toggleExtension,
    removeExtension,
    openExtensionFolder
};
