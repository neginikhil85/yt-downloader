// ==========================================================================
// YT Studio Pro — Quick Tools & Page Injections Controller
// ==========================================================================

import { ADBLOCK_CSS, DARK_READER_CSS } from '../../data/pageStyles.js';
import { USER_AGENTS } from '../../data/userAgents.js';

export class QuickToolsController {
    constructor({
        extPanel,
        btnExtensions,
        extCloseBtn,
        extToggleAdblock,
        extToggleDarkmode,
        extBtnReader,
        extBtnPip,
        extUaSelect,
        extBtnDevtools,
        extBtnInjectJs,
        extBtnClearCache,
        extBtnHardReload,
        scriptModal,
        btnCloseScriptModal,
        btnScriptCancel,
        btnScriptRun,
        scriptTextarea,
        getActiveTab,
        getAllTabs
    }) {
        this.extPanel = extPanel;
        this.btnExtensions = btnExtensions;
        this.extCloseBtn = extCloseBtn;
        this.extToggleAdblock = extToggleAdblock;
        this.extToggleDarkmode = extToggleDarkmode;
        this.extBtnReader = extBtnReader;
        this.extBtnPip = extBtnPip;
        this.extUaSelect = extUaSelect;
        this.extBtnDevtools = extBtnDevtools;
        this.extBtnInjectJs = extBtnInjectJs;
        this.extBtnClearCache = extBtnClearCache;
        this.extBtnHardReload = extBtnHardReload;

        this.scriptModal = scriptModal;
        this.btnCloseScriptModal = btnCloseScriptModal;
        this.btnScriptCancel = btnScriptCancel;
        this.btnScriptRun = btnScriptRun;
        this.scriptTextarea = scriptTextarea;

        this.getActiveTab = getActiveTab || (() => null);
        this.getAllTabs = getAllTabs || (() => []);

        this.globalAdBlock = true;
        this.globalDarkMode = false;
        this.currentUaKey = 'desktop';

        this.init();
    }

    init() {
        if (this.btnExtensions && this.extPanel) {
            this.btnExtensions.addEventListener('click', (e) => {
                e.stopPropagation();
                this.extPanel.classList.toggle('open');
            });
        }

        if (this.extCloseBtn && this.extPanel) {
            this.extCloseBtn.addEventListener('click', () => {
                this.extPanel.classList.remove('open');
            });
        }

        document.addEventListener('click', (e) => {
            if (this.extPanel && this.extPanel.classList.contains('open')) {
                if (!this.extPanel.contains(e.target) && (!this.btnExtensions || !this.btnExtensions.contains(e.target))) {
                    this.extPanel.classList.remove('open');
                }
            }
        });

        if (this.extToggleAdblock) this.extToggleAdblock.addEventListener('change', (e) => this.toggleAdBlock(e.target.checked));
        if (this.extToggleDarkmode) this.extToggleDarkmode.addEventListener('change', (e) => this.toggleDarkMode(e.target.checked));
        if (this.extBtnReader) this.extBtnReader.addEventListener('click', () => this.triggerReaderMode());
        if (this.extBtnPip) this.extBtnPip.addEventListener('click', () => this.triggerVideoPip());
        if (this.extUaSelect) this.extUaSelect.addEventListener('change', (e) => this.setUserAgent(e.target.value));
        if (this.extBtnDevtools) this.extBtnDevtools.addEventListener('click', () => this.openDevTools());
        if (this.extBtnClearCache) this.extBtnClearCache.addEventListener('click', () => this.clearCache());
        if (this.extBtnHardReload) this.extBtnHardReload.addEventListener('click', () => this.clearCache());

        if (this.extBtnInjectJs) {
            this.extBtnInjectJs.addEventListener('click', () => {
                if (this.extPanel) this.extPanel.classList.remove('open');
                if (this.scriptModal) this.scriptModal.style.display = 'flex';
            });
        }

        if (this.btnCloseScriptModal) this.btnCloseScriptModal.addEventListener('click', () => { if (this.scriptModal) this.scriptModal.style.display = 'none'; });
        if (this.btnScriptCancel) this.btnScriptCancel.addEventListener('click', () => { if (this.scriptModal) this.scriptModal.style.display = 'none'; });
        if (this.btnScriptRun) {
            this.btnScriptRun.addEventListener('click', () => {
                const code = this.scriptTextarea ? this.scriptTextarea.value : '';
                const activeTab = this.getActiveTab();
                if (activeTab && activeTab.webviewEl && code) {
                    activeTab.webviewEl.executeJavaScript(code).then(() => {
                        if (this.scriptModal) this.scriptModal.style.display = 'none';
                    }).catch(err => alert('Script Error: ' + err.message));
                }
            });
        }
    }

    applyInjections(wv) {
        if (!wv) return;
        if (this.globalAdBlock) {
            wv.insertCSS(ADBLOCK_CSS).catch(()=>{});
        }
        if (this.globalDarkMode) {
            wv.insertCSS(DARK_READER_CSS).catch(()=>{});
        }
    }

    getUserAgent() {
        return USER_AGENTS[this.currentUaKey] || USER_AGENTS.desktop;
    }

    toggleAdBlock(enable) {
        this.globalAdBlock = enable;
        this.getAllTabs().forEach(t => {
            if (t.webviewEl && t.url !== 'about:home' && t.url !== 'about:addons') {
                if (enable) {
                    t.webviewEl.insertCSS(ADBLOCK_CSS).catch(()=>{});
                } else if (t.webviewEl.reload) {
                    t.webviewEl.reload();
                }
            }
        });
    }

    toggleDarkMode(enable) {
        this.globalDarkMode = enable;
        this.getAllTabs().forEach(t => {
            if (t.webviewEl && t.url !== 'about:home' && t.url !== 'about:addons') {
                if (enable) {
                    t.webviewEl.insertCSS(DARK_READER_CSS).catch(()=>{});
                } else if (t.webviewEl.reload) {
                    t.webviewEl.reload();
                }
            }
        });
    }

    triggerReaderMode() {
        const activeTab = this.getActiveTab();
        if (activeTab && activeTab.webviewEl && activeTab.url !== 'about:home' && activeTab.url !== 'about:addons') {
            const readerCode = `
                (function() {
                    const article = document.querySelector('article') || document.querySelector('main') || document.body;
                    document.body.innerHTML = '<div style="max-width:740px; margin:40px auto; padding:20px; font-family:serif; line-height:1.75; font-size:19px; color:#e0e0e0; background:#181818;">' + article.innerHTML + '</div>';
                    document.body.style.background = '#181818';
                })();
            `;
            activeTab.webviewEl.executeJavaScript(readerCode).catch(()=>{});
        }
        if (this.extPanel) this.extPanel.classList.remove('open');
    }

    triggerVideoPip() {
        const activeTab = this.getActiveTab();
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
        if (this.extPanel) this.extPanel.classList.remove('open');
    }

    setUserAgent(uaKey) {
        this.currentUaKey = uaKey;
        const uaString = USER_AGENTS[uaKey] || USER_AGENTS.desktop;
        
        const activeTab = this.getActiveTab();
        if (activeTab && activeTab.webviewEl) {
            activeTab.webviewEl.setUserAgent(uaString);
            if (activeTab.webviewEl.reload) activeTab.webviewEl.reload();
        }
    }

    openDevTools() {
        const activeTab = this.getActiveTab();
        if (activeTab && activeTab.webviewEl) {
            if (activeTab.webviewEl.isDevToolsOpened && activeTab.webviewEl.isDevToolsOpened()) {
                activeTab.webviewEl.closeDevTools();
            } else if (activeTab.webviewEl.openDevTools) {
                activeTab.webviewEl.openDevTools();
            }
        }
        if (this.extPanel) this.extPanel.classList.remove('open');
    }

    clearCache() {
        const activeTab = this.getActiveTab();
        if (activeTab && activeTab.webviewEl && activeTab.webviewEl.reloadIgnoringCache) {
            activeTab.webviewEl.reloadIgnoringCache();
        }
        if (this.extPanel) this.extPanel.classList.remove('open');
    }
}
