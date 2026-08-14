// ==========================================================================
// YT Studio Pro — Main Application Bootstrap (ES Module)
// ==========================================================================

import { state, initSettings } from './modules/state.js';
import { initNavigation } from './modules/navigation.js';
import { initSearchFeed, performSearch } from './modules/searchFeed.js';
import { initVideoPlayer } from './modules/videoPlayer.js';
import { initDownloadManager } from './modules/downloadManager.js';
import { initLibraryManager } from './modules/libraryManager.js';
import { initOnboardingModal } from './modules/onboardingModal.js';
import { initSettingsModal } from './modules/settingsModal.js';
import { initBrowserManager } from './modules/browserManager.js';
import { initP2PShareManager } from './modules/p2pShareManager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize State & Settings
    await initSettings();

    // 2. Initialize Controllers
    initNavigation();
    initSearchFeed();
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
