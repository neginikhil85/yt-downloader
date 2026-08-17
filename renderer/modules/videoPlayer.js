import { formatTime } from './utils.js';
import { state } from './state.js';
import { switchView } from './navigation.js';
import { startDownloadTask } from './downloadManager.js';

export function initVideoPlayer() {
    const videoEl = document.getElementById('cinema-video');
    const audioEl = document.getElementById('cinema-audio');
    const screenWrapper = document.getElementById('video-screen-wrapper');
    const playerControls = document.getElementById('player-controls');
    const playerContainer = document.querySelector('.player-container');

    // Controls elements
    const btnPlayPause = document.getElementById('btn-play-pause');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    const btnRewind10 = document.getElementById('btn-rewind-10');
    const btnForward10 = document.getElementById('btn-forward-10');

    // Timeline Scrubber elements
    const timelineWrap = document.getElementById('yt-timeline-wrap');
    const timelineHoverTime = document.getElementById('yt-timeline-hover-time');
    const timelineHoverBar = document.getElementById('yt-timeline-hover-bar');
    const timelineBuffer = document.getElementById('yt-timeline-buffer');
    const timelineProgress = document.getElementById('yt-timeline-progress');
    const timelineThumb = document.getElementById('yt-timeline-thumb');

    // Volume elements
    const ytVolumeBox = document.getElementById('yt-volume-box');
    const btnMute = document.getElementById('btn-mute');
    const volHigh = document.getElementById('vol-high');
    const volLow = document.getElementById('vol-low');
    const volMuted = document.getElementById('vol-muted');
    const volumeSlider = document.getElementById('volume-slider');

    // Time & features
    const timeDisplay = document.getElementById('yt-time-display');
    const currentTimeEl = document.getElementById('current-time');
    const totalDurationEl = document.getElementById('total-duration');
    const btnLoop = document.getElementById('btn-loop');
    const btnSettings = document.getElementById('btn-settings');
    const settingsMenu = document.getElementById('yt-settings-menu');
    const btnPip = document.getElementById('btn-pip');
    const btnTheater = document.getElementById('btn-theater');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const iconFsEnter = document.getElementById('icon-fs-enter');
    const iconFsExit = document.getElementById('icon-fs-exit');

    // Overlays
    const centerRipple = document.getElementById('center-action-ripple');
    const ripplePlay = centerRipple?.querySelector('.ripple-icon-play');
    const ripplePause = centerRipple?.querySelector('.ripple-icon-pause');
    const seekRippleLeft = document.getElementById('seek-ripple-left');
    const seekRippleRight = document.getElementById('seek-ripple-right');

    const btnBackPlayer = document.getElementById('btn-back-player');

    let isScrubbing = false;
    let showRemainingTime = false;
    let controlsTimer = null;
    let previousVolume = 0.9;

    // 1. Play / Pause with Animation & Audio Sync
    function togglePlayPause(showRipple = true) {
        if (videoEl.paused) {
            videoEl.play().catch(err => console.warn('Play notice:', err.message || err));
            if (audioEl && audioEl.src && audioEl.paused) audioEl.play().catch(()=>{});
            if (showRipple) triggerCenterRipple(true);
        } else {
            videoEl.pause();
            if (audioEl && audioEl.src && !audioEl.paused) audioEl.pause();
            if (showRipple) triggerCenterRipple(false);
        }
    }

    function triggerCenterRipple(isPlaying) {
        if (!centerRipple) return;
        if (isPlaying) {
            if (ripplePlay) ripplePlay.style.display = 'block';
            if (ripplePause) ripplePause.style.display = 'none';
        } else {
            if (ripplePlay) ripplePlay.style.display = 'none';
            if (ripplePause) ripplePause.style.display = 'block';
        }
        centerRipple.classList.add('active');
        setTimeout(() => {
            centerRipple.classList.remove('active');
        }, 320);
    }

    videoEl.addEventListener('play', () => {
        if (iconPlay) iconPlay.style.display = 'none';
        if (iconPause) iconPause.style.display = 'block';
        if (btnPlayPause) btnPlayPause.title = 'Pause (k / space)';
        if (audioEl && audioEl.src && audioEl.paused) audioEl.play().catch(()=>{});
        resetControlsTimeout();
    });

    videoEl.addEventListener('pause', () => {
        if (iconPlay) iconPlay.style.display = 'block';
        if (iconPause) iconPause.style.display = 'none';
        if (btnPlayPause) btnPlayPause.title = 'Play (k / space)';
        if (audioEl && audioEl.src && !audioEl.paused) audioEl.pause();
        showControls();
    });

    videoEl.addEventListener('seeking', () => {
        if (audioEl && audioEl.src) audioEl.currentTime = videoEl.currentTime;
    });

    videoEl.addEventListener('seeked', () => {
        if (audioEl && audioEl.src) audioEl.currentTime = videoEl.currentTime;
    });

    videoEl.addEventListener('ratechange', () => {
        if (audioEl && audioEl.src) audioEl.playbackRate = videoEl.playbackRate;
    });

    videoEl.addEventListener('volumechange', () => {
        if (audioEl && audioEl.src) {
            audioEl.volume = videoEl.volume;
            audioEl.muted = videoEl.muted;
        }
    });

    videoEl.addEventListener('ended', () => {
        if (iconPlay) iconPlay.style.display = 'block';
        if (iconPause) iconPause.style.display = 'none';
        if (audioEl && audioEl.src) audioEl.pause();
        showControls();
    });

    if (btnPlayPause) {
        btnPlayPause.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlayPause(false);
        });
    }

    // 2. Interactive Scrubber Timeline (Smooth Drag & Hover)
    function updateTimeline() {
        if (!videoEl.duration) return;
        const current = videoEl.currentTime;
        const total = videoEl.duration;
        const pct = (current / total) * 100;

        if (!isScrubbing) {
            if (timelineProgress) timelineProgress.style.width = `${pct}%`;
            if (timelineThumb) timelineThumb.style.left = `${pct}%`;
        }

        if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
        if (totalDurationEl) {
            totalDurationEl.textContent = showRemainingTime ? `-${formatTime(total - current)}` : formatTime(total);
        }

        // Buffer progress
        if (videoEl.buffered.length > 0 && timelineBuffer) {
            for (let i = videoEl.buffered.length - 1; i >= 0; i--) {
                if (videoEl.buffered.start(i) <= current) {
                    const bufferedEnd = videoEl.buffered.end(i);
                    const bufPct = (bufferedEnd / total) * 100;
                    timelineBuffer.style.width = `${bufPct}%`;
                    break;
                }
            }
        }
    }

    videoEl.addEventListener('timeupdate', updateTimeline);
    videoEl.addEventListener('progress', updateTimeline);

    function getTimelinePctFromEvent(e) {
        const rect = timelineWrap.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        return offsetX / rect.width;
    }

    if (timelineWrap) {
        timelineWrap.addEventListener('mousemove', (e) => {
            if (!videoEl.duration) return;
            const pct = getTimelinePctFromEvent(e);
            const hoverTimeSec = pct * videoEl.duration;

            if (timelineHoverTime) {
                timelineHoverTime.style.display = 'block';
                timelineHoverTime.style.left = `${pct * 100}%`;
                timelineHoverTime.textContent = formatTime(hoverTimeSec);
            }
            if (timelineHoverBar) {
                timelineHoverBar.style.width = `${pct * 100}%`;
            }
        });

        timelineWrap.addEventListener('mouseleave', () => {
            if (timelineHoverTime) timelineHoverTime.style.display = 'none';
            if (timelineHoverBar) timelineHoverBar.style.width = '0%';
        });

        timelineWrap.addEventListener('mousedown', (e) => {
            if (!videoEl.duration) return;
            isScrubbing = true;
            timelineWrap.classList.add('scrubbing');
            const pct = getTimelinePctFromEvent(e);
            videoEl.currentTime = pct * videoEl.duration;
            if (timelineProgress) timelineProgress.style.width = `${pct * 100}%`;
            if (timelineThumb) timelineThumb.style.left = `${pct * 100}%`;

            const onMouseMove = (moveEvent) => {
                const movePct = getTimelinePctFromEvent(moveEvent);
                videoEl.currentTime = movePct * videoEl.duration;
                if (timelineProgress) timelineProgress.style.width = `${movePct * 100}%`;
                if (timelineThumb) timelineThumb.style.left = `${movePct * 100}%`;
            };

            const onMouseUp = () => {
                isScrubbing = false;
                timelineWrap.classList.remove('scrubbing');
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    // 3. Time Display toggle (Total vs Remaining)
    if (timeDisplay) {
        timeDisplay.addEventListener('click', () => {
            showRemainingTime = !showRemainingTime;
            updateTimeline();
        });
    }

    // 4. Seeking with double click & buttons
    function seekVideo(delta, showVisual = true) {
        if (!videoEl.duration) return;
        videoEl.currentTime = Math.max(0, Math.min(videoEl.duration, videoEl.currentTime + delta));
        updateTimeline();

        if (showVisual) {
            const ripple = delta > 0 ? seekRippleRight : seekRippleLeft;
            if (ripple) {
                ripple.classList.add('active');
                setTimeout(() => ripple.classList.remove('active'), 400);
            }
        }
    }

    if (btnRewind10) btnRewind10.addEventListener('click', (e) => { e.stopPropagation(); seekVideo(-10); });
    if (btnForward10) btnForward10.addEventListener('click', (e) => { e.stopPropagation(); seekVideo(10); });

    // Screen click & double click gestures
    let clickTimeout = null;
    if (screenWrapper) {
        screenWrapper.addEventListener('click', (e) => {
            if (e.target.closest('#player-controls') || e.target.closest('#cinema-iframe') || e.target.closest('.yt-settings-menu')) return;

            if (clickTimeout === null) {
                clickTimeout = setTimeout(() => {
                    clickTimeout = null;
                    togglePlayPause(true);
                }, 220);
            } else {
                clearTimeout(clickTimeout);
                clickTimeout = null;
                const rect = screenWrapper.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                if (clickX > rect.width / 2) {
                    seekVideo(10, true);
                } else {
                    seekVideo(-10, true);
                }
            }
        });
    }

    // 5. Volume Controls & Dynamic SVG icons
    function updateVolume(val) {
        const clamped = Math.max(0, Math.min(1, val));
        videoEl.volume = clamped;
        videoEl.muted = clamped === 0;
        if (volumeSlider) volumeSlider.value = clamped;

        if (clamped === 0) {
            if (volHigh) volHigh.style.display = 'none';
            if (volLow) volLow.style.display = 'none';
            if (volMuted) volMuted.style.display = 'block';
        } else if (clamped < 0.5) {
            if (volHigh) volHigh.style.display = 'none';
            if (volLow) volLow.style.display = 'block';
            if (volMuted) volMuted.style.display = 'none';
        } else {
            if (volHigh) volHigh.style.display = 'block';
            if (volLow) volLow.style.display = 'none';
            if (volMuted) volMuted.style.display = 'none';
        }
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', () => {
            updateVolume(parseFloat(volumeSlider.value));
            if (parseFloat(volumeSlider.value) > 0) {
                previousVolume = parseFloat(volumeSlider.value);
            }
        });
    }

    if (btnMute) {
        btnMute.addEventListener('click', (e) => {
            e.stopPropagation();
            if (videoEl.volume > 0) {
                previousVolume = videoEl.volume;
                updateVolume(0);
            } else {
                updateVolume(previousVolume || 0.9);
            }
        });
    }

    // 6. Settings Popup Menu (Quality & Playback Speed Tabs)
    const tabBtnQuality = document.getElementById('tab-btn-quality');
    const tabBtnSpeed = document.getElementById('tab-btn-speed');
    const qualityList = document.getElementById('yt-quality-list');
    const speedList = document.getElementById('yt-speed-list');
    const qualityOpts = document.querySelectorAll('#yt-quality-list .yt-menu-opt');
    const speedOpts = document.querySelectorAll('#yt-speed-list .yt-menu-opt');

    if (tabBtnQuality && tabBtnSpeed && qualityList && speedList) {
        tabBtnQuality.addEventListener('click', (e) => {
            e.stopPropagation();
            tabBtnQuality.classList.add('active');
            tabBtnSpeed.classList.remove('active');
            qualityList.style.display = 'flex';
            speedList.style.display = 'none';
        });

        tabBtnSpeed.addEventListener('click', (e) => {
            e.stopPropagation();
            tabBtnSpeed.classList.add('active');
            tabBtnQuality.classList.remove('active');
            speedList.style.display = 'flex';
            qualityList.style.display = 'none';
        });
    }

    if (btnSettings && settingsMenu) {
        btnSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = settingsMenu.style.display === 'block';
            settingsMenu.style.display = isVisible ? 'none' : 'block';
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.yt-settings-wrap')) {
                settingsMenu.style.display = 'none';
            }
        });

        // Speed options
        speedOpts.forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.dataset.speed || '1.0');
                videoEl.playbackRate = speed;
                speedOpts.forEach(o => o.classList.remove('active'));
                btn.classList.add('active');
                settingsMenu.style.display = 'none';
            });
        });

        // Quality / Resolution options
        qualityOpts.forEach(btn => {
            btn.addEventListener('click', async () => {
                const quality = btn.dataset.quality || 'auto';
                qualityOpts.forEach(o => o.classList.remove('active'));
                btn.classList.add('active');
                settingsMenu.style.display = 'none';

                if (state.currentVideoData && state.currentVideoData.url) {
                    const savedTime = videoEl.currentTime || 0;
                    const wasPlaying = !videoEl.paused;

                    const playerLoader = document.getElementById('player-loader');
                    if (playerLoader) {
                        playerLoader.style.display = 'flex';
                        const span = playerLoader.querySelector('span');
                        if (span) span.textContent = `Switching to ${btn.textContent.trim()}...`;
                    }

                    try {
                        const res = await window.electronAPI.getStreamUrl(state.currentVideoData.url, quality);
                        if (playerLoader) playerLoader.style.display = 'none';
                        if (res && res.success && res.streamUrl) {
                            videoEl.src = res.streamUrl;
                            videoEl.currentTime = savedTime;
                            if (wasPlaying) {
                                videoEl.play().catch(e => console.error('Play error on quality switch:', e));
                            }
                        }
                    } catch (err) {
                        if (playerLoader) playerLoader.style.display = 'none';
                        console.error('Quality switch error:', err);
                    }
                }
            });
        });
    }

    // 7. Loop Video Toggle
    if (btnLoop) {
        btnLoop.addEventListener('click', (e) => {
            e.stopPropagation();
            videoEl.loop = !videoEl.loop;
            btnLoop.classList.toggle('active', videoEl.loop);
            btnLoop.title = `Toggle Loop (${videoEl.loop ? 'on' : 'off'})`;
        });
    }

    // 8. Picture in Picture (PiP)
    if (btnPip) {
        btnPip.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else if (document.pictureInPictureEnabled && videoEl.src) {
                    await videoEl.requestPictureInPicture();
                }
            } catch (err) {
                console.error('PiP error:', err);
            }
        });
    }

    // 9. Cinema / Theater Mode
    if (btnTheater && playerContainer) {
        btnTheater.addEventListener('click', (e) => {
            e.stopPropagation();
            playerContainer.classList.toggle('theater-mode');
            btnTheater.classList.toggle('active', playerContainer.classList.contains('theater-mode'));
        });
    }

    // 10. Fullscreen Mode
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            screenWrapper.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen().catch(err => console.error(err));
        }
    }

    document.addEventListener('fullscreenchange', () => {
        const isFs = !!document.fullscreenElement;
        if (iconFsEnter) iconFsEnter.style.display = isFs ? 'none' : 'block';
        if (iconFsExit) iconFsExit.style.display = isFs ? 'block' : 'none';
    });

    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFullscreen();
        });
    }

    // 11. Autohide Controls on Inactivity (2.5s)
    function showControls() {
        if (playerControls) playerControls.classList.add('active');
        if (screenWrapper) screenWrapper.classList.remove('hide-cursor');
    }

    function resetControlsTimeout() {
        showControls();
        clearTimeout(controlsTimer);
        if (!videoEl.paused) {
            controlsTimer = setTimeout(() => {
                if (!videoEl.paused && !isScrubbing && settingsMenu?.style.display !== 'block') {
                    if (playerControls) playerControls.classList.remove('active');
                    if (screenWrapper && document.fullscreenElement) {
                        screenWrapper.classList.add('hide-cursor');
                    }
                }
            }, 2500);
        }
    }

    if (screenWrapper) {
        screenWrapper.addEventListener('mousemove', resetControlsTimeout);
        screenWrapper.addEventListener('mouseenter', showControls);
        screenWrapper.addEventListener('mouseleave', () => {
            if (!videoEl.paused && !isScrubbing) {
                if (playerControls) playerControls.classList.remove('active');
            }
        });
    }

    // 12. Complete YouTube Hotkeys
    document.addEventListener('keydown', (e) => {
        const playerView = document.getElementById('view-player');
        if (!playerView || !playerView.classList.contains('active')) return;

        const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        switch (e.key.toLowerCase()) {
            case ' ':
            case 'k':
                e.preventDefault();
                togglePlayPause(true);
                break;
            case 'arrowright':
            case 'l':
                e.preventDefault();
                seekVideo(10, true);
                break;
            case 'arrowleft':
            case 'j':
                e.preventDefault();
                seekVideo(-10, true);
                break;
            case 'arrowup':
                e.preventDefault();
                updateVolume(videoEl.volume + 0.05);
                break;
            case 'arrowdown':
                e.preventDefault();
                updateVolume(videoEl.volume - 0.05);
                break;
            case 'm':
                e.preventDefault();
                btnMute?.click();
                break;
            case 'f':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 't':
                e.preventDefault();
                btnTheater?.click();
                break;
            case 'i':
                e.preventDefault();
                btnPip?.click();
                break;
            default:
                if (e.key >= '0' && e.key <= '9' && videoEl.duration) {
                    e.preventDefault();
                    videoEl.currentTime = (parseInt(e.key, 10) / 10) * videoEl.duration;
                    updateTimeline();
                }
                break;
        }
    });

    // 13. Back Button
    if (btnBackPlayer) {
        btnBackPlayer.addEventListener('click', () => {
            videoEl.pause();
            const iframe = document.getElementById('cinema-iframe');
            if (iframe) iframe.src = '';
            switchView(state.previousView || 'home');
        });
    }
}

/**
 * Dynamically updates player quality menu and download presets bar with live YouTube resolutions & sizes
 */
export function updateDynamicResolutions(resolutions = []) {
    const qualityList = document.getElementById('yt-quality-list');
    const dlPresetsContainer = document.getElementById('player-dl-presets');

    if (qualityList && resolutions.length > 0) {
        const videoRes = resolutions.filter(r => r.height > 0);
        let html = `<button class="yt-menu-opt active" data-quality="auto">Auto (Best Quality)</button>`;
        videoRes.forEach(r => {
            const sizeLabel = r.sizeStr ? ` (${r.sizeStr})` : '';
            html += `<button class="yt-menu-opt" data-quality="${r.quality}">${r.label}${sizeLabel}</button>`;
        });
        qualityList.innerHTML = html;

        // Attach click listeners to new dynamic quality options
        const qualityOpts = qualityList.querySelectorAll('.yt-menu-opt');
        const videoEl = document.getElementById('cinema-video');
        const audioEl = document.getElementById('cinema-audio');
        const settingsMenu = document.getElementById('yt-settings-menu');

        qualityOpts.forEach(btn => {
            btn.addEventListener('click', async () => {
                const quality = btn.dataset.quality || 'auto';
                qualityOpts.forEach(o => o.classList.remove('active'));
                btn.classList.add('active');
                if (settingsMenu) settingsMenu.style.display = 'none';

                if (state.currentVideoData && state.currentVideoData.url && videoEl) {
                    const savedTime = videoEl.currentTime || 0;
                    const wasPlaying = !videoEl.paused;

                    const playerLoader = document.getElementById('player-loader');
                    if (playerLoader) {
                        playerLoader.style.display = 'flex';
                        const span = playerLoader.querySelector('span');
                        if (span) span.textContent = `Switching to ${btn.textContent.trim()}...`;
                    }

                    try {
                        const res = await window.electronAPI.getStreamUrl(state.currentVideoData.url, quality);
                        if (playerLoader) playerLoader.style.display = 'none';
                            videoEl.src = res.streamUrl;
                            if (res.audioUrl && audioEl) {
                                audioEl.src = res.audioUrl;
                                audioEl.volume = videoEl.volume;
                                audioEl.muted = videoEl.muted;
                                audioEl.playbackRate = videoEl.playbackRate;
                            } else if (audioEl) {
                                audioEl.removeAttribute('src');
                            }

                            const restorePlayback = () => {
                                if (savedTime > 0) {
                                    try { videoEl.currentTime = savedTime; } catch {}
                                    if (audioEl && audioEl.src) { try { audioEl.currentTime = savedTime; } catch {} }
                                }
                                if (wasPlaying) {
                                    videoEl.play().catch(e => console.warn('Play notice on quality switch:', e.message || e));
                                    if (audioEl && audioEl.src) audioEl.play().catch(()=>{});
                                }
                            };

                            videoEl.addEventListener('loadedmetadata', restorePlayback, { once: true });
                    } catch (err) {
                        if (playerLoader) playerLoader.style.display = 'none';
                        console.error('Quality switch error:', err);
                    }
                }
            });
        });
    }

    if (dlPresetsContainer && resolutions.length > 0) {
        dlPresetsContainer.innerHTML = '';
        resolutions.forEach((r, idx) => {
            const btn = document.createElement('button');
            const isTop = idx === 0 && r.height > 0;
            btn.className = `btn-dl-preset ${isTop ? 'primary' : ''} ${r.height === 0 ? 'audio' : ''}`;
            btn.setAttribute('data-format', r.quality);
            
            const sizeLabel = r.sizeStr ? ` • ${r.sizeStr}` : '';
            if (isTop) {
                btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> ${r.label}${sizeLabel}`;
            } else {
                btn.textContent = `${r.label}${sizeLabel}`;
            }

            btn.addEventListener('click', () => {
                if (!state.currentVideoData) return;
                startDownloadTask(state.currentVideoData.url, state.currentVideoData.title, r.quality);
            });

            dlPresetsContainer.appendChild(btn);
        });
    }
}

/**
 * Streams YouTube Video live inside our native Cinema Player
 */
export async function streamVideo(video) {
    state.currentVideoData = video;
    switchView('player');

    const iframeEl = document.getElementById('cinema-iframe');
    const videoEl = document.getElementById('cinema-video');
    const audioEl = document.getElementById('cinema-audio');
    const playerControls = document.getElementById('player-controls');
    const playerTitle = document.getElementById('player-title');
    const playerChannel = document.getElementById('player-channel');
    const playerLoader = document.getElementById('player-loader');

    if (playerTitle) playerTitle.textContent = video.title;
    if (playerChannel) playerChannel.textContent = video.uploader || 'YouTube Video';

    // Reset iframe & video elements
    if (iframeEl) {
        iframeEl.src = '';
        iframeEl.style.display = 'none';
    }
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.style.display = 'none';
    if (audioEl) {
        audioEl.pause();
        audioEl.removeAttribute('src');
    }
    if (playerControls) playerControls.style.display = 'none';

    if (playerLoader) {
        playerLoader.style.display = 'flex';
        const loaderSpan = playerLoader.querySelector('span');
        if (loaderSpan) loaderSpan.textContent = 'Connecting YouTube Stream...';
    }

    // Query live available formats & resolutions in background to dynamically populate presets
    if (window.electronAPI && window.electronAPI.getVideoFormats) {
        window.electronAPI.getVideoFormats(video.url).then(res => {
            if (res && res.success && res.resolutions && res.resolutions.length > 0) {
                updateDynamicResolutions(res.resolutions);
            }
        }).catch(err => console.warn('Formats query notice:', err));
    }

    try {
        const streamRes = await window.electronAPI.getStreamUrl(video.url);
        if (playerLoader) playerLoader.style.display = 'none';

        if (streamRes && streamRes.success && streamRes.streamUrl) {
            videoEl.style.display = 'block';
            if (playerControls) playerControls.style.display = 'flex';
            videoEl.src = streamRes.streamUrl;
            if (streamRes.audioUrl && audioEl) {
                audioEl.src = streamRes.audioUrl;
                audioEl.volume = videoEl.volume;
                audioEl.muted = videoEl.muted;
                audioEl.playbackRate = videoEl.playbackRate;
            }
            videoEl.play().catch(err => console.warn('Autoplay notice:', err.message || err));
            if (audioEl && audioEl.src) audioEl.play().catch(()=>{});
        } else {
            // Embed fallback
            if (iframeEl) {
                iframeEl.style.display = 'block';
                const videoId = video.id || (video.url.match(/v=([^&]+)/)?.[1] || '');
                iframeEl.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=https://www.youtube.com`;
            }
        }
    } catch (err) {
        if (playerLoader) playerLoader.style.display = 'none';
        console.error('Stream resolution failed:', err);
        if (iframeEl) {
            iframeEl.style.display = 'block';
            const videoId = video.id || (video.url.match(/v=([^&]+)/)?.[1] || '');
            iframeEl.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=https://www.youtube.com`;
        }
    }
}

/**
 * Plays offline local media file
 */
export function playLocalVideo(file) {
    switchView('player');

    const iframeEl = document.getElementById('cinema-iframe');
    const videoEl = document.getElementById('cinema-video');
    const playerControls = document.getElementById('player-controls');
    const playerTitle = document.getElementById('player-title');
    const playerChannel = document.getElementById('player-channel');

    if (playerTitle) playerTitle.textContent = file.name || 'Local Video';
    if (playerChannel) playerChannel.textContent = file.size || 'Local Media File';

    if (iframeEl) {
        iframeEl.src = '';
        iframeEl.style.display = 'none';
    }

    videoEl.style.display = 'block';
    if (playerControls) playerControls.style.display = 'flex';
    videoEl.src = `media://${file.fullPath}`;
    videoEl.play().catch(err => console.error('Local video play notice:', err));
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
        iframeEl.style.display = 'none';
    }
}

export function seekVideo(deltaSeconds) {
    const videoEl = document.getElementById('cinema-video');
    if (!videoEl || !videoEl.duration) return;
    videoEl.currentTime = Math.max(0, Math.min(videoEl.duration, videoEl.currentTime + deltaSeconds));
}
