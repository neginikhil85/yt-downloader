// ==========================================================================
// YT Studio Pro — Browser URL Parser & Route Utilities
// ==========================================================================

export function isHomeUrl(url) {
    return !url || url === 'about:home' || url === 'about:blank' || url === 'home';
}

export function isAddonsUrl(url) {
    return url === 'about:addons' || url === 'about:extensions' || url === 'about:themes';
}

export function parseUrl(input) {
    let trimmed = (input || '').trim();
    if (!trimmed || isHomeUrl(trimmed)) {
        return 'about:home';
    }
    if (isAddonsUrl(trimmed)) {
        return 'about:addons';
    }

    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }

    const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
    if (domainRegex.test(trimmed) || /^localhost(:\d+)?/i.test(trimmed)) {
        return 'https://' + trimmed;
    }

    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}
