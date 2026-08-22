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
const { getHttpPort } = require('../services/p2p/p2pHttpServer');

// ---------------------------------------------------------------------------
// 1. Detect yt-dlp version
// ---------------------------------------------------------------------------

let _ytDlpVersion = null;

function getYtDlpVersion() {
    if (_ytDlpVersion !== null) return _ytDlpVersion;
    _ytDlpVersion = '2026.08.19';
    try {
        const { execFile } = require('child_process');
        execFile(YT_DLP_PATH, ['--version'], { timeout: 25000 }, (err, stdout) => {
            if (!err && stdout && stdout.trim()) {
                _ytDlpVersion = stdout.trim();
            }
        });
    } catch (e) {}
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

let _strategyName = '';

function buildExtractorArgs() {
    const port = getHttpPort() || 9876;
    const args = [
        '--no-check-certificates',
        '--proxy', `http://127.0.0.1:${port}`,
        '--http-chunk-size', '10M'
    ];
    const version = getYtDlpVersion();
    const nodeOk = isNodeAvailable();

    if (nodeOk) {
        args.push('--js-runtimes', 'node');
    }

    _strategyName = `local-proxy-tunnel (port ${port}, yt-dlp ${version}, node=${nodeOk})`;
    return args;
}

/**
 * Returns the optimal EXTRACTOR_ARGS for the current environment.
 * Generates fresh proxy port mapping so runtime port changes are automatically reflected.
 */
function getExtractorArgs() {
    return buildExtractorArgs();
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
        proxyPort: getHttpPort() || 9876,
        strategy: _strategyName || '(not yet initialized)',
        extractorArgs: buildExtractorArgs()
    };
}

module.exports = {
    getExtractorArgs,
    getDiagnostics,
    getYtDlpVersion
};
