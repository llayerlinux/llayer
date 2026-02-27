import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';

class ApplyThemeCore {
    getFromContainer(name) {
        return this.diContainer?.has?.(name) ? this.diContainer.get(name) : null;
    }

    getClickStates() {
        return this.getFromContainer('themeClickStates');
    }

    getAppSettingsClass() {
        return this.getFromContainer('AppSettings');
    }

    getMainWindow() {
        const mainWindow = this.getFromContainer('mainWindow');
        const viewWindow = this.getFromContainer('themeSelectorView')?.window;
        return mainWindow || (viewWindow instanceof Gtk.Window ? viewWindow : null);
    }

    getPerformanceReporterClass() {
        return this.getFromContainer('PerformanceStatsReporter');
    }

    getGlobalTranslator() {
        const translator = this.getFromContainer('translator');
        return translator || this.getFromContainer('translationService')?.getTranslator?.() || null;
    }

    defaultSettings() {
        return {
            theme: 'default',
            skip_install_theme_apps: [],
            animationType: 'grow',
            animationFPS: 240,
            animationAngle: 0,
            wallpaperDuration: 1.3,
            intermediateDefaultTransition: false,
            patcher_hold_terminal: false,
            show_install_terminal: false,
            auto_close_install_terminal: true,
            show_after_install_terminal: false,
            auto_close_after_install_terminal: true,
            applyImmediately: true,
            showApplyTime: true,
            showInstallTime: true
        };
    }

    loadSettings() {
        const settings = this.settingsService?.getAll?.();
        return settings || (
            this.notifier?.error(this.translate('ERROR'), this.translate('SETTINGS_READ_ERROR')),
            this.defaultSettings()
        );
    }

    getOperationFlags(settings, themeName, options) {
        const skipInstall = Array.isArray(settings.skip_install_theme_apps) &&
            settings.skip_install_theme_apps.includes(themeName);

        skipInstall && !options.isReapplying && (options.isReapplying = true);

        return {
            skipInstall,
            isInstallOperation: !options.isReapplying && !skipInstall,
            isApplyOperation: options.isReapplying || skipInstall
        };
    }

    ensurePerformanceReporter() {
        const Reporter = this.getPerformanceReporterClass();
        !this.performanceReporter
            && this.settingsService
            && typeof Reporter === 'function'
            && (this.performanceReporter = new Reporter(this.settingsService, this.logger));
        return this.performanceReporter;
    }

    sendPerformanceStats(theme, metrics = {}) {
        this.ensurePerformanceReporter()?.send(theme, metrics);
    }

    async sleep(ms) {
        return new Promise(done => {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
                done();
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    getTranslator() {
        if (typeof this.t === 'function') {
            return this.t;
        }

        const translator = this.getGlobalTranslator();
        typeof translator === 'function' && (this.t = translator);
        return translator || null;
    }

    translate(key, params = null) {
        const translated = ((fn) => typeof fn === 'function' ? fn(key, params ?? undefined) : null)(this.t || this.getTranslator());
        if (typeof translated === 'string') return translated;

        return (params && typeof params === 'object' && !Array.isArray(params))
            ? Object.keys(params).reduce((acc, keyName) => {
                return acc.replace(new RegExp(`\\{${keyName}\\}`, 'g'), params[keyName] == null ? '' : String(params[keyName]));
            }, String(key))
            : (typeof key === 'string' ? key : '');
    }
}

export function applyApplyThemeCore(targetProto) {
    copyPrototypeDescriptors(targetProto, ApplyThemeCore.prototype);
}
