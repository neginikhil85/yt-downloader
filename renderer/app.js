// ==========================================================================
// YT Studio Pro — Main Application Bootstrap (ES Module)
// ==========================================================================

import { state, initSettings } from './modules/state.js';
import { initNavigation } from './modules/navigation.js';
import { initSearchFeed, initFeedDownloadPicker, performSearch } from './modules/searchFeed.js';
import { initVideoPlayer } from './modules/videoPlayer.js';
import { initDownloadManager } from './modules/downloadManager.js';
import { initLibraryManager } from './modules/libraryManager.js';
import { initOnboardingModal } from './modules/onboardingModal.js';
import { initSettingsModal } from './modules/settingsModal.js';
import { initBrowserManager } from './modules/browser/index.js';
import { initP2PShareManager } from './modules/p2pShareManager.js';

window.addEventListener('error', (e) => {
    console.error('[Window Error]:', e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[Unhandled Rejection]:', e.reason);
});

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Platform styling class
    const platform = window.electronAPI?.platform || 'darwin';
    document.body.classList.add(`platform-${platform}`);

    // 1. Initialize State & Settings
    await initSettings();

    // 2. Initialize Controllers
    initNavigation();
    initSearchFeed();
    initFeedDownloadPicker();
    initVideoPlayer();
    initDownloadManager();
    initLibraryManager();
    initBrowserManager();
    initP2PShareManager();
    initSettingsModal();
    initOnboardingModal();

    // 3. Auto-load Explore Trending Feed if onboarding is already completed
    if (state.userSettings.onboardingCompleted) {
        performSearch('trending');
    }
});
