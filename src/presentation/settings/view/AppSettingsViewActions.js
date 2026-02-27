import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export function applyAppSettingsViewActions(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, AppSettingsViewActions.prototype);
}

class AppSettingsViewActions {
    readBufferLines(buffer) {
        const text = buffer
            ? buffer.get_text(buffer.get_start_iter(), buffer.get_end_iter(), false) || ''
            : '';
        return text.split('\n').map(l => l.trim()).filter(l => l);
    }

    async handleCommit() {
        this.dialog?.set_sensitive(false);

        const w = this.widgets;

        const updated = {
            language: w.langCombo?.get_active_id?.() || 'en',
            applyNetworkThemesImmediately: w.applyCheck?.get_active?.() || false,
            closePopupAfterApply: w.closeAfterApplyCheck?.get_active?.() || false,
            soundEnabled: w.soundEnabledCheck?.get_active?.() || false,
            enable_dependency_isolation: w.isolationCheckbox?.get_active?.() || false,
            animationType: w.animTypeCombo?.get_active_id?.() || 'grow',
            animationFPS: parseInt(w.fpsEntry?.get_text?.() || '240', 10),
            animationAngle: parseInt(w.angleEntry?.get_text?.() || '0', 10),
            wallpaperDuration: parseFloat(w.durEntry?.get_text?.() || '1.3'),
            skip_install_theme_apps: this.sections.themeApps?.collectSkipList?.() ?? [],
            showApplyTime: w.showApplyTimeCheck?.get_active?.() || false,
            sendPerformanceStats: w.sendPerformanceStatsCheck?.get_active?.() || false,
            gtkTheme: w.gtkThemeCombo?.get_active_id?.() || 'LastLayer',
            default_theme_bar: w.defaultBarCombo?.get_active_id?.() || 'none',
            show_install_terminal: w.showInstallTerminalCheck?.get_active?.() || false,
            show_after_install_terminal: w.showAfterInstallTerminalCheck?.get_active?.() || false,
            auto_close_install_terminal: w.autoCloseInstallTerminalCheck?.get_active?.() || false,
            auto_close_after_install_terminal: w.autoCloseAfterInstallTerminalCheck?.get_active?.() || false,
            force_hide_script_terminals: w.forceHideScriptTerminalsCheck?.get_active?.() || false,
            patcher_hold_terminal: w.patcherHoldTerminalCheck?.get_active?.() || false
        };

        updated.closePopupAfterApply && updated.sendPerformanceStats && (updated.closePopupAfterApply = false);

        const mergedState = {...this.formState, ...updated};
        [
            [this.securityBuffer, 'dangerousPatterns', () => this.readBufferLines(this.securityBuffer)],
            [this.exceptionsBuffer, 'securityExceptions', () => this.readBufferLines(this.exceptionsBuffer)],
            [this.tempBackupFolders, 'backupFolders', () => [...this.tempBackupFolders]],
            [this.tempExcludedFolders, 'excludedBackupFolders', () => [...this.tempExcludedFolders]]
        ].forEach(([source, key, resolve]) => source && (mergedState[key] = resolve()));

        const currentTheme = this.controller?.settingsService?.getCurrentTheme?.()
            || this.container?.get?.('settingsService')?.getCurrentTheme?.();
        currentTheme && (mergedState.theme = currentTheme);

        const diffOverride = {
            languageChanged: mergedState.language !== this.initialFormState?.language,
            themeChanged: mergedState.theme !== this.initialFormState?.theme
                || mergedState.gtkTheme !== this.initialFormState?.gtkTheme
        };

        Object.assign(this.formState, mergedState);
        this.onFormStateUpdated();

        this.controller?.setPatch?.(this.clonePlainObject(this.formState), {diffOverride});

        this.dialog?.hide();
        this.initialFormState = this.clonePlainObject(this.formState);
        this.initialCompatibilitySnapshot = this.compat.captureState();

        await this.controller.commit({diffOverride});
        this.controller?.close?.();
    }

    handleCancel() {
        this.compat.restoreState(this.initialCompatibilitySnapshot);
        this.controller?.close?.();
    }

    async loadStartupDataInternal() {
        return this.loadStartupData ? this.loadStartupData() : null;
    }

    getSystemGtkThemes() {
        const globalThemes = this.getSystemGtkThemesGlobal?.();
        return globalThemes
            ? globalThemes
            : (() => {
                const themes = [];
                const themePaths = [
                    GLib.build_filenamev([GLib.get_home_dir(), '.themes']),
                    '/usr/share/themes'
                ];

                for (const path of themePaths) {
                    const dir = Gio.File.new_for_path(path);
                    dir.query_exists(null) && (() => {
                        const enumerator = dir.enumerate_children(
                            'standard::name,standard::type',
                            Gio.FileQueryInfoFlags.NONE,
                            null
                        );

                        let info;
                        while ((info = enumerator.next_file(null))) {
                            const name = info.get_name();
                            info.get_file_type() === Gio.FileType.DIRECTORY && !themes.includes(name) && themes.push(name);
                        }
                    })();
                }

                return themes.sort();
            })();
    }

    playSupportClickSound() {
        const player = this.container?.get?.('soundPlayer');
        player?.play
            ? player.play('support_click.wav')
            : (typeof this.playSound === 'function' && this.playSound('support_click.wav'));
    }
}
