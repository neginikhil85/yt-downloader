// ==========================================================================
// YT Studio Pro — Injected CSS Styles for Webview Features
// ==========================================================================

// Ad blocking is handled in the main process by adblockService
// (EasyList / uBlock Origin filter lists via @ghostery/adblocker-electron).
// Do not reintroduce CSS/JS "ad skippers" here — they cannot stop YouTube
// mid-roll streams and fight with the real network filter engine.

export const DARK_READER_CSS = `
    html {
        filter: invert(90%) hue-rotate(180deg) !important;
        background: #121212 !important;
    }
    img, video, canvas, svg, [style*="background-image"], iframe {
        filter: invert(100%) hue-rotate(180deg) !important;
    }
`;
