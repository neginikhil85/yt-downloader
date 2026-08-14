const STORAGE_KEY = 'yt_studio_user_settings';

export const state = {
    userSettings: {
        name: 'User',
        savePath: '',
        defaultQuality: '1080p',
        onboardingCompleted: false
    },
    currentVideoData: null,
    activeDownloadsMap: new Map()
};

const listeners = [];

export function subscribeSettings(fn) {
    listeners.push(fn);
}

export async function initSettings() {
    const defaultPath = await window.electronAPI.getDefaultSavePath();
    state.userSettings.savePath = defaultPath;

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            state.userSettings = { ...state.userSettings, ...parsed };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }

    notifyListeners();
    return state.userSettings;
}

export function saveSettings(newSettings) {
    state.userSettings = { ...state.userSettings, ...newSettings };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.userSettings));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
    notifyListeners();
}

function notifyListeners() {
    listeners.forEach((fn) => fn(state.userSettings));
}
