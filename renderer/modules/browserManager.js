// ==========================================================================
// YT Studio Pro — Chromium & Firefox Style Research Browser Module
// ==========================================================================

// 1. Authentic Brand Vector Logos for Top Websites
const BRAND_ICONS = {
    google: {
        bg: '#ffffff',
        svg: `<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>`
    },
    youtube: {
        bg: '#FF0000',
        svg: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#ffffff"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
    },
    chatgpt: {
        bg: '#10a37f',
        svg: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#ffffff"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.08 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.493zm-9.22-3.834a4.484 4.484 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-5.7-.154zm-1.84-9.33a4.46 4.46 0 0 1 2.34-1.974v5.677a.79.79 0 0 0 .392.68l5.84 3.37-2.02 1.166a.076.076 0 0 1-.067 0l-4.83-2.786a4.504 4.504 0 0 1-1.655-6.133zm14.868 2.822-5.843-3.37 2.02-1.166a.076.076 0 0 1 .067 0l4.83 2.786a4.504 4.504 0 0 1 1.655 6.133 4.46 4.46 0 0 1-2.34 1.974v-5.677a.79.79 0 0 0-.389-.68zm2.01-3.023-.141-.085-4.779-2.759a.776.776 0 0 0-.785 0L7.53 9.42V7.088a.08.08 0 0 1 .033-.062l5.28-3.048a4.499 4.499 0 0 1 6.96 4.097zM8.308 12.91l2.45-1.414 2.45 1.414v2.828l-2.45 1.414-2.45-1.414z"/></svg>`
    },
    deepseek: {
        bg: '#0066FF',
        svg: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#ffffff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`
    },
    github: {
        bg: '#24292e',
        svg: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#ffffff"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>`
    },
    reddit: {
        bg: '#FF4500',
        svg: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#ffffff"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.56 12 8 12.56 8 13.25c0 .687.56 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.56-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>`
    },
    wikipedia: {
        bg: '#2e3440',
        svg: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#ffffff"><path d="M12.09 13.92 14.54 7.6h1.93l-3.53 8.8h-1.85L8.43 9.94 5.77 16.4H3.84L7.5 7.6h1.93l2.66 6.32zM21.5 7.6h-2.1l-2.4 6.32-2.4-6.32H12.5l3.5 8.8h1.9l3.6-8.8z"/></svg>`
    },
    spotify: {
        bg: '#1ED760',
        svg: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#000000"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`
    },
    twitter: {
        bg: '#000000',
        svg: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#ffffff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
    },
    discord: {
        bg: '#5865F2',
        svg: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#ffffff"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`
    },
    netflix: {
        bg: '#000000',
        svg: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#E50914"><path d="M5.398 0v24h3.766V7.472l6.096 16.528H19.5V0h-3.766v16.528L9.638 0H5.398z"/></svg>`
    }
};

const DEFAULT_PINNED_APPS = [
    { name: 'YouTube', url: 'https://www.youtube.com', key: 'youtube' },
    { name: 'ChatGPT', url: 'https://chatgpt.com', key: 'chatgpt' },
    { name: 'DeepSeek', url: 'https://chat.deepseek.com', key: 'deepseek' },
    { name: 'GitHub', url: 'https://github.com', key: 'github' },
    { name: 'Reddit', url: 'https://www.reddit.com', key: 'reddit' },
    { name: 'Wikipedia', url: 'https://www.wikipedia.org', key: 'wikipedia' },
    { name: 'Spotify', url: 'https://open.spotify.com', key: 'spotify' },
    { name: 'Google', url: 'https://www.google.com', key: 'google' }
];

const BROWSER_THEMES = [
    {
        key: 'obsidian',
        name: 'Obsidian Studio',
        badge: 'Default',
        desc: 'Deep matte charcoal with subtle cobalt blue lighting',
        swatch: ['#0b0c10', '#181b23', '#3b82f6']
    },
    {
        key: 'cyberpunk',
        name: 'Midnight Cyberpunk',
        badge: 'Neon Glow',
        desc: 'High-contrast ultraviolet violet & cybernetic cyan accents',
        swatch: ['#090611', '#191230', '#a855f7']
    },
    {
        key: 'nord',
        name: 'Nord Arctic Frost',
        badge: 'Clean Polar',
        desc: 'Arctic slate, deep polar night blue, and ice cyan highlights',
        swatch: ['#0c1017', '#1a232f', '#38bdf8']
    },
    {
        key: 'ember',
        name: 'Solarized Ember',
        badge: 'Warm Dark',
        desc: 'Warm graphite dark background with vibrant amber fire glow',
        swatch: ['#100b08', '#241912', '#f97316']
    },
    {
        key: 'emerald',
        name: 'Matrix Emerald',
        badge: 'Forest Tech',
        desc: 'Dark cyber forest base with bright mint green accents',
        swatch: ['#070f0a', '#132419', '#10b981']
    },
    {
        key: 'oled',
        name: 'Pure OLED Black',
        badge: 'Zero Backlight',
        desc: '100% True black for maximum contrast & battery efficiency',
        swatch: ['#000000', '#0d0d0d', '#00f0ff']
    }
];

const CURATED_ADDONS_DATA = [
    {
        id: 'cjpalhdlnbpafiamejdnhcphjbkeiagm',
        name: 'uBlock Origin',
        category: 'Privacy & Security',
        description: 'An efficient ad, tracker, and malware blocker. Fast, lightweight, and highly customizable.',
        badge: 'Top Rated',
        author: 'Raymond Hill',
        iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`
    },
    {
        id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh',
        name: 'Dark Reader',
        category: 'Visual & Themes',
        description: 'Invert brightness and contrast on every website with high-performance real-time dark mode.',
        badge: 'Essential',
        author: 'Alexander Shutov',
        iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10V2z"></path></svg>`
    },
    {
        id: 'hlkenndednhfkekhgcdicdfddnkalmdm',
        name: 'Cookie-Editor',
        category: 'Developer Tools',
        description: 'Create, edit, search, and export cookies for the current tab with zero friction.',
        badge: 'Dev Tool',
        author: 'Moustachware',
        iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="8" cy="9" r="1.5"></circle><circle cx="15" cy="8" r="1"></circle><circle cx="10" cy="15" r="1.5"></circle><circle cx="16" cy="14" r="1.5"></circle></svg>`
    },
    {
        id: 'mnjggcdmjocbbbhaepdhchncahnbgone',
        name: 'SponsorBlock',
        category: 'Media & Streaming',
        description: 'Automatically skip YouTube video sponsorships, intros, outros, and subscribe reminders.',
        badge: 'Popular',
        author: 'Ajay Ramachandran',
        iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>`
    },
    {
        id: 'jinjaccalgkegednnccohejagnlnfdag',
        name: 'Violentmonkey',
        category: 'Developer Tools',
        description: 'Lightweight and open-source userscript manager supporting Greasemonkey & Tampermonkey scripts.',
        badge: 'Power Tool',
        author: 'Violentmonkey Team',
        iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`
    },
    {
        id: 'djflhoibgkdhkhhcedjflbmhjenkljhe',
        name: 'User-Agent Switcher',
        category: 'Utilities',
        description: 'Quickly switch browser user-agent string to spoof mobile, tablet, or desktop devices.',
        badge: 'Utility',
        author: 'Ray',
        iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`
    }
];

const USER_AGENTS = {
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
    ipad: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'safari-mac': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
};

const ADBLOCK_CSS = `
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

const DARK_READER_CSS = `
    html {
        filter: invert(90%) hue-rotate(180deg) !important;
        background: #121212 !important;
    }
    img, video, canvas, svg, [style*="background-image"], iframe {
        filter: invert(100%) hue-rotate(180deg) !important;
    }
`;

export function initBrowserManager() {
    const tabsContainer = document.getElementById('browser-tabs-scroll');
    const btnNewTab = document.getElementById('browser-btn-new-tab');
    const webviewsContainer = document.getElementById('browser-webview-container');
    const homeDashboard = document.getElementById('browser-home-dashboard');
    const homeAppsGrid = document.getElementById('home-apps-grid');
    const pinnedBar = document.getElementById('browser-pinned-bar');
    
    const urlInput = document.getElementById('browser-url-input');
    const btnGo = document.getElementById('browser-btn-go');
    const btnBack = document.getElementById('browser-btn-back');
    const btnForward = document.getElementById('browser-btn-forward');
    const btnReload = document.getElementById('browser-btn-reload');
    const btnHome = document.getElementById('browser-btn-home');
    const btnFullscreen = document.getElementById('browser-btn-fullscreen');
    const btnPinPage = document.getElementById('browser-btn-pin-page');
    const btnCopyUrl = document.getElementById('browser-btn-copy-url');
    const btnThemeStudio = document.getElementById('browser-btn-theme-studio');
    const btnExtHub = document.getElementById('browser-btn-ext-hub');
    const btnExtensions = document.getElementById('browser-btn-extensions');
    const browserPanel = document.getElementById('view-browser');
    const activeCountBadge = document.getElementById('ext-active-count-badge');

    // Extensions Quick Popover
    const extPanel = document.getElementById('browser-extensions-panel');
    const extCloseBtn = document.getElementById('ext-close-btn');
    const extToggleAdblock = document.getElementById('ext-toggle-adblock');
    const extToggleDarkmode = document.getElementById('ext-toggle-darkmode');
    const extBtnReader = document.getElementById('ext-btn-reader');
    const extBtnPip = document.getElementById('ext-btn-pip');
    const extUaSelect = document.getElementById('ext-ua-select');
    const extBtnDevtools = document.getElementById('ext-btn-devtools');
    const extBtnInjectJs = document.getElementById('ext-btn-inject-js');
    const extBtnClearCache = document.getElementById('ext-btn-clear-cache');
    const extBtnHardReload = document.getElementById('ext-btn-hard-reload');

    // Extension Hub Modal Elements
    const modalExtHub = document.getElementById('modal-extension-hub');
    const btnCloseExtHub = document.getElementById('btn-close-ext-hub');
    const btnExtHubDone = document.getElementById('btn-ext-hub-done');
    const extHubTabs = document.querySelectorAll('.ext-hub-tab');
    const extHubViews = document.querySelectorAll('.ext-hub-view');
    const extCuratedGrid = document.getElementById('ext-curated-grid');
    const extInstalledList = document.getElementById('ext-installed-list');
    const extThemesGrid = document.getElementById('ext-themes-grid');
    const extInstalledPill = document.getElementById('ext-installed-count-pill');
    const extMarketSearch = document.getElementById('ext-market-search');
    const extCatPills = document.querySelectorAll('.ext-cat-pill');
    const extSideloadInput = document.getElementById('ext-sideload-input');
    const extSideloadBtn = document.getElementById('ext-sideload-btn');
    const extSideloadStatus = document.getElementById('ext-sideload-status');
    const extBtnSideloadFolder = document.getElementById('ext-btn-sideload-folder');
    const extBtnQuickUnpack = document.getElementById('ext-btn-quick-unpack');

    // Find in Page Elements
    const findBar = document.getElementById('browser-find-bar');
    const findInput = document.getElementById('browser-find-input');
    const findCount = document.getElementById('browser-find-count');
    const findPrev = document.getElementById('browser-find-prev');
    const findNext = document.getElementById('browser-find-next');
    const findClose = document.getElementById('browser-find-close');

    // Modals
    const pinAppModal = document.getElementById('pin-app-modal');
    const btnClosePinModal = document.getElementById('btn-close-pin-modal');
    const btnPinCancel = document.getElementById('btn-pin-cancel');
    const btnPinSave = document.getElementById('btn-pin-save');
    const pinNameInput = document.getElementById('pin-name-input');
    const pinUrlInput = document.getElementById('pin-url-input');

    const scriptModal = document.getElementById('script-inject-modal');
    const btnCloseScriptModal = document.getElementById('btn-close-script-modal');
    const btnScriptCancel = document.getElementById('btn-script-cancel');
    const btnScriptRun = document.getElementById('btn-script-run');
    const scriptTextarea = document.getElementById('script-inject-textarea');

    const homeSearchInput = document.getElementById('home-search-input');
    const homeSearchBtn = document.getElementById('home-search-btn');
    const homeBtnAddPin = document.getElementById('home-btn-add-pin');

    if (!tabsContainer || !webviewsContainer) return;

    // State
    let tabs = [];
    let activeTabId = null;
    let tabIdCounter = 1;
    let pinnedApps = loadPinnedApps();
    let globalAdBlock = true;
    let globalDarkMode = false;
    let currentUaKey = 'desktop';
    let installedExtensionsList = [];
    let currentMarketFilter = 'all';

    // Apply saved browser theme
    const savedTheme = localStorage.getItem('yt_browser_theme') || 'obsidian';
    applyBrowserTheme(savedTheme);

    // ==========================================================================
    // Brand & Icon Resolver
    // ==========================================================================
    function identifyBrandKey(url) {
        if (!url) return null;
        try {
            const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
            if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
            if (host.includes('google.')) return 'google';
            if (host.includes('openai.com') || host.includes('chatgpt.com')) return 'chatgpt';
            if (host.includes('deepseek.com')) return 'deepseek';
            if (host.includes('github.com')) return 'github';
            if (host.includes('reddit.com')) return 'reddit';
            if (host.includes('wikipedia.org')) return 'wikipedia';
            if (host.includes('spotify.com')) return 'spotify';
            if (host.includes('twitter.com') || host.includes('x.com')) return 'twitter';
            if (host.includes('discord.com')) return 'discord';
            if (host.includes('netflix.com')) return 'netflix';
        } catch {}
        return null;
    }

    function getBrandIconHtml(url, name, isLarge = false) {
        const brandKey = identifyBrandKey(url);
        if (brandKey && BRAND_ICONS[brandKey]) {
            const brand = BRAND_ICONS[brandKey];
            if (isLarge) {
                return `<div class="home-app-icon-wrap" style="background: ${brand.bg};">${brand.svg}</div>`;
            } else {
                return `<div class="tab-favicon-wrap" style="color: ${brand.bg};">${brand.svg}</div>`;
            }
        }

        let favUrl = '';
        try {
            const host = new URL(url).hostname;
            favUrl = `https://www.google.com/s2/favicons?domain=${host}&sz=${isLarge ? 128 : 64}`;
        } catch {}

        if (isLarge) {
            return `
                <div class="home-app-icon-wrap">
                    <img src="${favUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <div style="display:none; width:100%; height:100%; align-items:center; justify-content:center; font-weight:700; font-size:20px; color:#ffffff; background:#3b82f6;">
                        ${(name || 'W').charAt(0).toUpperCase()}
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="tab-favicon-wrap">
                    <img class="tab-favicon" src="${favUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" />
                    <span class="tab-favicon-fallback" style="display:none;">🌐</span>
                </div>
            `;
        }
    }

    // ==========================================================================
    // Theme Studio Engine
    // ==========================================================================
    function applyBrowserTheme(themeKey) {
        if (!browserPanel) return;
        browserPanel.setAttribute('data-browser-theme', themeKey);
        localStorage.setItem('yt_browser_theme', themeKey);
        renderThemesGrid();
    }

    function renderThemesGrid() {
        if (!extThemesGrid) return;
        const current = browserPanel?.getAttribute('data-browser-theme') || 'obsidian';
        extThemesGrid.innerHTML = BROWSER_THEMES.map(theme => {
            const isActive = theme.key === current;
            return `
                <div class="ext-theme-card ${isActive ? 'active' : ''}" data-theme="${theme.key}">
                    <div class="ext-theme-swatch-box">
                        <div class="ext-theme-swatch-p1" style="background: ${theme.swatch[0]};"></div>
                        <div class="ext-theme-swatch-p2" style="background: ${theme.swatch[1]};"></div>
                        <div class="ext-theme-swatch-p3" style="background: ${theme.swatch[2]};"></div>
                    </div>
                    <div>
                        <div class="ext-theme-title-row">
                            <h5 class="ext-theme-name">${theme.name}</h5>
                            <span class="ext-theme-badge">${isActive ? 'Active ✓' : theme.badge}</span>
                        </div>
                        <p class="ext-theme-desc">${theme.desc}</p>
                    </div>
                </div>
            `;
        }).join('');

        extThemesGrid.querySelectorAll('.ext-theme-card').forEach(card => {
            card.addEventListener('click', () => {
                const k = card.getAttribute('data-theme');
                if (k) applyBrowserTheme(k);
            });
        });
    }

    // ==========================================================================
    // Chrome Extension Hub & Marketplace
    // ==========================================================================
    async function loadInstalledExtensions() {
        if (!window.electronAPI || !window.electronAPI.extensionGetInstalled) return;
        try {
            installedExtensionsList = await window.electronAPI.extensionGetInstalled();
            updateExtensionBadges();
            renderInstalledList();
            renderCuratedGrid();
        } catch (e) {
            console.warn('[ExtensionHub] Load error:', e);
        }
    }

    function updateExtensionBadges() {
        const activeCount = installedExtensionsList.filter(e => e.enabled).length;
        if (activeCountBadge) {
            activeCountBadge.textContent = activeCount;
            activeCountBadge.style.display = activeCount > 0 ? 'inline-block' : 'none';
        }
        if (extInstalledPill) {
            extInstalledPill.textContent = installedExtensionsList.length;
        }
    }

    function renderCuratedGrid() {
        if (!extCuratedGrid) return;
        const query = (extMarketSearch?.value || '').toLowerCase().trim();

        const filtered = CURATED_ADDONS_DATA.filter(addon => {
            const matchesCat = currentMarketFilter === 'all' || addon.category === currentMarketFilter;
            const matchesQuery = !query || addon.name.toLowerCase().includes(query) || addon.description.toLowerCase().includes(query);
            return matchesCat && matchesQuery;
        });

        extCuratedGrid.innerHTML = filtered.map(addon => {
            const installed = installedExtensionsList.find(e => e.id === addon.id);
            const isInstalled = !!installed;

            return `
                <div class="ext-addon-card">
                    <div class="ext-card-top">
                        <div class="ext-addon-icon-wrap">
                            ${addon.iconSvg}
                        </div>
                        <div class="ext-card-info">
                            <div class="ext-card-title-row">
                                <h5 class="ext-addon-name">${addon.name}</h5>
                                <span class="ext-addon-badge">${addon.badge}</span>
                            </div>
                            <div class="ext-addon-author">by ${addon.author}</div>
                            <p class="ext-addon-desc">${addon.description}</p>
                        </div>
                    </div>
                    <div class="ext-card-footer">
                        <span class="ext-addon-cat-tag">${addon.category}</span>
                        ${isInstalled 
                            ? `<span class="ext-btn-installed">✓ Installed</span>`
                            : `<button class="ext-btn-install" data-ext-id="${addon.id}">Install Addon</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        extCuratedGrid.querySelectorAll('.ext-btn-install').forEach(btn => {
            btn.addEventListener('click', async () => {
                const extId = btn.getAttribute('data-ext-id');
                if (!extId) return;
                btn.disabled = true;
                btn.textContent = 'Installing...';
                try {
                    const res = await window.electronAPI.extensionInstall(extId);
                    if (res && res.success) {
                        btn.outerHTML = `<span class="ext-btn-installed">✓ Installed</span>`;
                        await loadInstalledExtensions();
                    } else {
                        btn.disabled = false;
                        btn.textContent = 'Install Addon';
                        alert('Install notice: ' + (res?.error || 'Failed'));
                    }
                } catch (err) {
                    btn.disabled = false;
                    btn.textContent = 'Install Addon';
                    alert('Install Error: ' + err.message);
                }
            });
        });
    }

    function renderInstalledList() {
        if (!extInstalledList) return;
        if (!installedExtensionsList.length) {
            extInstalledList.innerHTML = `
                <div style="text-align: center; padding: 48px 20px; color: #64748b;">
                    <div style="font-size: 32px; margin-bottom: 10px;">🧩</div>
                    <div style="font-size: 13.5px; font-weight: 500; color: #94a3b8;">No Extensions Installed Yet</div>
                    <div style="font-size: 12px; margin-top: 4px;">Browse the Addon Store or sideload any Chrome Web Store extension.</div>
                </div>
            `;
            return;
        }

        extInstalledList.innerHTML = installedExtensionsList.map(ext => {
            return `
                <div class="ext-installed-item">
                    <div class="ext-item-left">
                        <div class="ext-item-icon">🧩</div>
                        <div>
                            <div class="ext-item-name-row">
                                <span class="ext-item-name">${ext.name}</span>
                                <span class="ext-item-version">v${ext.version || '1.0'}</span>
                                ${ext.isUnpacked ? `<span class="ext-addon-badge">Local</span>` : ''}
                            </div>
                            <div class="ext-item-desc">${ext.description || 'Chromium extension runtime component'}</div>
                        </div>
                    </div>
                    <div class="ext-item-actions">
                        <button class="ext-icon-btn" data-action="folder" data-id="${ext.id}" title="Open Extension Folder">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        </button>
                        <button class="ext-icon-btn delete" data-action="delete" data-id="${ext.id}" title="Remove Extension">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                        <label class="ext-switch" title="Toggle Extension">
                            <input type="checkbox" data-action="toggle" data-id="${ext.id}" ${ext.enabled ? 'checked' : ''}>
                            <span class="ext-slider"></span>
                        </label>
                    </div>
                </div>
            `;
        }).join('');

        // Action bindings
        extInstalledList.querySelectorAll('[data-action="toggle"]').forEach(input => {
            input.addEventListener('change', async (e) => {
                const id = input.getAttribute('data-id');
                const enabled = e.target.checked;
                await window.electronAPI.extensionToggle(id, enabled);
                await loadInstalledExtensions();
            });
        });

        extInstalledList.querySelectorAll('[data-action="folder"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (id) await window.electronAPI.extensionOpenFolder(id);
            });
        });

        extInstalledList.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (id && confirm('Are you sure you want to remove this extension?')) {
                    await window.electronAPI.extensionRemove(id);
                    await loadInstalledExtensions();
                }
            });
        });
    }

    function openExtensionHub(targetTab = 'ext-view-marketplace') {
        if (!modalExtHub) return;
        modalExtHub.style.display = 'flex';
        switchExtHubTab(targetTab);
        loadInstalledExtensions();
        renderThemesGrid();
    }

    function closeExtensionHub() {
        if (modalExtHub) modalExtHub.style.display = 'none';
    }

    function switchExtHubTab(viewId) {
        extHubTabs.forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-target') === viewId);
        });
        extHubViews.forEach(view => {
            view.classList.toggle('active', view.id === viewId);
        });
    }

    // ==========================================================================
    // URL Normalization & Helpers
    // ==========================================================================
    function parseUrl(input) {
        let trimmed = (input || '').trim();
        if (!trimmed || trimmed === 'about:home' || trimmed === 'home') {
            return 'about:home';
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

    // ==========================================================================
    // Multi-Tab Management Core
    // ==========================================================================
    function createTab(initialUrl = 'about:home', activate = true) {
        const tabId = `tab-${tabIdCounter++}`;
        const finalUrl = parseUrl(initialUrl);
        const isHome = finalUrl === 'about:home';

        // Create Webview
        const webview = document.createElement('webview');
        webview.id = `webview-${tabId}`;
        webview.setAttribute('partition', 'persist:main');
        webview.setAttribute('allowpopups', 'true');
        const isGoogleAuth = finalUrl.includes('accounts.google.com') || finalUrl.includes('accounts.youtube.com') || finalUrl.includes('oauth2.googleapis.com');
        const ua = isGoogleAuth
            ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            : (USER_AGENTS[currentUaKey] || USER_AGENTS.desktop);

        webview.setAttribute('useragent', ua);
        webview.className = 'browser-webview';
        if (!isHome) webview.src = finalUrl;

        webviewsContainer.appendChild(webview);

        const tabData = {
            id: tabId,
            url: isHome ? 'about:home' : finalUrl,
            title: isHome ? 'New Tab' : 'Loading...',
            loading: !isHome,
            canGoBack: false,
            canGoForward: false,
            isAudioMuted: false,
            webviewEl: webview,
            tabEl: null
        };

        // Create Tab Element in Header
        const tabEl = document.createElement('div');
        tabEl.className = 'browser-tab';
        tabEl.id = `header-tab-${tabId}`;
        tabEl.innerHTML = `
            <div class="tab-favicon-container">
                ${getBrandIconHtml(tabData.url, tabData.title)}
            </div>
            <span class="tab-title">${tabData.title}</span>
            <span class="tab-audio-icon" style="display: none;" title="Audio playing — Click to mute">🔊</span>
            <button class="tab-close-btn" title="Close Tab (⌘W / Ctrl+W)">✕</button>
        `;

        tabData.tabEl = tabEl;
        tabsContainer.appendChild(tabEl);
        tabs.push(tabData);

        // Tab Event Listeners
        tabEl.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close-btn')) {
                e.stopPropagation();
                closeTab(tabId);
                return;
            }
            if (e.target.closest('.tab-audio-icon')) {
                e.stopPropagation();
                toggleTabAudio(tabId);
                return;
            }
            switchTab(tabId);
        });

        // Middle-click to close tab
        tabEl.addEventListener('auxclick', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                closeTab(tabId);
            }
        });

        setupWebviewEvents(tabData);

        if (activate) {
            switchTab(tabId);
        }

        tabsContainer.scrollLeft = tabsContainer.scrollWidth;
        return tabData;
    }

    function toggleTabAudio(tabId) {
        const tab = tabs.find(t => t.id === tabId);
        if (tab && tab.webviewEl && tab.webviewEl.setAudioMuted) {
            tab.isAudioMuted = !tab.isAudioMuted;
            tab.webviewEl.setAudioMuted(tab.isAudioMuted);
            const audioIcon = tab.tabEl?.querySelector('.tab-audio-icon');
            if (audioIcon) {
                audioIcon.textContent = tab.isAudioMuted ? '🔇' : '🔊';
                audioIcon.title = tab.isAudioMuted ? 'Muted — Click to unmute' : 'Audio playing — Click to mute';
            }
        }
    }

    function switchTab(tabId) {
        if (!tabId) return;
        activeTabId = tabId;

        tabs.forEach(t => {
            const isActive = t.id === tabId;
            t.tabEl?.classList.toggle('active', isActive);
            if (t.webviewEl) {
                t.webviewEl.classList.toggle('active', isActive);
            }
        });

        const activeTab = tabs.find(t => t.id === tabId);
        if (!activeTab) return;

        if (activeTab.url === 'about:home') {
            homeDashboard.style.display = 'flex';
            if (urlInput) {
                urlInput.value = '';
                urlInput.placeholder = 'Search Google or enter address...';
            }
        } else {
            homeDashboard.style.display = 'none';
            if (urlInput) urlInput.value = activeTab.url;
        }

        updateControlsState();
        activeTab.tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    function closeTab(tabId) {
        const index = tabs.findIndex(t => t.id === tabId);
        if (index === -1) return;

        const [removedTab] = tabs.splice(index, 1);
        removedTab.tabEl?.remove();
        removedTab.webviewEl?.remove();

        if (tabs.length === 0) {
            createTab('about:home', true);
            return;
        }

        if (activeTabId === tabId) {
            const nextTab = tabs[Math.min(index, tabs.length - 1)];
            if (nextTab) switchTab(nextTab.id);
        }
    }

    function setupWebviewEvents(tabData) {
        const wv = tabData.webviewEl;

        wv.addEventListener('did-start-loading', () => {
            tabData.loading = true;
            if (tabData.id === activeTabId) updateControlsState();
        });

        wv.addEventListener('did-stop-loading', () => {
            tabData.loading = false;
            tabData.url = wv.getURL();
            if (tabData.id === activeTabId) {
                if (urlInput && tabData.url !== 'about:home') urlInput.value = tabData.url;
                updateControlsState();
            }
            applyPageInjections(wv);
        });

        wv.addEventListener('page-title-updated', (e) => {
            tabData.title = e.title || 'Untitled';
            if (tabData.tabEl) {
                const titleSpan = tabData.tabEl.querySelector('.tab-title');
                if (titleSpan) titleSpan.textContent = tabData.title;
            }
        });

        wv.addEventListener('page-favicon-updated', () => {
            if (tabData.tabEl) {
                const favBox = tabData.tabEl.querySelector('.tab-favicon-container');
                if (favBox) favBox.innerHTML = getBrandIconHtml(tabData.url, tabData.title);
            }
        });

        wv.addEventListener('media-started-playing', () => {
            const audioIcon = tabData.tabEl?.querySelector('.tab-audio-icon');
            if (audioIcon) audioIcon.style.display = 'inline-block';
        });

        wv.addEventListener('media-paused', () => {
            const audioIcon = tabData.tabEl?.querySelector('.tab-audio-icon');
            if (audioIcon) audioIcon.style.display = 'none';
        });

        wv.addEventListener('new-window', (e) => {
            e.preventDefault();
            if (e.url) createTab(e.url, true);
        });

        // Find-in-page result listener
        wv.addEventListener('found-in-page', (e) => {
            if (findCount && e.result) {
                const active = e.result.activeMatchOrdinal || 0;
                const total = e.result.matches || 0;
                findCount.textContent = `${active} of ${total}`;
            }
        });
    }

    function applyPageInjections(wv) {
        if (!wv) return;
        if (globalAdBlock) {
            wv.insertCSS(ADBLOCK_CSS).catch(()=>{});
        }
        if (globalDarkMode) {
            wv.insertCSS(DARK_READER_CSS).catch(()=>{});
        }
    }

    function navigateActiveTab(inputUrl) {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) return;

        const target = parseUrl(inputUrl);
        activeTab.url = target;

        if (target === 'about:home') {
            homeDashboard.style.display = 'flex';
            if (urlInput) urlInput.value = '';
            if (activeTab.tabEl) {
                const titleSpan = activeTab.tabEl.querySelector('.tab-title');
                if (titleSpan) titleSpan.textContent = 'New Tab';
            }
        } else {
            homeDashboard.style.display = 'none';
            if (urlInput) urlInput.value = target;
            if (activeTab.webviewEl) activeTab.webviewEl.loadURL(target);
        }
        updateControlsState();
    }

    function updateControlsState() {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab || !activeTab.webviewEl) return;

        if (btnBack) btnBack.disabled = !activeTab.webviewEl.canGoBack();
        if (btnForward) btnForward.disabled = !activeTab.webviewEl.canGoForward();
    }

    // ==========================================================================
    // Pinned Apps Bar & Quick Star
    // ==========================================================================
    function loadPinnedApps() {
        try {
            const raw = localStorage.getItem('yt_browser_pinned_apps');
            return raw ? JSON.parse(raw) : DEFAULT_PINNED_APPS;
        } catch {
            return DEFAULT_PINNED_APPS;
        }
    }

    function savePinnedApps() {
        localStorage.setItem('yt_browser_pinned_apps', JSON.stringify(pinnedApps));
    }

    function renderPinnedApps() {
        if (pinnedBar) {
            pinnedBar.innerHTML = pinnedApps.map((app, idx) => `
                <button class="browser-pinned-item" data-index="${idx}" title="${app.name} (${app.url})">
                    <span class="pinned-app-icon">${getBrandIconHtml(app.url, app.name)}</span>
                    <span class="pinned-app-name">${app.name}</span>
                </button>
            `).join('') + `
                <button class="browser-pinned-add-btn" id="btn-add-pinned-bar" title="Pin custom web app">+ Add</button>
            `;

            pinnedBar.querySelectorAll('.browser-pinned-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.getAttribute('data-index'), 10);
                    const app = pinnedApps[idx];
                    if (app) navigateActiveTab(app.url);
                });
            });

            const btnAddBar = document.getElementById('btn-add-pinned-bar');
            if (btnAddBar) btnAddBar.addEventListener('click', () => openPinModal());
        }

        if (homeAppsGrid) {
            homeAppsGrid.innerHTML = pinnedApps.map((app, idx) => `
                <div class="home-app-card" data-index="${idx}" title="${app.name}">
                    <button class="home-app-delete-btn" data-delete-index="${idx}" title="Remove Shortcut">✕</button>
                    ${getBrandIconHtml(app.url, app.name, true)}
                    <span class="home-app-name">${app.name}</span>
                </div>
            `).join('') + `
                <div class="home-app-card add-card" id="home-card-add-pin" title="Add New Shortcut">
                    <div class="home-app-icon-wrap" style="background: rgba(255,255,255,0.05);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                    <span class="home-app-name">Add Shortcut</span>
                </div>
            `;

            homeAppsGrid.querySelectorAll('.home-app-card:not(.add-card)').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.home-app-delete-btn')) {
                        e.stopPropagation();
                        const delIdx = parseInt(e.target.closest('.home-app-delete-btn').getAttribute('data-delete-index'), 10);
                        removePinnedApp(delIdx);
                        return;
                    }
                    const idx = parseInt(card.getAttribute('data-index'), 10);
                    const app = pinnedApps[idx];
                    if (app) navigateActiveTab(app.url);
                });
            });

            const homeAddCard = document.getElementById('home-card-add-pin');
            if (homeAddCard) homeAddCard.addEventListener('click', () => openPinModal());
        }
    }

    function addPinnedApp(name, url) {
        if (!url) return;
        const normalized = parseUrl(url);
        pinnedApps.push({
            name: name || new URL(normalized).hostname.replace('www.', ''),
            url: normalized
        });
        savePinnedApps();
        renderPinnedApps();
    }

    function removePinnedApp(index) {
        pinnedApps.splice(index, 1);
        savePinnedApps();
        renderPinnedApps();
    }

    function togglePinCurrentPage() {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab || activeTab.url === 'about:home') return;

        const existingIdx = pinnedApps.findIndex(a => a.url === activeTab.url);
        if (existingIdx >= 0) {
            removePinnedApp(existingIdx);
            if (btnPinPage) btnPinPage.classList.remove('pinned');
        } else {
            addPinnedApp(activeTab.title || 'Page', activeTab.url);
            if (btnPinPage) btnPinPage.classList.add('pinned');
        }
    }

    function openPinModal(initialUrl = '', initialName = '') {
        if (!pinAppModal) return;
        if (pinNameInput) pinNameInput.value = initialName;
        if (pinUrlInput) pinUrlInput.value = initialUrl;
        pinAppModal.style.display = 'flex';
        if (pinNameInput) pinNameInput.focus();
    }

    function closePinModal() {
        if (pinAppModal) pinAppModal.style.display = 'none';
    }

    // ==========================================================================
    // Quick Tools (Adblock, Darkmode, Reader, PiP, UA, DevTools)
    // ==========================================================================
    function toggleAdBlock(enable) {
        globalAdBlock = enable;
        tabs.forEach(t => {
            if (t.webviewEl && t.url !== 'about:home') {
                if (enable) {
                    t.webviewEl.insertCSS(ADBLOCK_CSS).catch(()=>{});
                } else if (t.webviewEl.reload) {
                    t.webviewEl.reload();
                }
            }
        });
    }

    function toggleDarkMode(enable) {
        globalDarkMode = enable;
        tabs.forEach(t => {
            if (t.webviewEl && t.url !== 'about:home') {
                if (enable) {
                    t.webviewEl.insertCSS(DARK_READER_CSS).catch(()=>{});
                } else if (t.webviewEl.reload) {
                    t.webviewEl.reload();
                }
            }
        });
    }

    function triggerReaderMode() {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.webviewEl && activeTab.url !== 'about:home') {
            const readerCode = `
                (function() {
                    const article = document.querySelector('article') || document.querySelector('main') || document.body;
                    document.body.innerHTML = '<div style="max-width:740px; margin:40px auto; padding:20px; font-family:serif; line-height:1.75; font-size:19px; color:#e0e0e0; background:#181818;">' + article.innerHTML + '</div>';
                    document.body.style.background = '#181818';
                })();
            `;
            activeTab.webviewEl.executeJavaScript(readerCode).catch(()=>{});
        }
        if (extPanel) extPanel.classList.remove('open');
    }

    function triggerVideoPip() {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.webviewEl) {
            const pipCode = `
                (function() {
                    const v = document.querySelector('video');
                    if (v) {
                        if (document.pictureInPictureElement) {
                            document.exitPictureInPicture();
                        } else if (v.requestPictureInPicture) {
                            v.requestPictureInPicture();
                        }
                    } else {
                        alert('No active video found on this page.');
                    }
                })();
            `;
            activeTab.webviewEl.executeJavaScript(pipCode).catch(()=>{});
        }
        if (extPanel) extPanel.classList.remove('open');
    }

    function setUserAgent(uaKey) {
        currentUaKey = uaKey;
        const uaString = USER_AGENTS[uaKey] || USER_AGENTS.desktop;
        
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.webviewEl) {
            activeTab.webviewEl.setUserAgent(uaString);
            if (activeTab.webviewEl.reload) activeTab.webviewEl.reload();
        }
    }

    function openDevToolsForActiveTab() {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.webviewEl) {
            if (activeTab.webviewEl.isDevToolsOpened && activeTab.webviewEl.isDevToolsOpened()) {
                activeTab.webviewEl.closeDevTools();
            } else if (activeTab.webviewEl.openDevTools) {
                activeTab.webviewEl.openDevTools();
            }
        }
        if (extPanel) extPanel.classList.remove('open');
    }

    function clearTabCache() {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.webviewEl && activeTab.webviewEl.reloadIgnoringCache) {
            activeTab.webviewEl.reloadIgnoringCache();
        }
        if (extPanel) extPanel.classList.remove('open');
    }

    // ==========================================================================
    // Find in Page Controller
    // ==========================================================================
    function openFindBar() {
        if (!findBar) return;
        findBar.style.display = 'flex';
        if (findInput) {
            findInput.focus();
            findInput.select();
        }
    }

    function closeFindBar() {
        if (!findBar) return;
        findBar.style.display = 'none';
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.webviewEl && activeTab.webviewEl.stopFindInPage) {
            activeTab.webviewEl.stopFindInPage('clearSelection');
        }
        if (findCount) findCount.textContent = '0 of 0';
    }

    function executeFind(forward = true, findNext = false) {
        const text = findInput?.value || '';
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab || !activeTab.webviewEl || !activeTab.webviewEl.findInPage) return;

        if (!text) {
            activeTab.webviewEl.stopFindInPage('clearSelection');
            if (findCount) findCount.textContent = '0 of 0';
            return;
        }
        activeTab.webviewEl.findInPage(text, { forward, findNext });
    }

    // ==========================================================================
    // Event Listeners & UI Binding
    // ==========================================================================

    // New Tab Button
    if (btnNewTab) {
        btnNewTab.addEventListener('click', () => {
            createTab('about:home', true);
        });
    }

    // Address Bar Navigation
    if (urlInput) {
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                navigateActiveTab(urlInput.value);
            }
        });
        urlInput.addEventListener('focus', () => urlInput.select());
    }

    if (btnGo) {
        btnGo.addEventListener('click', () => {
            navigateActiveTab(urlInput.value);
        });
    }

    // Nav Buttons
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (activeTab && activeTab.webviewEl && activeTab.webviewEl.canGoBack()) {
                activeTab.webviewEl.goBack();
            }
        });
    }

    if (btnForward) {
        btnForward.addEventListener('click', () => {
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (activeTab && activeTab.webviewEl && activeTab.webviewEl.canGoForward()) {
                activeTab.webviewEl.goForward();
            }
        });
    }

    if (btnReload) {
        btnReload.addEventListener('click', () => {
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (activeTab && activeTab.webviewEl && activeTab.webviewEl.reload) {
                activeTab.webviewEl.reload();
            }
        });
    }

    if (btnHome) {
        btnHome.addEventListener('click', () => {
            navigateActiveTab('about:home');
        });
    }

    // Fullscreen Toggle
    function toggleBrowserFullscreen() {
        if (!browserPanel) return;
        if (!document.fullscreenElement) {
            if (browserPanel.requestFullscreen) browserPanel.requestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }

    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', toggleBrowserFullscreen);
    }

    document.addEventListener('fullscreenchange', () => {
        if (browserPanel) {
            if (document.fullscreenElement === browserPanel) {
                browserPanel.classList.add('in-fullscreen');
            } else {
                browserPanel.classList.remove('in-fullscreen');
            }
        }
    });

    // Pin Star Button in Omnibar
    if (btnPinPage) {
        btnPinPage.addEventListener('click', togglePinCurrentPage);
    }

    // Copy URL Button with visual feedback
    if (btnCopyUrl) {
        btnCopyUrl.addEventListener('click', async () => {
            const activeTab = tabs.find(t => t.id === activeTabId);
            const textToCopy = (activeTab && activeTab.url) ? activeTab.url : (urlInput.value || '');
            if (textToCopy) {
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    const origTitle = btnCopyUrl.title;
                    btnCopyUrl.title = '✓ Copied!';
                    btnCopyUrl.style.color = '#34d399';
                    setTimeout(() => {
                        btnCopyUrl.title = origTitle;
                        btnCopyUrl.style.color = '';
                    }, 1600);
                } catch (e) {
                    console.error('Copy failed:', e);
                }
            }
        });
    }

    // Theme Studio Button
    if (btnThemeStudio) {
        btnThemeStudio.addEventListener('click', () => {
            openExtensionHub('ext-view-themes');
        });
    }

    // Extension Hub Button
    if (btnExtHub) {
        btnExtHub.addEventListener('click', () => {
            openExtensionHub('ext-view-marketplace');
        });
    }

    // Quick Extensions Popover Toggle
    if (btnExtensions && extPanel) {
        btnExtensions.addEventListener('click', (e) => {
            e.stopPropagation();
            extPanel.classList.toggle('open');
        });
    }

    if (extCloseBtn && extPanel) {
        extCloseBtn.addEventListener('click', () => {
            extPanel.classList.remove('open');
        });
    }

    document.addEventListener('click', (e) => {
        if (extPanel && extPanel.classList.contains('open')) {
            if (!extPanel.contains(e.target) && !btnExtensions.contains(e.target)) {
                extPanel.classList.remove('open');
            }
        }
    });

    // Quick Tool Controls
    if (extToggleAdblock) extToggleAdblock.addEventListener('change', (e) => toggleAdBlock(e.target.checked));
    if (extToggleDarkmode) extToggleDarkmode.addEventListener('change', (e) => toggleDarkMode(e.target.checked));
    if (extBtnReader) extBtnReader.addEventListener('click', triggerReaderMode);
    if (extBtnPip) extBtnPip.addEventListener('click', triggerVideoPip);
    if (extUaSelect) extUaSelect.addEventListener('change', (e) => setUserAgent(e.target.value));
    if (extBtnDevtools) extBtnDevtools.addEventListener('click', openDevToolsForActiveTab);
    if (extBtnClearCache) extBtnClearCache.addEventListener('click', clearTabCache);
    if (extBtnHardReload) extBtnHardReload.addEventListener('click', clearTabCache);

    if (extBtnInjectJs) {
        extBtnInjectJs.addEventListener('click', () => {
            if (extPanel) extPanel.classList.remove('open');
            if (scriptModal) scriptModal.style.display = 'flex';
        });
    }

    // Custom Script Modal
    if (btnCloseScriptModal) btnCloseScriptModal.addEventListener('click', () => scriptModal.style.display = 'none');
    if (btnScriptCancel) btnScriptCancel.addEventListener('click', () => scriptModal.style.display = 'none');
    if (btnScriptRun) {
        btnScriptRun.addEventListener('click', () => {
            const code = scriptTextarea ? scriptTextarea.value : '';
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (activeTab && activeTab.webviewEl && code) {
                activeTab.webviewEl.executeJavaScript(code).then(() => {
                    if (scriptModal) scriptModal.style.display = 'none';
                }).catch(err => alert('Script Error: ' + err.message));
            }
        });
    }

    // Extension Hub Modal Bindings
    if (btnCloseExtHub) btnCloseExtHub.addEventListener('click', closeExtensionHub);
    if (btnExtHubDone) btnExtHubDone.addEventListener('click', closeExtensionHub);

    extHubTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-target');
            if (target) switchExtHubTab(target);
        });
    });

    if (extMarketSearch) {
        extMarketSearch.addEventListener('input', () => renderCuratedGrid());
    }

    extCatPills.forEach(pill => {
        pill.addEventListener('click', () => {
            extCatPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentMarketFilter = pill.getAttribute('data-cat') || 'all';
            renderCuratedGrid();
        });
    });

    if (extSideloadBtn) {
        extSideloadBtn.addEventListener('click', async () => {
            const val = extSideloadInput?.value || '';
            if (!val.trim()) return;

            if (extSideloadStatus) {
                extSideloadStatus.style.display = 'block';
                extSideloadStatus.className = 'ext-sideload-status loading';
                extSideloadStatus.textContent = '⏳ Downloading CRX & Unpacking Extension...';
            }

            extSideloadBtn.disabled = true;

            try {
                const res = await window.electronAPI.extensionInstall(val.trim());
                if (res && res.success) {
                    if (extSideloadStatus) {
                        extSideloadStatus.className = 'ext-sideload-status success';
                        extSideloadStatus.textContent = `✓ Successfully installed & activated: ${res.extension.name} (v${res.extension.version})`;
                    }
                    if (extSideloadInput) extSideloadInput.value = '';
                    await loadInstalledExtensions();
                } else {
                    if (extSideloadStatus) {
                        extSideloadStatus.className = 'ext-sideload-status error';
                        extSideloadStatus.textContent = `✕ Install Failed: ${res?.error || 'Unknown error'}`;
                    }
                }
            } catch (err) {
                if (extSideloadStatus) {
                    extSideloadStatus.className = 'ext-sideload-status error';
                    extSideloadStatus.textContent = `✕ Error: ${err.message}`;
                }
            } finally {
                extSideloadBtn.disabled = false;
            }
        });
    }

    const handleUnpackClick = async () => {
        try {
            const res = await window.electronAPI.extensionInstallUnpacked();
            if (res && res.success) {
                alert(`✓ Loaded unpacked extension: ${res.extension.name}`);
                await loadInstalledExtensions();
                switchExtHubTab('ext-view-installed');
            } else if (res && res.error) {
                alert('Unpacked Load Notice: ' + res.error);
            }
        } catch (err) {
            alert('Load Unpacked Error: ' + err.message);
        }
    };

    if (extBtnSideloadFolder) extBtnSideloadFolder.addEventListener('click', handleUnpackClick);
    if (extBtnQuickUnpack) extBtnQuickUnpack.addEventListener('click', handleUnpackClick);

    // Find in Page Bindings
    if (findInput) {
        findInput.addEventListener('input', () => executeFind(true, false));
        findInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeFind(!e.shiftKey, true);
            } else if (e.key === 'Escape') {
                closeFindBar();
            }
        });
    }

    if (findPrev) findPrev.addEventListener('click', () => executeFind(false, true));
    if (findNext) findNext.addEventListener('click', () => executeFind(true, true));
    if (findClose) findClose.addEventListener('click', closeFindBar);

    // Pin App Modal
    if (btnClosePinModal) btnClosePinModal.addEventListener('click', closePinModal);
    if (btnPinCancel) btnPinCancel.addEventListener('click', closePinModal);
    if (btnPinSave) {
        btnPinSave.addEventListener('click', () => {
            const name = pinNameInput ? pinNameInput.value : '';
            const url = pinUrlInput ? pinUrlInput.value : '';
            if (url) {
                addPinnedApp(name, url);
                closePinModal();
            }
        });
    }

    // Home Dashboard Search Bar
    if (homeSearchInput) {
        homeSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                navigateActiveTab(homeSearchInput.value);
            }
        });
    }
    if (homeSearchBtn) {
        homeSearchBtn.addEventListener('click', () => {
            if (homeSearchInput) navigateActiveTab(homeSearchInput.value);
        });
    }
    if (homeBtnAddPin) {
        homeBtnAddPin.addEventListener('click', () => openPinModal());
    }

    // Global Keyboard Shortcuts for Browser
    document.addEventListener('keydown', (e) => {
        if (!browserPanel || !browserPanel.classList.contains('active')) return;

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

        // Cmd/Ctrl + T: New Tab
        if (cmdOrCtrl && (e.key === 't' || e.key === 'T')) {
            e.preventDefault();
            createTab('about:home', true);
        }

        // Cmd/Ctrl + W: Close Active Tab
        if (cmdOrCtrl && (e.key === 'w' || e.key === 'W')) {
            e.preventDefault();
            if (activeTabId) closeTab(activeTabId);
        }

        // Cmd/Ctrl + L: Focus Address Bar
        if (cmdOrCtrl && (e.key === 'l' || e.key === 'L')) {
            e.preventDefault();
            if (urlInput) urlInput.focus();
        }

        // Cmd/Ctrl + F: Find in Page
        if (cmdOrCtrl && (e.key === 'f' || e.key === 'F')) {
            e.preventDefault();
            openFindBar();
        }

        // Cmd/Ctrl + D: Pin / Bookmark Current Page
        if (cmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            togglePinCurrentPage();
        }

        // Cmd/Ctrl + R: Reload
        if (cmdOrCtrl && (e.key === 'r' || e.key === 'R')) {
            e.preventDefault();
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (activeTab && activeTab.webviewEl && activeTab.webviewEl.reload) {
                activeTab.webviewEl.reload();
            }
        }

        // Cmd/Ctrl + 1..8: Switch Tab
        if (cmdOrCtrl && e.key >= '1' && e.key <= '8') {
            const index = parseInt(e.key, 10) - 1;
            if (tabs[index]) {
                e.preventDefault();
                switchTab(tabs[index].id);
            }
        }

        // F11: Fullscreen
        if (e.key === 'F11') {
            e.preventDefault();
            toggleBrowserFullscreen();
        }

        // Esc: Close Modals / Find bar
        if (e.key === 'Escape') {
            if (findBar && findBar.style.display !== 'none') closeFindBar();
            if (modalExtHub && modalExtHub.style.display !== 'none') closeExtensionHub();
        }
    });

    // Initial Setup
    renderPinnedApps();
    createTab('about:home', true);
    loadInstalledExtensions();
}
