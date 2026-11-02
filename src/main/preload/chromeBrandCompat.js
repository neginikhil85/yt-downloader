// ==========================================================================
// Chrome Brand Fingerprint Compat (Research Browser webviews)
//
// Cloudflare Turnstile / bot-management cross-checks:
//   1) User-Agent Chrome major
//   2) sec-ch-ua Client Hints brands
//   3) navigator.userAgentData.brands / getHighEntropyValues()
// Electron advertises "Chromium" without "Google Chrome", which often yields
// "Additional Verification Required" on Indeed and similar sites.
// This preload aligns JS-visible brands with a normal Chrome desktop profile.
// ==========================================================================

(function () {
    try {
        const CHROME_MAJOR = (process.versions.chrome || '132').split('.')[0];
        const CHROME_FULL = process.versions.chrome || `${CHROME_MAJOR}.0.0.0`;

        const uad = navigator.userAgentData;
        if (!uad || !Array.isArray(uad.brands)) return;

        const hasChrome = uad.brands.some((b) => b && b.brand === 'Google Chrome');
        if (hasChrome) return;

        const brands = [
            { brand: 'Not(A:Brand', version: '8' },
            { brand: 'Chromium', version: CHROME_MAJOR },
            { brand: 'Google Chrome', version: CHROME_MAJOR }
        ];

        const fullVersionList = [
            { brand: 'Not(A:Brand', version: '10.0.0.0' },
            { brand: 'Chromium', version: CHROME_FULL },
            { brand: 'Google Chrome', version: CHROME_FULL }
        ];

        const detectedPlatform = navigator.userAgent.includes('Windows')
            ? 'Windows'
            : (navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux');

        Object.defineProperty(uad, 'brands', {
            get: () => brands.map((b) => ({ ...b })),
            configurable: true
        });

        Object.defineProperty(uad, 'mobile', {
            get: () => false,
            configurable: true
        });

        Object.defineProperty(uad, 'platform', {
            get: () => detectedPlatform,
            configurable: true
        });

        const originalHighEntropy = typeof uad.getHighEntropyValues === 'function'
            ? uad.getHighEntropyValues.bind(uad)
            : null;

        Object.defineProperty(uad, 'getHighEntropyValues', {
            value: function (hints) {
                const base = originalHighEntropy
                    ? originalHighEntropy(hints)
                    : Promise.resolve({});
                return base.then((values) => {
                    const patched = { ...values };
                    patched.brands = brands.map((b) => ({ ...b }));
                    patched.mobile = false;
                    patched.platform = detectedPlatform;
                    if ('fullVersionList' in patched || (hints && hints.includes('fullVersionList'))) {
                        patched.fullVersionList = fullVersionList.map((b) => ({ ...b }));
                    }
                    if ('uaFullVersion' in patched || (hints && hints.includes('uaFullVersion'))) {
                        patched.uaFullVersion = CHROME_FULL;
                    }
                    if ('platformVersion' in patched || (hints && hints.includes('platformVersion'))) {
                        patched.platformVersion = patched.platformVersion || '15.0.0';
                    }
                    return patched;
                });
            },
            configurable: true,
            writable: true
        });
    } catch (_) {
        // Never break page load over fingerprint patching
    }
})();
