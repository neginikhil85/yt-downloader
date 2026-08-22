/**
 * ytDlpConfig.js — Centralized Adaptive yt-dlp Extractor Configuration
 *
 * Detects the runtime environment (yt-dlp version, Node.js availability, platform)
 * at startup and builds the optimal EXTRACTOR_ARGS for both macOS and Windows.
 *
 * This eliminates the cross-platform whack-a-mole where hardcoding one strategy
 * works on one OS but breaks on the other.
 */

const { execFileSync } = require('child_process');
const { YT_DLP_PATH } = require('./paths');

// ---------------------------------------------------------------------------
// 1. Detect yt-dlp version
// ---------------------------------------------------------------------------

let _ytDlpVersion = null;

function getYtDlpVersion() {
    if (_ytDlpVersion !== null) return _ytDlpVersion;
    try {
        const raw = execFileSync(YT_DLP_PATH, ['--version'], {
            encoding: 'utf8',
            timeout: 10000,
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        _ytDlpVersion = raw; // e.g. "2026.08.19"
    } catch (e) {
        console.warn('[ytDlpConfig] Could not detect yt-dlp version:', e.message);
        _ytDlpVersion = 'unknown';
    }
    return _ytDlpVersion;
}

/**
 * Parses a yt-dlp version string like "2026.08.19" into a comparable integer 20260819
 */
function parseVersionInt(vStr) {
    if (!vStr || vStr === 'unknown') return 0;
    const parts = vStr.split('.').map(Number).filter(n => !isNaN(n));
    if (parts.length < 3) return 0;
    return parts[0] * 10000 + parts[1] * 100 + parts[2];
}

// The visionos client was added around 2026.08.x; versions before this need explicit client overrides
const VISIONOS_MIN_VERSION = 20260800;

// ---------------------------------------------------------------------------
// 2. Detect Node.js availability for JS challenge solving
// ---------------------------------------------------------------------------

let _nodeAvailable = null;

function isNodeAvailable() {
    if (_nodeAvailable !== null) return _nodeAvailable;
    try {
        // Try to find node in PATH
        const checkCmd = process.platform === 'win32' ? 'where node' : 'which node';
        const { execSync } = require('child_process');
        const nodePath = execSync(checkCmd, {
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim().split(/[\r\n]+/)[0];
        _nodeAvailable = !!nodePath;
    } catch (e) {
        // Also check if the Electron process.execPath hosts Node capabilities
        // (In packaged Electron apps, system node may not be in PATH)
        _nodeAvailable = false;
    }
    return _nodeAvailable;
}

// ---------------------------------------------------------------------------
// 3. Build Adaptive EXTRACTOR_ARGS
// ---------------------------------------------------------------------------

let _cachedArgs = null;
let _strategyName = '';

function buildExtractorArgs() {
    const args = ['--no-check-certificates'];
    const version = getYtDlpVersion();
    const versionInt = parseVersionInt(version);
    const hasVisionos = versionInt >= VISIONOS_MIN_VERSION;
    const nodeOk = isNodeAvailable();

    if (nodeOk) {
        args.push('--js-runtimes', 'node');
    }

    if (hasVisionos) {
        // Modern yt-dlp (>= 2026.08.x): default client waterfall uses visionos
        // which does NOT require PO tokens or JS challenge solving.
        // Do NOT force any player_client — let yt-dlp pick the best one.
        _strategyName = `default-waterfall (yt-dlp ${version}, visionos available, node=${nodeOk})`;
    } else {
        // Older yt-dlp: visionos client doesn't exist.
        // Use android_vr as primary (no PO token needed on older versions),
        // with web as fallback for signature-solved DASH formats.
        args.push('--extractor-args', 'youtube:player_client=android_vr,web');
        _strategyName = `legacy-clients (yt-dlp ${version}, pre-visionos, node=${nodeOk})`;
    }

    return args;
}

/**
 * Returns the optimal EXTRACTOR_ARGS for the current environment.
 * Cached after first call.
 */
function getExtractorArgs() {
    if (_cachedArgs === null) {
        _cachedArgs = buildExtractorArgs();
        console.log(`[ytDlpConfig] Strategy: ${_strategyName}`);
        console.log(`[ytDlpConfig] EXTRACTOR_ARGS: ${JSON.stringify(_cachedArgs)}`);
    }
    return _cachedArgs;
}

/**
 * Returns diagnostic information for debugging cross-platform issues.
 */
function getDiagnostics() {
    return {
        platform: process.platform,
        arch: process.arch,
        ytDlpPath: YT_DLP_PATH,
        ytDlpVersion: getYtDlpVersion(),
        visionosSupported: parseVersionInt(getYtDlpVersion()) >= VISIONOS_MIN_VERSION,
        nodeAvailable: isNodeAvailable(),
        strategy: _strategyName || '(not yet initialized)',
        extractorArgs: _cachedArgs || '(not yet initialized)'
    };
}

module.exports = {
    getExtractorArgs,
    getDiagnostics,
    getYtDlpVersion
};
