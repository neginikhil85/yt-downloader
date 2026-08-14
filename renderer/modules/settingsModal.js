import { state, saveSettings, subscribeSettings } from './state.js';

export function initSettingsModal() {
    const profileCard = document.getElementById('user-profile-card');
    const avatarInitial = document.getElementById('user-avatar-initial');
    const greetingName = document.getElementById('user-greeting-name');
    const folderLabel = document.getElementById('sidebar-folder-label');

    const modal = document.getElementById('settings-modal');
    const nameInput = document.getElementById('settings-name');
    const pathInput = document.getElementById('settings-path');
    const qualitySelect = document.getElementById('settings-default-quality');
    const btnBrowse = document.getElementById('btn-settings-browse');
    const btnClose = document.getElementById('btn-close-settings');
    const btnCancel = document.getElementById('btn-settings-cancel');
    const btnSave = document.getElementById('btn-settings-save');

    function updateProfileUI(settings) {
        const name = settings.name || 'User';
        greetingName.textContent = name;
        avatarInitial.textContent = name.charAt(0).toUpperCase() || 'U';
        folderLabel.textContent = settings.savePath || '';
    }

    subscribeSettings(updateProfileUI);
    updateProfileUI(state.userSettings);

    profileCard.addEventListener('click', () => {
        nameInput.value = state.userSettings.name || '';
        pathInput.value = state.userSettings.savePath || '';
        qualitySelect.value = state.userSettings.defaultQuality || '1080p';
        modal.style.display = 'flex';
        nameInput.focus();
    });

    btnBrowse.addEventListener('click', async () => {
        const selected = await window.electronAPI.selectFolder();
        if (selected) {
            pathInput.value = selected;
        }
    });

    btnClose.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    btnCancel.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    btnSave.addEventListener('click', () => {
        const name = nameInput.value.trim() || 'User';
        const savePath = pathInput.value.trim() || state.userSettings.savePath;
        const defaultQuality = qualitySelect.value || '1080p';

        saveSettings({
            name,
            savePath,
            defaultQuality
        });

        modal.style.display = 'none';
    });
}
