import { escapeHtml } from './utils.js';
import { state } from './state.js';
import { playLocalVideo } from './videoPlayer.js';

export function initLibraryManager() {
    // Initializer
}

export async function loadLibraryFiles() {
    const libraryGrid = document.getElementById('library-grid');
    const libraryCountText = document.getElementById('library-count-text');
    libraryGrid.innerHTML = '';

    const files = await window.electronAPI.getLibraryFiles(state.userSettings.savePath);

    if (!files || files.length === 0) {
        libraryCountText.textContent = 'No saved files found in ' + state.userSettings.savePath;
        libraryGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <svg class="empty-svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                <h3>Your Library is Empty</h3>
                <p>Downloaded videos will automatically appear here</p>
            </div>`;
        return;
    }

    libraryCountText.textContent = `${files.length} media files saved`;

    files.forEach((f) => {
        const card = document.createElement('div');
        card.className = 'library-card';
        card.innerHTML = `
            <div class="lib-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <span class="lib-card-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
            <div class="lib-card-meta">
                <span>${f.size}</span>
                <span>${f.ext}</span>
                <span>${f.date}</span>
            </div>
            <div class="card-actions" style="margin-top: 8px;">
                <button class="btn-card-stream btn-play-local" style="padding: 5px 8px; font-size: 11px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    Play Video
                </button>
                <button class="btn-open-folder btn-finder-action" style="padding: 5px 8px; font-size: 11px;">${navigator.userAgent.includes('Mac') ? 'Reveal in Finder' : 'Show in Folder'}</button>
            </div>
        `;

        card.querySelector('.btn-play-local').addEventListener('click', () => {
            playLocalVideo(f);
        });

        card.querySelector('.btn-finder-action').addEventListener('click', () => {
            window.electronAPI.openInFinder(f.fullPath);
        });

        libraryGrid.appendChild(card);
    });
}
