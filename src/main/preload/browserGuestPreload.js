// ==========================================================================
// Research Browser <webview> guest preload entry
//
// Why `webFrame.executeJavaScript` + `sendSync` is required here:
// 1) Ghostery's default preload calls `ipcRenderer.invoke()` (async). By the
//    time the IPC round-trip finishes, YouTube's inline bootstrap has already
//    cached unpatched `window.fetch`, `XMLHttpRequest`, and `JSON.parse`, so
//    all uBlock/Ghostery ad-pruning scriptlets miss mid-roll / player JSON.
// 2) Plain `(0, eval)(code)` inside the preload is blocked by YouTube's
//    Content-Security-Policy (`require-trusted-types-for 'script'`, no
//    `'unsafe-eval'`), silently throwing EvalError on every scriptlet.
//
// `ipcRenderer.sendSync` fetches the scriptlets synchronously before the page's
// first `<script>` tag, and `webFrame.executeJavaScript` runs them through
// Blink's C++ WebLocalFrame::ExecuteScript, which bypasses page CSP / Trusted
// Types while executing immediately in the main world.
// ==========================================================================

const { ipcRenderer, webFrame } = require('electron');

try {
    if (
        typeof window !== 'undefined' &&
        window === window.top &&
        location.href &&
        !location.href.startsWith('devtools://') &&
        location.href !== 'about:blank'
    ) {
        const payload = ipcRenderer.sendSync('adblock:get-sync-cosmetics', location.href);
        if (payload && Array.isArray(payload.scripts) && payload.scripts.length > 0) {
            const combined = payload.scripts
                .map((s) => `try {\n${s}\n} catch (_) {}`)
                .join('\n;\n');

            if (webFrame && typeof webFrame.executeJavaScript === 'function') {
                webFrame.executeJavaScript(combined, true);
            }
        }
    }
} catch (_) {}

// Keep Ghostery's DOMMonitor active for dynamic CSS / element hiding
try {
    require('@ghostery/adblocker-electron-preload');
} catch (_) {}

require('./chromeBrandCompat.js');
require('./webstoreCompat.js');
