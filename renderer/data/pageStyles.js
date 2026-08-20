// ==========================================================================
// YT Studio Pro — Injected CSS Styles for Webview Features
// ==========================================================================

export const ADBLOCK_CSS = `
    .ad-container, .adsbygoogle, .ad-banner, [id*="google_ads"], 
    [class*="sponsored"], [id*="sponsored"], #player-ads, 
    .ytp-ad-module, .ytp-ad-overlay-container, .ad-slot, 
    [aria-label*="advertisement" i], [aria-label*="sponsored" i] {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
    }
`;

export const DARK_READER_CSS = `
    html {
        filter: invert(90%) hue-rotate(180deg) !important;
        background: #121212 !important;
    }
    img, video, canvas, svg, [style*="background-image"], iframe {
        filter: invert(100%) hue-rotate(180deg) !important;
    }
`;
