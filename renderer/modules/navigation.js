import { loadLibraryFiles } from './libraryManager.js';
import { stopVideoPlayer } from './videoPlayer.js';

let currentView = 'explore';
let previousView = 'explore';

export function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const btnBackPlayer = document.getElementById('btn-back-player');

    navItems.forEach((item) => {
        item.addEventListener('click', () => {
            switchView(item.dataset.view);
        });
    });

    if (btnBackPlayer) {
        btnBackPlayer.addEventListener('click', () => {
            goBack();
        });
    }
}

export function switchView(viewName) {
    if (viewName !== currentView) {
        if (currentView !== 'player') {
            previousView = currentView;
        } else if (viewName !== 'player') {
            stopVideoPlayer();
        }
        currentView = viewName;
    }

    const navItems = document.querySelectorAll('.nav-item');
    const viewPanels = document.querySelectorAll('.view-panel');

    navItems.forEach((item) => {
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    viewPanels.forEach((panel) => {
        if (panel.id === `view-${viewName}`) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });

    // Update Back button text based on where the user came from
    const btnBackLabel = document.getElementById('btn-back-label');
    if (btnBackLabel) {
        const labels = {
            explore: 'Back to Feed',
            library: 'Back to Library',
            downloads: 'Back to Downloads',
            browser: 'Back to Research Browser',
            share: 'Back to Direct Share'
        };
        btnBackLabel.textContent = labels[previousView] || 'Back';
    }

    // Hide YouTube Search bar & Topic chips when in Research Browser or Direct Share view
    const topbar = document.querySelector('.topbar');
    const topicChips = document.getElementById('topic-chips');

    if (viewName === 'browser' || viewName === 'share') {
        if (topbar) topbar.style.display = (viewName === 'share') ? 'flex' : 'none';
        if (topicChips) topicChips.style.display = 'none';
    } else {
        if (topbar) topbar.style.display = 'flex';
        if (topicChips) topicChips.style.display = (viewName === 'explore') ? 'flex' : 'none';
    }

    if (viewName === 'library') {
        loadLibraryFiles();
    }
}

export function goBack() {
    switchView(previousView || 'explore');
}

