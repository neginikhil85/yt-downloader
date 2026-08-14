import { formatTime } from './utils.js';
import { state } from './state.js';
import { switchView } from './navigation.js';
import { startDownloadTask } from './downloadManager.js';

export function initVideoPlayer() {
    const videoEl = document.getElementById('cinema-video');
    const btnPlayPause = document.getElementById('btn-play-pause');
    const btnRewind10 = document.getElementById('btn-rewind-10');
    const btnForward10 = document.getElementById('btn-forward-10');
    const timelineSlider = document.getElementById('timeline-slider');
    const currentTimeEl = document.getElementById('current-time');
    const totalDurationEl = document.getElementById('total-duration');
    const volumeSlider = document.getElementById('volume-slider');
    const btnMute = document.getElementById('btn-mute');
    const speedSelector = document.getElementById('speed-selector');
    const btnPip = document.getElementById('btn-pip');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const dlPresets = document.querySelectorAll('.btn-dl-preset');
    const screenWrapper = document.getElementById('video-screen-wrapper');

    const togglePlayPause = () => {
        if (videoEl.paused) {
            videoEl.play().catch((err) => console.error('Play error:', err));
        } else {
            videoEl.pause();
        }
    };

    videoEl.addEventListener('play', () => {
        btnPlayPause.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    });

    videoEl.addEventListener('pause', () => {
        btnPlayPause.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    });

    videoEl.addEventListener('ended', () => {
        btnPlayPause.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    });

    btnPlayPause.addEventListener('click', togglePlayPause);

    if (btnRewind10) {
        btnRewind10.addEventListener('click', () => seekVideo(-10));
    }
    if (btnForward10) {
        btnForward10.addEventListener('click', () => seekVideo(10));
    }

    // Double click & click gestures on screen wrapper
    let clickTimer = null;
    screenWrapper.addEventListener('click', (e) => {
        if (e.target.closest('#player-controls') || e.target.closest('#cinema-iframe')) return;

        if (clickTimer === null) {
            clickTimer = setTimeout(() => {
                clickTimer = null;
                togglePlayPause();
            }, 250);
        } else {
            clearTimeout(clickTimer);
            clickTimer = null;
            const rect = screenWrapper.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX > rect.width / 2) {
                seekVideo(10);
            } else {
                seekVideo(-10);
            }
        }
    });

    // Global keyboard shortcuts for video player
    document.addEventListener('keydown', (e) => {
        const playerView = document.getElementById('view-player');
        if (!playerView || !playerView.classList.contains('active')) return;

        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            seekVideo(10);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            seekVideo(-10);
        } else if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
            e.preventDefault();
            togglePlayPause();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            changeVolume(0.1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            changeVolume(-0.1);
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleFullscreen();
        }
    });

    function changeVolume(delta) {
        let newVol = Math.max(0, Math.min(1, videoEl.volume + delta));
        videoEl.volume = newVol;
        volumeSlider.value = newVol;
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            screenWrapper.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    videoEl.addEventListener('timeupdate', () => {
        if (videoEl.duration) {
            const pct = (videoEl.currentTime / videoEl.duration) * 100;
            timelineSlider.value = pct;
            currentTimeEl.textContent = formatTime(videoEl.currentTime);
            totalDurationEl.textContent = formatTime(videoEl.duration);
        }
    });

    timelineSlider.addEventListener('input', () => {
        if (videoEl.duration) {
            videoEl.currentTime = (timelineSlider.value / 100) * videoEl.duration;
        }
    });

    volumeSlider.addEventListener('input', () => {
        videoEl.volume = parseFloat(volumeSlider.value);
    });

    btnMute.addEventListener('click', () => {
        videoEl.muted = !videoEl.muted;
    });

    speedSelector.addEventListener('change', () => {
        videoEl.playbackRate = parseFloat(speedSelector.value);
    });

    btnPip.addEventListener('click', async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (document.pictureInPictureEnabled) {
                await videoEl.requestPictureInPicture();
            }
        } catch (e) {
            console.error(e);
        }
    });

    btnFullscreen.addEventListener('click', toggleFullscreen);

    dlPresets.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (!state.currentVideoData) return;
            startDownloadTask(state.currentVideoData.url, state.currentVideoData.title, btn.dataset.format);
        });
    });
}

export function seekVideo(deltaSeconds) {
    const videoEl = document.getElementById('cinema-video');
    if (!videoEl || !videoEl.duration) return;

    let targetTime = videoEl.currentTime + deltaSeconds;
    if (targetTime < 0) targetTime = 0;
    if (targetTime > videoEl.duration) targetTime = videoEl.duration;

    videoEl.currentTime = targetTime;
    showSeekToast(deltaSeconds > 0 ? `+${deltaSeconds}s ⏩` : `${deltaSeconds}s ⏪`);
}

let toastTimeout = null;
function showSeekToast(message) {
    const toast = document.getElementById('seek-toast');
    const toastText = document.getElementById('seek-toast-text');
    if (!toast || !toastText) return;

    toastText.textContent = message;
    toast.style.display = 'flex';

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.display = 'none';
    }, 700);
}

/**
 * Streams YouTube Video live inside our native Cinema Player (No Error 153 / No Embed restrictions)
 */
export async function streamVideo(video) {
    state.currentVideoData = video;
    switchView('player');

    const iframeEl = document.getElementById('cinema-iframe');
    const videoEl = document.getElementById('cinema-video');
    const playerControls = document.getElementById('player-controls');
    const playerTitle = document.getElementById('player-title');
    const playerChannel = document.getElementById('player-channel');
    const playerLoader = document.getElementById('player-loader');

    playerTitle.textContent = video.title;
    playerChannel.textContent = video.uploader;

    // Reset iframe and video elements
    iframeEl.src = '';
    iframeEl.style.display = 'none';
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.style.display = 'none';
    playerControls.style.display = 'none';

    if (playerLoader) {
        playerLoader.style.display = 'flex';
        const loaderSpan = playerLoader.querySelector('span');
        if (loaderSpan) loaderSpan.textContent = 'Fetching Live Stream...';
    }

    try {
        const streamRes = await window.electronAPI.getStreamUrl(video.url);
        if (playerLoader) playerLoader.style.display = 'none';

        if (streamRes && streamRes.success && streamRes.streamUrl) {
            videoEl.style.display = 'block';
            playerControls.style.display = 'flex';
            videoEl.src = streamRes.streamUrl;
            videoEl.play().catch((err) => console.error('Stream playback error:', err));
        } else {
            // Fallback: Embed YouTube player with origin & referer bypass
            iframeEl.style.display = 'block';
            const videoId = video.id || extractVideoId(video.url);
            iframeEl.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=https://www.youtube.com&widget_referrer=https://www.youtube.com`;
        }
    } catch (err) {
        if (playerLoader) playerLoader.style.display = 'none';
        console.error('Stream resolution failed:', err);
        // Fallback embed
        iframeEl.style.display = 'block';
        const videoId = video.id || extractVideoId(video.url);
        iframeEl.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=https://www.youtube.com`;
    }
}

/**
 * Plays offline local media file using hardware acceleration & media:// protocol
 */
export function playLocalVideo(file) {
    switchView('player');

    const iframeEl = document.getElementById('cinema-iframe');
    const videoEl = document.getElementById('cinema-video');
    const playerControls = document.getElementById('player-controls');
    const playerTitle = document.getElementById('player-title');
    const playerChannel = document.getElementById('player-channel');
    const btnPlayPause = document.getElementById('btn-play-pause');

    playerTitle.textContent = file.name;
    playerChannel.textContent = `Offline File • ${file.size}`;

    // Stop and hide iframe
    iframeEl.src = '';
    iframeEl.style.display = 'none';

    // Show and load local video
    videoEl.style.display = 'block';
    playerControls.style.display = 'flex';

    const cleanPath = file.fullPath.replace(/\\/g, '/');
    const mediaUrl = cleanPath.startsWith('/') ? `media://${cleanPath}` : `media:///${cleanPath}`;
    videoEl.src = mediaUrl;
    videoEl.play().catch((err) => console.error('Local playback error:', err));
    btnPlayPause.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
}

function extractVideoId(url) {
    if (!url) return '';
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : '';
}

export function stopVideoPlayer() {
    const iframeEl = document.getElementById('cinema-iframe');
    const videoEl = document.getElementById('cinema-video');
    if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
    }
    if (iframeEl) {
        iframeEl.src = '';
    }
}

