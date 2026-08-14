import { state, saveSettings } from './state.js';
import { performSearch } from './searchFeed.js';

export function initOnboardingModal() {
    const modal = document.getElementById('onboarding-modal');
    const nameInput = document.getElementById('onboarding-name');
    const pathInput = document.getElementById('onboarding-path');
    const btnBrowse = document.getElementById('btn-onboarding-browse');
    const btnSubmit = document.getElementById('btn-onboarding-submit');

    if (!state.userSettings.onboardingCompleted) {
        pathInput.value = state.userSettings.savePath;
        modal.style.display = 'flex';
        nameInput.focus();
    }

    btnBrowse.addEventListener('click', async () => {
        const selected = await window.electronAPI.selectFolder();
        if (selected) {
            pathInput.value = selected;
        }
    });

    btnSubmit.addEventListener('click', () => {
        const name = nameInput.value.trim() || 'User';
        const savePath = pathInput.value.trim() || state.userSettings.savePath;

        saveSettings({
            name,
            savePath,
            onboardingCompleted: true
        });

        modal.style.display = 'none';
        performSearch('tarak mehta');
    });

    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            btnSubmit.click();
        }
    });
}
