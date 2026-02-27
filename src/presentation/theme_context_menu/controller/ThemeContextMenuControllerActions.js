import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=3.0';
import {Commands} from '../../../infrastructure/constants/Commands.js';
import { Events } from '../../../app/eventBus.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';
import { tryOrNull, tryRun } from '../../../infrastructure/utils/ErrorUtils.js';
import { runMessageDialog } from '../../common/ViewUtils.js';

export function applyThemeContextMenuControllerActions(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeContextMenuControllerActions.prototype);
}

class ThemeContextMenuControllerActions {
    getThemeSelectorView() {
        return this.container?.has?.('themeSelectorView')
            ? this.container.get('themeSelectorView')
            : null;
    }

    getCurrentTheme() {
        return this.currentMenuData?.theme || null;
    }

    requireCurrentTheme(errorKey = 'THEME_DATA_UNAVAILABLE') {
        const theme = this.getCurrentTheme();
        return theme || (this.notifyError(errorKey), null);
    }

    requireCurrentThemeName(errorKey = 'THEME_DATA_UNAVAILABLE') {
        const theme = this.requireCurrentTheme(errorKey);
        return theme?.name || null;
    }

    getService(name) {
        return this.container?.has?.(name) ? this.container.get(name) : null;
    }

    requireService(name, errorKey) {
        const service = this.getService(name);
        return service || (this.notifyError(errorKey), null);
    }

    notifyError(messageKey, params = null) {
        this.notify('ERROR', messageKey, params);
    }

    notifySuccess(messageKey, params = null) {
        this.notify('SUCCESS', messageKey, params);
    }

    async applyTheme() {
        let themeName = this.requireCurrentThemeName();
        if (!themeName) return;

        let applyResult = await this.applyThemeUseCase.execute(themeName, {
            forceReapply: false,
            includeBackground: true,
            includeBars: true,
            source: 'context_menu'
        });

        await this.closeMenu();
        applyResult?.success
            ? (this.notifySuccess('THEME_APPLY_SUCCESS_NOTIFICATION', {theme: themeName}),
            this.soundService?.playSound?.('theme_apply.wav'))
            : applyResult && (() => {
                const reason = applyResult.error || this.translate('UNKNOWN_ERROR');
                this.notifyError('THEME_APPLY_ERROR_MESSAGE', {error: reason});
            })();
    }

    async deleteTheme(options = {}) {
        const themeName = this.requireCurrentThemeName();
        const isNetworkTheme = this.currentMenuData?.isNetwork === true;
        if (!themeName) return;
        if (isNetworkTheme) return this.notifyError('THEME_DELETE_ONLY_LOCAL');
        const themePath = this.getLocalThemePath(themeName, this.currentMenuData.theme);
        this.confirmAndDelete(themeName, themePath, options);
    }

    getMainWindowForDialogs() {
        return this.view?.popup || this.getThemeSelectorView()?.window || null;
    }

    confirmAndDelete(themeName, themePath, options = {}) {
        const parent = this.getMainWindowForDialogs();
        const response = runMessageDialog({
            parent: parent || null,
            messageType: Gtk.MessageType.QUESTION,
            buttons: Gtk.ButtonsType.YES_NO,
            title: this.translate('THEME_DELETE_CONFIRM_TITLE', {theme: themeName}),
            secondaryText: this.translate('THEME_DELETE_CONFIRM_BODY', {path: themePath})
        });

        if (response !== Gtk.ResponseType.YES) return;
        if (!Gio.File.new_for_path(themePath).query_exists(null)) {
            return this.notifyError('THEME_FOLDER_NOT_FOUND', {path: themePath});
        }

        options.onProgress?.('start');

        const proc = new Gio.Subprocess({
            argv: [Commands.RM, '-rf', themePath],
            flags: Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_PIPE
        });
        proc.init(null);
        proc.wait_check_async(null, (self, res) => {
            const ok = tryOrNull('ThemeContextMenuControllerActions.waitDeleteTheme', () => self.wait_check_finish(res)) === true;

                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    options.onProgress?.('complete', {success: ok});
                    ok
                        ? (() => {
                            this.notifySuccess('THEME_DELETE_SUCCESS_NOTIFICATION', {theme: themeName});
                            this.soundService?.playSound?.('button_hover.wav');

                            const themeRepository = this.getService('themeRepository');
                            themeRepository?.invalidateCache?.();
                            themeRepository?.clearCache?.();

                            const themeSelectorStore = this.getService('themeSelectorStore');
                            themeSelectorStore?.removeTheme?.(themeName);

                            const bus = this.getService('eventBus');
                            bus?.emit?.(Events.THEME_REPOSITORY_UPDATED);
                            bus?.emit?.(Events.UI_REFRESH_REQUESTED, {tab: 'local'});

                            this.closeMenu();
                            GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_MS, () => {
                                this.refreshThemesList();
                                return GLib.SOURCE_REMOVE;
                            });
                        })()
                        : (() => {
                            const [, , stderr] = self.communicate_utf8(null, null);
                            const errText = stderr || this.translate('UNKNOWN_ERROR');
                            this.notifyError('THEME_DELETE_ERROR_WITH_REASON', {error: errText});
                            this.closeMenu();
                        })();

                    return GLib.SOURCE_REMOVE;
                });
            });
    }

    clearRepositoryCaches(themeRepository, themeSelectorController) {
        const repos = new Set([themeRepository, themeSelectorController?.themeRepository].filter(Boolean));
        for (const repo of repos) {
            repo.invalidateCache?.();
            repo.clearCache?.();
        }
        themeSelectorController?.activeProcesses?.clear();
    }

    async refreshThemesList() {
        let themeSelectorController = this.getService('themeSelectorController');
        if (!themeSelectorController) return;

        this.clearRepositoryCaches(this.getService('themeRepository'), themeSelectorController);
        let freshThemes = this.enumerateThemesDirectorySync(),
            themeSelectorStore = this.getService('themeSelectorStore');

        themeSelectorStore?.loadLocalThemes
            ? themeSelectorStore.loadLocalThemes(freshThemes)
            : themeSelectorStore?.set?.('localThemes', freshThemes);
        themeSelectorController.view?.updateThemesList?.(freshThemes);
        themeSelectorController.view?.themeItemComponent?.clearClickStates?.();
    }

    enumerateThemesDirectorySync() {
        const themes = [],
              themesPath = `${GLib.get_home_dir()}/.config/themes`,
              themesDir = Gio.File.new_for_path(themesPath);

        if (!themesDir.query_exists(null)) return themes;

        const enumerator = themesDir.enumerate_children(
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const type = info.get_file_type(),
                  name = info.get_name(),
                  isThemeDir = type === Gio.FileType.DIRECTORY || type === Gio.FileType.SYMBOLIC_LINK;
            isThemeDir && Boolean(name) && !name.startsWith('.') && name !== 'default' && themes.push({
                name: name,
                title: name,
                path: `${themesPath}/${name}`,
                source: 'local'
            });
        }
        enumerator.close(null);

        themes.sort((a, b) => a.name.localeCompare(b.name));
        return themes;
    }

    async editOnServer() {
        const theme = this.requireCurrentTheme();
        const startServerEditUseCase = this.requireService('startServerEditUseCase', 'SERVER_EDIT_SERVICE_UNAVAILABLE');
        if (!theme || !startServerEditUseCase) return;
        this.closeMenu();
        await startServerEditUseCase.execute(theme);
        this.soundService?.playSound('button_hover.wav');
    }

    async installTheme() {
        const themeName = this.requireCurrentThemeName();
        themeName && (this.notify('INFO_GENERIC', 'NETWORK_THEME_DOWNLOAD_UNAVAILABLE'),
        this.soundService?.playSound?.('installed.wav'));
    }

    showHyprlandOverrides() {
        const theme = this.requireCurrentTheme();
        const themeSelectorView = this.getThemeSelectorView();
        const openPopup = themeSelectorView?.showHyprlandOverridePopup;
        if (!openPopup) return this.notify('ERROR', 'HYPRLAND_OVERRIDE_SERVICE_UNAVAILABLE');
        if (!theme) return;
        openPopup.call(themeSelectorView, theme, this.view?.popup);
        this.soundService?.playSound?.('button_hover.wav');
    }

    async applyWithReconstructionScript() {
        const theme = this.requireCurrentTheme();
        if (!theme) return;

        let themeName = theme.name,
            themePath = this.getLocalThemePath(themeName, theme),
            reconstructionScriptPath = themePath && `${themePath}/reconstruction.sh`;
        if (!themePath) return this.notify('ERROR', 'THEME_PATH_NOT_FOUND');
        if (!Gio.File.new_for_path(reconstructionScriptPath).query_exists(null)) return this.notify('ERROR', 'RECONSTRUCTION_SCRIPT_NOT_FOUND');

        this.notify('INFO_GENERIC', 'APPLYING_THEME_WITH_SCRIPT');
        let applyResult = await this.applyThemeUseCase.execute(themeName, {
            forceReapply: false,
            includeBackground: true,
            includeBars: true,
            source: 'context_menu_reconstruction'
        });

        if (!applyResult?.success) {
            this.notify('ERROR', 'THEME_APPLY_ERROR_MESSAGE', {error: applyResult?.error || this.translate('UNKNOWN_ERROR')});
            return;
        }

        this.notify('SUCCESS', 'THEME_APPLY_SUCCESS_NOTIFICATION', {theme: themeName});
        this.soundService?.playSound?.('theme_apply.wav');
        this.notify('INFO_GENERIC', 'RECONSTRUCTION_SCRIPT_SCHEDULED');

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.ERROR_DISPLAY_MS, () => {
            this.executeReconstructionScript(reconstructionScriptPath, themeName);
            return GLib.SOURCE_REMOVE;
        });

        await this.closeMenu();
    }

    executeReconstructionScript(scriptPath, themeName) {
        let chmodOk = tryRun('ThemeContextMenuControllerActions.chmodReconstructionScript', () => {
            let chmodProc = new Gio.Subprocess({
                argv: [Commands.CHMOD, '+x', scriptPath],
                flags: Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE
            });
            chmodProc.init(null);
            chmodProc.wait(null);
        });
        if (!chmodOk) {
            return this.notify('ERROR', 'RECONSTRUCTION_SCRIPT_ERROR', {error: 'Failed to prepare reconstruction script'});
        }

        let proc = tryOrNull('ThemeContextMenuControllerActions.spawnReconstructionScript', () => {
            let subprocess = new Gio.Subprocess({
                argv: [Commands.BASH, scriptPath],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
            subprocess.init(null);
            return subprocess;
        });
        if (!proc) return this.notify('ERROR', 'RECONSTRUCTION_SCRIPT_ERROR', {error: 'Failed to start reconstruction script'});

        proc.wait_check_async(null, (self, res) => {
            let success = tryOrNull(
                'ThemeContextMenuControllerActions.waitReconstructionScript',
                () => self.wait_check_finish(res)
            ) === true;

            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                success
                    ? (this.notify('SUCCESS', 'RECONSTRUCTION_SCRIPT_SUCCESS', {theme: themeName}),
                    this.soundService?.playSound?.('installed.wav'))
                    : (() => {
                        const [, , stderr] = self.communicate_utf8(null, null);
                        const errText = stderr?.trim() || this.translate('UNKNOWN_ERROR');
                        this.notify('ERROR', 'RECONSTRUCTION_SCRIPT_ERROR', {error: errText});
                    })();
                return GLib.SOURCE_REMOVE;
            });
        });
    }
}
