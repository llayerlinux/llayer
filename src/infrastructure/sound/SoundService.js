import GLib from 'gi://GLib';
import { Commands } from '../constants/Commands.js';

const SOUND_FILES = {
    buttonHover: 'soft_click.wav',
    themeApply: 'soft_apply.wav',
    themeInstalled: 'soft_install.wav',
    install: 'soft_install.wav',
    supportClick: 'support_click.wav',
    success: 'installed2.wav',
    close: 'button_hover2.wav'
};

export class SoundService {
    constructor(logger = null, currentDir = null, settingsManager = null) {
        this.logger = logger;
        this.currentDir = currentDir || GLib.get_current_dir();
        this.assetsDir = `${this.currentDir}/assets`;

        this.enabled = settingsManager?.get?.('soundEnabled') !== false;
    }

    async playSound(soundFileName) {
        const soundPath = `${this.assetsDir}/${soundFileName}`;
        (this.enabled && GLib.file_test(soundPath, GLib.FileTest.EXISTS)) && GLib.idle_add(GLib.PRIORITY_LOW, () => {
            GLib.spawn_async(null, [Commands.PAPLAY, soundPath], null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.STDOUT_TO_DEV_NULL | GLib.SpawnFlags.STDERR_TO_DEV_NULL,
                null);
            return GLib.SOURCE_REMOVE;
        });
    }

    async playByKey(key) {
        const file = SOUND_FILES[key] || key;
        await this.playSound(file);
    }

    async playButtonHoverSound() {
        await this.playByKey('buttonHover');
    }

    async playThemeApplySound() {
        await this.playByKey('themeApply');
    }

    async playThemeInstalledSound() {
        await this.playByKey('themeInstalled');
    }

    async playInstallSound() {
        await this.playByKey('install');
    }

    async playSupportClickSound() {
        await this.playByKey('supportClick');
    }

    async playSuccess() {
        await this.playByKey('success');
    }

    async playClose() {
        await this.playByKey('close');
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }
}
