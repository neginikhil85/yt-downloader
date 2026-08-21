import { escapeHtml } from './utils.js';
import { state } from './state.js';
import { switchView } from './navigation.js';
import { streamVideo } from './videoPlayer.js';
import { startDownloadTask } from './downloadManager.js';

let currentQuery = '';
let currentPage = 1;
let isLoadingMore = false;
let hasMoreVideos = true;
let totalVideosLoaded = 0;

export function initSearchFeed() {
    const searchInput = document.getElementById('search-input');
    const btnSearchSubmit = document.getElementById('btn-search-submit');
    const btnClearSearch = document.getElementById('btn-clear-search');
    const topicChips = document.querySelectorAll('.chip');
    const explorePanel = document.getElementById('view-explore');
    const scrollSentinel = document.getElementById('scroll-sentinel');

    topicChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            topicChips.forEach((c) => c.classList.remove('active'));
            chip.classList.add('active');
            const topic = chip.dataset.topic;
            performSearch(topic === 'all' ? 'trending' : topic);
        });
    });

    btnSearchSubmit.addEventListener('click', () => {
        performSearch(searchInput.value);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            performSearch(searchInput.value);
        }
    });

    searchInput.addEventListener('input', () => {
        btnClearSearch.style.display = searchInput.value ? 'block' : 'none';
    });

    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        btnClearSearch.style.display = 'none';
        searchInput.focus();
    });

    // 1. Scroll listener on view-explore panel
    explorePanel.addEventListener('scroll', () => {
        if (explorePanel.scrollTop + explorePanel.clientHeight >= explorePanel.scrollHeight - 350) {
            loadNextPage();
        }
    });

    // 2. IntersectionObserver on scroll-sentinel for instant trigger
    if ('IntersectionObserver' in window && scrollSentinel) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                loadNextPage();
            }
        }, { root: explorePanel, rootMargin: '300px' });
        observer.observe(scrollSentinel);
    }
}

/**
 * Renders modern animated shimmer skeleton cards while fetching from YouTube
 */
export function renderSkeletons(count = 8) {
    const videoGrid = document.getElementById('video-grid');
    if (!videoGrid) return;
    videoGrid.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-card';
        skeleton.innerHTML = `
            <div class="skeleton-thumb"></div>
            <div class="skeleton-details">
                <div class="skeleton-row">
                    <div class="skeleton-avatar"></div>
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                        <div class="skeleton-line w-full"></div>
                        <div class="skeleton-line w-80"></div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 4px;">
                    <div class="skeleton-line w-40"></div>
                    <div class="skeleton-line w-60" style="width: 30%;"></div>
                </div>
            </div>
        `;
        videoGrid.appendChild(skeleton);
    }
}

export async function performSearch(query) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    currentQuery = cleanQuery;
    currentPage = 1;
    hasMoreVideos = true;
    isLoadingMore = true; // Lock pagination until initial search finishes
    totalVideosLoaded = 0;

    const exploreTitle = document.getElementById('explore-title');
    const exploreSubtitle = document.getElementById('explore-subtitle');
    const videoGrid = document.getElementById('video-grid');
    const exploreLoading = document.getElementById('explore-loading');
    const infiniteLoading = document.getElementById('infinite-loading');

    switchView('explore');
    exploreTitle.textContent = `Results for "${cleanQuery}"`;
    exploreSubtitle.textContent = 'Searching YouTube...';
    if (exploreLoading) exploreLoading.style.display = 'none';
    if (infiniteLoading) infiniteLoading.style.display = 'none';

    // Render Shimmer Skeleton Grid immediately
    renderSkeletons(8);

    try {
        const response = await window.electronAPI.searchYouTube(cleanQuery, 1);

        if (!response.success || !response.results || response.results.length === 0) {
            exploreSubtitle.textContent = 'No videos found. Try different search terms.';
            videoGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <svg class="empty-svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <h3>No Results Found</h3>
                    <p>Try searching with different keywords</p>
                </div>`;
            return;
        }

        totalVideosLoaded = response.results.length;
        hasMoreVideos = response.hasMore !== false;
        exploreSubtitle.textContent = `Showing ${totalVideosLoaded} videos (scroll down for more)`;
        renderVideoCards(response.results, false);
    } catch (err) {
        exploreSubtitle.textContent = 'Error connecting to YouTube engine.';
        videoGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <svg class="empty-svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <h3>Connection Error</h3>
                <p>Failed to retrieve video feed. Please try again.</p>
            </div>`;
        console.error('Search failed:', err);
    } finally {
        isLoadingMore = false;
    }
}

async function loadNextPage() {
    if (isLoadingMore || !hasMoreVideos || !currentQuery) return;

    isLoadingMore = true;
    const infiniteLoading = document.getElementById('infinite-loading');
    const exploreSubtitle = document.getElementById('explore-subtitle');
    if (infiniteLoading) infiniteLoading.style.display = 'flex';

    const nextPage = currentPage + 1;

    try {
        const response = await window.electronAPI.searchYouTube(currentQuery, nextPage);
        if (infiniteLoading) infiniteLoading.style.display = 'none';

        if (response.success && response.results && response.results.length > 0) {
            currentPage = nextPage;
            totalVideosLoaded += response.results.length;
            hasMoreVideos = response.hasMore !== false;
            exploreSubtitle.textContent = `Showing ${totalVideosLoaded} videos for "${currentQuery}"`;
            renderVideoCards(response.results, true);
        } else {
            hasMoreVideos = false;
        }
    } catch (err) {
        if (infiniteLoading) infiniteLoading.style.display = 'none';
        console.error('Failed to load next page:', err);
    } finally {
        isLoadingMore = false;
    }
}

export function renderVideoCards(videos, append = false) {
    const videoGrid = document.getElementById('video-grid');
    if (!append) {
        videoGrid.innerHTML = '';
    }

    videos.forEach((video) => {
        const card = document.createElement('div');
        card.className = 'video-card';

        const thumbUrl = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

        card.innerHTML = `
            <div class="thumb-box">
                <img class="thumb-img" src="${thumbUrl}" alt="${escapeHtml(video.title)}" loading="lazy" />
                <span class="duration-badge">${video.durationStr}</span>
            </div>
            <div class="card-details">
                <h3 class="card-title" title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</h3>
                <div class="card-channel">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>${escapeHtml(video.uploader)}</span>
                </div>
                <div class="card-meta">${video.views}</div>
                <div class="card-actions">
                    <button class="btn-card-stream" data-url="${video.url}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        Stream
                    </button>
                    <button class="btn-card-download" data-url="${video.url}" title="Download">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Download
                    </button>
                </div>
            </div>
        `;

        const streamBtn = card.querySelector('.btn-card-stream');
        const dlBtn = card.querySelector('.btn-card-download');
        const thumbBox = card.querySelector('.thumb-box');
        const cardTitle = card.querySelector('.card-title');

        const triggerStream = () => streamVideo(video);
        if (streamBtn) streamBtn.addEventListener('click', triggerStream);
        if (thumbBox) thumbBox.addEventListener('click', triggerStream);
        if (cardTitle) cardTitle.addEventListener('click', triggerStream);

        if (dlBtn) {
            dlBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openFeedDownloadPicker(video);
            });
        }

        videoGrid.appendChild(card);
    });
}

// ======================================================================
// Feed Download Resolution Picker Modal
// ======================================================================

let feedDlPickerState = { videoUrl: '', videoTitle: '', selectedQuality: '' };

export function initFeedDownloadPicker() {
    const modal = document.getElementById('feed-dl-picker-modal');
    const btnClose = document.getElementById('btn-close-feed-dl-picker');
    const btnCancel = document.getElementById('btn-feed-dl-picker-cancel');
    const btnStart = document.getElementById('btn-feed-dl-picker-start');

    if (!modal) return;

    const closeModal = () => { modal.style.display = 'none'; };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    // Click overlay to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (btnStart) {
        btnStart.addEventListener('click', () => {
            if (!feedDlPickerState.selectedQuality || !feedDlPickerState.videoUrl) return;
            closeModal();
            startDownloadTask(feedDlPickerState.videoUrl, feedDlPickerState.videoTitle, feedDlPickerState.selectedQuality);
        });
    }
}

async function openFeedDownloadPicker(video) {
    const modal = document.getElementById('feed-dl-picker-modal');
    const titleEl = document.getElementById('feed-dl-picker-video-title');
    const loadingEl = document.getElementById('feed-dl-picker-loading');
    const optionsEl = document.getElementById('feed-dl-picker-options');
    const btnStart = document.getElementById('btn-feed-dl-picker-start');

    if (!modal) return;

    // Reset state
    feedDlPickerState = { videoUrl: video.url, videoTitle: video.title, selectedQuality: '' };
    if (titleEl) titleEl.textContent = video.title;
    if (loadingEl) loadingEl.style.display = 'flex';
    if (optionsEl) { optionsEl.style.display = 'none'; optionsEl.innerHTML = ''; }
    if (btnStart) { btnStart.disabled = true; }

    modal.style.display = 'flex';

    // Fetch available formats
    try {
        const res = await window.electronAPI.getVideoFormats(video.url);
        if (loadingEl) loadingEl.style.display = 'none';

        if (res && res.resolutions && res.resolutions.length > 0) {
            renderPickerOptions(res.resolutions);
        } else {
            // Fallback: offer standard preset options
            renderPickerOptions([
                { height: 1080, quality: '1080p', label: '1080p Full HD', sizeStr: '' },
                { height: 720, quality: '720p', label: '720p HD', sizeStr: '' },
                { height: 480, quality: '480p', label: '480p SD', sizeStr: '' },
                { height: 360, quality: '360p', label: '360p', sizeStr: '' },
                { height: 0, quality: 'MP3', label: 'Audio MP3', sizeStr: '' }
            ]);
        }
    } catch (err) {
        if (loadingEl) loadingEl.style.display = 'none';
        console.warn('Format fetch notice:', err);
        // Fallback presets on error
        renderPickerOptions([
            { height: 1080, quality: '1080p', label: '1080p Full HD', sizeStr: '' },
            { height: 720, quality: '720p', label: '720p HD', sizeStr: '' },
            { height: 480, quality: '480p', label: '480p SD', sizeStr: '' },
            { height: 360, quality: '360p', label: '360p', sizeStr: '' },
            { height: 0, quality: 'MP3', label: 'Audio MP3', sizeStr: '' }
        ]);
    }
}

function renderPickerOptions(resolutions) {
    const optionsEl = document.getElementById('feed-dl-picker-options');
    const btnStart = document.getElementById('btn-feed-dl-picker-start');
    if (!optionsEl) return;

    optionsEl.innerHTML = '';
    optionsEl.style.display = 'flex';

    // Default selection = highest available quality (first video resolution, which is sorted descending)
    const topVideoRes = resolutions.find(r => r.height > 0);
    const defaultQuality = topVideoRes ? topVideoRes.quality : resolutions[0]?.quality || '1080p';

    resolutions.forEach((r) => {
        const btn = document.createElement('button');
        btn.className = 'feed-dl-option';
        btn.type = 'button';

        const sizeLabel = r.sizeStr ? r.sizeStr : '';
        btn.innerHTML = `
            <span class="feed-dl-radio"></span>
            <span class="feed-dl-label">${r.label}</span>
            ${sizeLabel ? `<span class="feed-dl-size">${sizeLabel}</span>` : ''}
        `;

        // Pre-select the highest quality (default)
        if (r.quality === defaultQuality) {
            btn.classList.add('selected');
            feedDlPickerState.selectedQuality = r.quality;
            if (btnStart) btnStart.disabled = false;
        }

        btn.addEventListener('click', () => {
            // Deselect all, select this
            optionsEl.querySelectorAll('.feed-dl-option').forEach(o => o.classList.remove('selected'));
            btn.classList.add('selected');
            feedDlPickerState.selectedQuality = r.quality;
            if (btnStart) btnStart.disabled = false;
        });

        optionsEl.appendChild(btn);
    });
}
