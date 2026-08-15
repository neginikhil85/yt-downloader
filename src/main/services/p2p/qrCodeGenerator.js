// ==========================================================================
// YT Studio Pro — High-Contrast Professional QR Code Generator
// ISO/IEC 18004 Standard compliant with 15% Error Correction (M-level)
// ==========================================================================

const QRCode = require('qrcode');

/**
 * Generates a clean, professional, camera-scannable SVG string of the QR Code
 * Standard Black & White with proper quiet-zone margin for instant camera focus
 */
async function generateQrSvg(text, options = {}) {
    const {
        margin = 2,
        dark = '#000000',
        light = '#ffffff',
        width = 160,
        errorCorrectionLevel = 'M'
    } = options;

    try {
        const svg = await QRCode.toString(text, {
            type: 'svg',
            margin,
            width,
            errorCorrectionLevel,
            color: {
                dark,
                light
            }
        });
        return svg;
    } catch (err) {
        console.error('[QR Generator] Error generating QR code:', err);
        return '';
    }
}

/**
 * Synchronous data URL helper if needed
 */
async function generateQrDataUrl(text, options = {}) {
    try {
        return await QRCode.toDataURL(text, {
            margin: 2,
            width: 200,
            errorCorrectionLevel: 'M',
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
    } catch (err) {
        return '';
    }
}

module.exports = {
    generateQrSvg,
    generateQrDataUrl
};
