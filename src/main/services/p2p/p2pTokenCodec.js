// ==========================================================================
// YT Studio Pro — Unified P2P Connection Token Codec
// Ultra-compact deflate compression + base64url encoding (YT-...)
// ==========================================================================

const zlib = require('zlib');

const TOKEN_PREFIX = 'YT-';

/**
 * Packs session metadata into a compact, copyable string
 */
function encodeSessionToken(session) {
    try {
        const compactPayload = {
            v: 1,
            f: {
                n: session.file.name,
                s: session.file.size,
                h: session.file.hash || ''
            },
            l: session.lanIps || [],
            p: session.port || 9876,
            w: session.wanEndpoint || '',
            k: session.key || ''
        };

        const json = JSON.stringify(compactPayload);
        const compressed = zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
        return TOKEN_PREFIX + compressed.toString('base64url');
    } catch (e) {
        console.error('[P2P Token Codec] Encode error:', e);
        throw new Error('Failed to generate connection token');
    }
}

/**
 * Decodes and validates a session token string
 */
function decodeSessionToken(tokenStr) {
    if (!tokenStr || typeof tokenStr !== 'string') {
        throw new Error('Token string cannot be empty');
    }

    let cleanStr = tokenStr.trim();
    if (cleanStr.startsWith(TOKEN_PREFIX)) {
        cleanStr = cleanStr.substring(TOKEN_PREFIX.length);
    }

    try {
        const buf = Buffer.from(cleanStr, 'base64url');
        const decompressed = zlib.inflateRawSync(buf);
        const parsed = JSON.parse(decompressed.toString('utf8'));

        if (!parsed.f || !parsed.f.n || typeof parsed.f.s !== 'number') {
            throw new Error('Invalid token structure');
        }

        return {
            version: parsed.v || 1,
            file: {
                name: parsed.f.n,
                size: parsed.f.s,
                hash: parsed.f.h || ''
            },
            lanIps: Array.isArray(parsed.l) ? parsed.l : [],
            port: parsed.p || 9876,
            wanEndpoint: parsed.w || '',
            key: parsed.k || ''
        };
    } catch (e) {
        // Fallback for raw JSON if any
        try {
            const raw = JSON.parse(cleanStr);
            if (raw.file && raw.file.name) return raw;
        } catch (err2) {}
        throw new Error('Invalid or corrupted connection token. Please ask sender for a new code.');
    }
}

// Backward-compatible aliases
const compressToken = (obj) => encodeSessionToken(obj);
const decompressToken = (str) => decodeSessionToken(str);

module.exports = {
    TOKEN_PREFIX,
    encodeSessionToken,
    decodeSessionToken,
    compressToken,
    decompressToken
};
