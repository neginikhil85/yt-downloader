// ==========================================================================
// YT Studio Pro — Standalone Zero-Dependency QR Code SVG Generator
// Pure JavaScript Reed-Solomon & QR Matrix Engine (ISO/IEC 18004 compliant)
// ==========================================================================

// Precomputed Galois Field (GF 2^8) Tables for Reed-Solomon error correction
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP_TABLE[i] = x;
        EXP_TABLE[i + 255] = x;
        LOG_TABLE[x] = i;
        x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
    }
    LOG_TABLE[0] = 0;
})();

function gfMul(x, y) {
    if (x === 0 || y === 0) return 0;
    return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
}

function rsGeneratorPoly(degree) {
    let poly = new Uint8Array([1]);
    for (let i = 0; i < degree; i++) {
        const next = new Uint8Array(poly.length + 1);
        for (let j = 0; j < poly.length; j++) {
            next[j] ^= gfMul(poly[j], EXP_TABLE[i]);
            next[j + 1] ^= poly[j];
        }
        poly = next;
    }
    return poly;
}

function rsEncode(data, ecCount) {
    const gen = rsGeneratorPoly(ecCount);
    const remainder = new Uint8Array(ecCount);

    for (let i = 0; i < data.length; i++) {
        const factor = data[i] ^ remainder[0];
        for (let j = 0; j < ecCount - 1; j++) {
            remainder[j] = remainder[j + 1] ^ gfMul(gen[j + 1], factor);
        }
        remainder[ecCount - 1] = gfMul(gen[ecCount], factor);
    }
    return remainder;
}

// Version table for QR Version 3 (29x29) & Version 4 (33x33) Low-Correction (L)
// Version 3-L can hold up to 77 alphanumeric/URL characters (plenty for http://192.168.x.x:9876/?pin=123456)
// Version 4-L can hold up to 114 characters
const QR_VERSIONS = [
    null,
    { ver: 1, size: 21, totalBytes: 26, dataBytes: 19, ecBytes: 7, align: [] },
    { ver: 2, size: 25, totalBytes: 44, dataBytes: 34, ecBytes: 10, align: [6, 18] },
    { ver: 3, size: 29, totalBytes: 70, dataBytes: 55, ecBytes: 15, align: [6, 22] },
    { ver: 4, size: 33, totalBytes: 100, dataBytes: 80, ecBytes: 20, align: [6, 26] },
    { ver: 5, size: 37, totalBytes: 134, dataBytes: 108, ecBytes: 26, align: [6, 30] }
];

function selectVersion(byteLength) {
    for (let v = 1; v < QR_VERSIONS.length; v++) {
        // Overhead: 4 bits mode + 8 bits char count = 1.5 bytes + data
        if (byteLength + 3 <= QR_VERSIONS[v].dataBytes) {
            return QR_VERSIONS[v];
        }
    }
    return QR_VERSIONS[5];
}

/**
 * Creates QR Matrix for input string
 */
function createQRMatrix(text) {
    const rawBytes = Buffer.from(text, 'utf8');
    const ver = selectVersion(rawBytes.length);
    const size = ver.size;

    // 1. Create bit buffer (Byte Mode = 0100)
    const bits = [];
    function pushBits(val, len) {
        for (let i = len - 1; i >= 0; i--) {
            bits.push((val >> i) & 1);
        }
    }

    pushBits(0b0100, 4); // Byte mode
    pushBits(rawBytes.length, 8); // Char count
    for (let i = 0; i < rawBytes.length; i++) {
        pushBits(rawBytes[i], 8);
    }

    // Terminator
    const maxBits = ver.dataBytes * 8;
    for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    // Pad bytes 0xEC, 0x11
    let pad = 0xEC;
    while (bits.length < maxBits) {
        pushBits(pad, 8);
        pad = pad === 0xEC ? 0x11 : 0xEC;
    }

    // Convert bits to data bytes
    const dataBytes = new Uint8Array(ver.dataBytes);
    for (let i = 0; i < dataBytes.length; i++) {
        let b = 0;
        for (let j = 0; j < 8; j++) {
            b = (b << 1) | bits[i * 8 + j];
        }
        dataBytes[i] = b;
    }

    // Error Correction
    const ecBytes = rsEncode(dataBytes, ver.ecBytes);

    // Final interleaved codeword
    const finalCodewords = new Uint8Array(ver.totalBytes);
    finalCodewords.set(dataBytes, 0);
    finalCodewords.set(ecBytes, dataBytes.length);

    // Matrix (size x size)
    // 0 = white, 1 = black, -1 = empty
    const matrix = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
    const isReserved = Array.from({ length: size }, () => new Uint8Array(size));

    function setModule(r, c, val) {
        if (r >= 0 && r < size && c >= 0 && c < size) {
            matrix[r][c] = val ? 1 : 0;
            isReserved[r][c] = 1;
        }
    }

    // Draw Finder Pattern (7x7)
    function drawFinder(row, col) {
        for (let r = -1; r <= 7; r++) {
            for (let c = -1; c <= 7; c++) {
                const tr = row + r;
                const tc = col + c;
                if (tr < 0 || tr >= size || tc < 0 || tc >= size) continue;
                if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
                    if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
                        setModule(tr, tc, 1);
                    } else {
                        setModule(tr, tc, 0);
                    }
                } else {
                    setModule(tr, tc, 0); // Separator
                }
            }
        }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Alignment Patterns
    if (ver.align.length > 0) {
        for (const ar of ver.align) {
            for (const ac of ver.align) {
                if (isReserved[ar][ac]) continue;
                for (let r = -2; r <= 2; r++) {
                    for (let c = -2; c <= 2; c++) {
                        if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
                            setModule(ar + r, ac + c, 1);
                        } else {
                            setModule(ar + r, ac + c, 0);
                        }
                    }
                }
            }
        }
    }

    // Timing Patterns
    for (let i = 8; i < size - 8; i++) {
        if (!isReserved[6][i]) setModule(6, i, i % 2 === 0 ? 1 : 0);
        if (!isReserved[i][6]) setModule(i, 6, i % 2 === 0 ? 1 : 0);
    }

    // Dark Module
    setModule(size - 8, 8, 1);

    // Format bits (Level L, Mask 0: (row + col) % 2 === 0) -> Format string = 111011111000100
    const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
    for (let i = 0; i < 6; i++) setModule(8, i, formatBits[i]);
    setModule(8, 7, formatBits[6]);
    setModule(8, 8, formatBits[7]);
    setModule(7, 8, formatBits[8]);
    for (let i = 9; i < 15; i++) setModule(14 - i, 8, formatBits[i]);

    for (let i = 0; i < 8; i++) setModule(size - 1 - i, 8, formatBits[i]);
    for (let i = 8; i < 15; i++) setModule(8, size - 15 + i, formatBits[i]);

    // Data Placement (Mask 0: (r + c) % 2 == 0)
    let bitIdx = 0;
    const allBits = [];
    for (const b of finalCodewords) {
        for (let i = 7; i >= 0; i--) allBits.push((b >> i) & 1);
    }

    let up = true;
    for (let right = size - 1; right > 0; right -= 2) {
        if (right === 6) right--; // Skip vertical timing column
        const cols = [right, right - 1];

        for (let v = 0; v < size; v++) {
            const r = up ? size - 1 - v : v;
            for (const c of cols) {
                if (isReserved[r][c]) continue;
                let val = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
                // Apply Mask 0: (r + c) % 2 == 0
                if ((r + c) % 2 === 0) {
                    val ^= 1;
                }
                matrix[r][c] = val;
            }
        }
        up = !up;
    }

    return matrix;
}

/**
 * Generates an SVG string of the QR Code
 */
function generateQrSvg(text, options = {}) {
    const { size = 200, padding = 2, color = '#38bdf8', bg = '#0f1013' } = options;
    const matrix = createQRMatrix(text);
    const n = matrix.length;
    const totalSize = n + padding * 2;

    let pathD = '';
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (matrix[r][c] === 1) {
                const x = c + padding;
                const y = r + padding;
                pathD += `M${x},${y}h1v1h-1z `;
            }
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${size}" height="${size}" shape-rendering="crispEdges">
        <rect width="100%" height="100%" fill="${bg}" rx="${Math.round(totalSize * 0.04)}"/>
        <path d="${pathD}" fill="${color}"/>
    </svg>`;
}

module.exports = {
    createQRMatrix,
    generateQrSvg
};
