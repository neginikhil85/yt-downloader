// ==========================================================================
// YT Studio Pro — Find in Page Controller
// ==========================================================================

export class FindInPageController {
    constructor({ findBar, findInput, findCount, findPrev, findNext, findClose, getActiveWebview }) {
        this.findBar = findBar;
        this.findInput = findInput;
        this.findCount = findCount;
        this.findPrev = findPrev;
        this.findNext = findNext;
        this.findClose = findClose;
        this.getActiveWebview = getActiveWebview || (() => null);

        this.init();
    }

    init() {
        if (this.findInput) {
            this.findInput.addEventListener('input', () => this.execute(true, false));
            this.findInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.execute(!e.shiftKey, true);
                } else if (e.key === 'Escape') {
                    this.close();
                }
            });
        }

        if (this.findPrev) this.findPrev.addEventListener('click', () => this.execute(false, true));
        if (this.findNext) this.findNext.addEventListener('click', () => this.execute(true, true));
        if (this.findClose) this.findClose.addEventListener('click', () => this.close());
    }

    open() {
        if (!this.findBar) return;
        this.findBar.style.display = 'flex';
        if (this.findInput) {
            this.findInput.focus();
            this.findInput.select();
        }
    }

    close() {
        if (!this.findBar) return;
        this.findBar.style.display = 'none';
        const wv = this.getActiveWebview();
        if (wv && wv.stopFindInPage) {
            wv.stopFindInPage('clearSelection');
        }
        if (this.findCount) this.findCount.textContent = '0 of 0';
    }

    execute(forward = true, findNext = false) {
        const text = this.findInput?.value || '';
        const wv = this.getActiveWebview();
        if (!wv || !wv.findInPage) return;

        if (!text) {
            wv.stopFindInPage('clearSelection');
            if (this.findCount) this.findCount.textContent = '0 of 0';
            return;
        }
        wv.findInPage(text, { forward, findNext });
    }

    handleFoundInPageResult(result) {
        if (this.findCount && result) {
            const active = result.activeMatchOrdinal || 0;
            const total = result.matches || 0;
            this.findCount.textContent = `${active} of ${total}`;
        }
    }
}
