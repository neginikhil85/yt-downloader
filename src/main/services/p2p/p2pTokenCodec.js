// ==========================================================================
// YT Studio Pro — P2P Out-of-Band Token Codec
// Ultra-compact deflate compression + base64url encoding
// ==========================================================================

const zlib = require('zlib');

function compressToken(obj) {
    try {
        const json = JSON.stringify(obj);
        const compressed = zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 });
        return compressed.toString('base64url');
    } catch (e) {
        console.error('[P2P Token Codec] Compress failed:', e);
        return JSON.stringify(obj);
    }
}

function decompressToken(tokenStr) {
    try {
        const buf = Buffer.from(tokenStr.trim(), 'base64url');
        const decompressed = zlib.inflateRawSync(buf);
        return JSON.parse(decompressed.toString('utf8'));
    } catch (e) {
        try {
            return JSON.parse(tokenStr.trim());
        } catch (err2) {
            throw new Error('Invalid or corrupted connection token format');
        }
    }
}

module.exports = {
    compressToken,
    decompressToken
};
