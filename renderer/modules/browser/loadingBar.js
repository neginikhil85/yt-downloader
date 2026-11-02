// ==========================================================================
// YT Studio Pro — Chrome-style page load progress line
//
// Instead of an endlessly sliding gradient, the bar grows quickly at first,
// then trickles asymptotically toward ~90% while the page loads, and on
// completion fills to 100% and gently fades out.
// ==========================================================================

const TRICKLE_INTERVAL_MS = 400;
const TRICKLE_CEILING = 0.92;
// Redirects and sub-frame loads fire stop→start in quick succession; waiting a
// moment before finishing prevents the bar from snapping back to 0.
const FINISH_DEBOUNCE_MS = 120;
const FILL_MS = 220;
const FADE_MS = 300;

export function createLoadingBar(barEl) {
    const inner = barEl ? barEl.querySelector('.browser-loading-bar-inner') : null;
    if (!inner) {
        return { start() {}, done() {}, reset() {} };
    }

    let progress = 0;
    let active = false;
    let trickleTimer = null;
    let finishTimer = null;
    let fadeTimer = null;
    let resetTimer = null;

    const setProgress = (value, durationMs) => {
        progress = value;
        inner.style.transition = `transform ${durationMs}ms cubic-bezier(0.25, 0.8, 0.25, 1), opacity ${FADE_MS}ms ease`;
        inner.style.transform = `scaleX(${value})`;
    };

    const jumpTo = (value) => {
        progress = value;
        inner.style.transition = 'none';
        inner.style.transform = `scaleX(${value})`;
        void inner.offsetWidth; // flush so the next transition starts from here
    };

    const clearTimers = () => {
        clearInterval(trickleTimer);
        clearTimeout(finishTimer);
        clearTimeout(fadeTimer);
        clearTimeout(resetTimer);
        trickleTimer = finishTimer = fadeTimer = resetTimer = null;
    };

    const trickle = () => {
        const remaining = TRICKLE_CEILING - progress;
        if (remaining > 0.002) setProgress(progress + remaining * 0.1, TRICKLE_INTERVAL_MS + 100);
    };

    function start() {
        clearTimeout(finishTimer);
        finishTimer = null;
        if (active) return;

        clearTimers();
        active = true;
        if (progress >= 1 || inner.style.opacity !== '1') jumpTo(0);
        inner.style.opacity = '1';
        setProgress(Math.max(progress, 0.2), 350);
        trickleTimer = setInterval(trickle, TRICKLE_INTERVAL_MS);
    }

    function done() {
        if (!active || finishTimer) return;
        finishTimer = setTimeout(() => {
            finishTimer = null;
            active = false;
            clearInterval(trickleTimer);
            trickleTimer = null;
            setProgress(1, FILL_MS);
            fadeTimer = setTimeout(() => {
                inner.style.opacity = '0';
                resetTimer = setTimeout(() => jumpTo(0), FADE_MS);
            }, FILL_MS);
        }, FINISH_DEBOUNCE_MS);
    }

    function reset() {
        clearTimers();
        active = false;
        inner.style.opacity = '0';
        jumpTo(0);
    }

    return { start, done, reset };
}
