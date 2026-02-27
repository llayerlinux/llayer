import {copyPrototypeDescriptors} from '../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=3.0';
import { MODULES } from './AppModules.js';
import { tryRun } from '../infrastructure/utils/ErrorUtils.js';

class AppRuntime {
    shutdown() {
        const taskRunner = this.container.has('taskRunner') ? this.container.get('taskRunner') : null;
        const themeSelectorController = this.container.has('themeSelectorController') ? this.container.get('themeSelectorController') : null;

        themeSelectorController?.destroy?.();
        this.settingsManager?.writeOnShutdown?.();
        taskRunner?.cancelAllTasks?.();
        this.window?.destroy?.();
        this.releaseInstancePid();
        this.stopCommandListener();
        this.stopLockUpdater();
        this.removeLockFile();

        tryRun('shutdown.cleanupCommandFile', () => {
            const cmdFile = Gio.File.new_for_path(this.getCommandFilePath());
            cmdFile.query_exists(null) && cmdFile.delete(null);
        });

        Gtk.main_quit();
    }

    debugStartup(message, payload = null) {
        const enabled = GLib.getenv('LASTLAYER_DEBUG_STARTUP') === '1';
        const details = payload == null ? '' : ` ${JSON.stringify(payload)}`;
        enabled && print(`[LastLayer startup] ${message}${details}`);
    }

    shouldExitForExistingInstance(existingInstanceCommand, labels = {}) {
        const toggled = this.toggleExistingOrStaleCleanup(existingInstanceCommand);
        const hasExistingInstance = toggled && this.hasOtherLastLayerInstance?.();
        hasExistingInstance && labels.detected && this.debugStartup(labels.detected);
        !hasExistingInstance && toggled && labels.falsePositive && this.debugStartup(labels.falsePositive);
        return hasExistingInstance;
    }

    ensureRuntimeLock(existingInstanceCommand) {
        const lockCreated = this.createLockFile();
        this.debugStartup('run:lock-created', {lockCreated});
        return lockCreated
            ? true
            : (() => {
                GLib.usleep(200000);
                const shouldExitAfterWait = this.shouldExitForExistingInstance(existingInstanceCommand, {
                    detected: 'run:existing-instance-toggled-after-wait',
                    falsePositive: 'run:toggle-after-wait-false-positive'
                });
                return shouldExitAfterWait
                    ? false
                    : (
                        this.removeLockFile(),
                        this.createLockFile()
                            || (this.debugStartup('run:lock-failed-after-cleanup'), false)
                    );
            })();
    }

    async run() {
        const args = ARGV ?? [];
        this.debugStartup('run:start', {args});
        if (args.includes('--syntax-check')) {
            this.debugStartup('run:syntax-check');
            return;
        }

        const isPlainUiCall = args.length === 0 || (args.length === 1 && args[0] === 'ui');
        const hasToggleFlag = args.includes('--toggle') || args.includes('-t');
        const existingInstanceCommand = hasToggleFlag ? 'toggle' : 'show';
        this.debugStartup('run:mode', {isPlainUiCall, hasToggleFlag});

        if (args.length > 0 && !hasToggleFlag && !isPlainUiCall) {
            this.debugStartup('run:cli:initialize');
            await this.initialize({skipGtk: true});
            this.debugStartup('run:cli:handle');
            await this.handleCLI(args);
            this.debugStartup('run:cli:done');
            return;
        }

        const shouldStopUiStartup = this.shouldExitForExistingInstance(existingInstanceCommand, {
            detected: 'run:existing-instance-toggled',
            falsePositive: 'run:toggle-false-positive-recovered'
        }) || !this.ensureRuntimeLock(existingInstanceCommand);
        if (shouldStopUiStartup) {
            return;
        }

        this.debugStartup('run:ui:initialize');
        await this.initialize();
        this.debugStartup('run:ui:initialized');
        await this.runMainThemeSelector();
        this.debugStartup('run:ui:view-ready');
        this.startCommandListener();
        this.startLockUpdater();
        this.writeInstancePid();
        this.debugStartup('run:ui:enter-gtk-main');
        Gtk.main();
        this.debugStartup('run:ui:gtk-main-returned');
        this.releaseInstancePid();
        this.stopCommandListener();
        this.stopLockUpdater();
        this.removeLockFile();
    }

    async handleCLI(args) {
        const get = (name) => (this.container.has(name) ? this.container.get(name) : null),
            cli = new MODULES.ThemeApplyCLI({
                themeRepository: get('themeRepository'),
                applyThemeUseCase: get('applyThemeUseCase'),
                settingsService: get('settingsService'),
                logger: this.logger
            }),
            result = await cli.handle(args);
        result?.output && print(result.output);
    }

    async runMainThemeSelector() {
        this.debugStartup('runMainThemeSelector:start');
        let hasThemeSelectorView = this.container.has('themeSelectorView');
        !hasThemeSelectorView && this.debugStartup('runMainThemeSelector:no-view-service');
        if (!hasThemeSelectorView) {
            return;
        }
        let get = (name) => (this.container.has(name) ? this.container.get(name) : null);

        let appSettingsController = get('appSettingsController'),
            settings = this.settingsManager?.getAll();
        this.debugStartup('runMainThemeSelector:settings-loaded', {hasSettings: !!settings});
        settings && appSettingsController?.applySoundPreference?.(settings);
        settings && appSettingsController?.applyGtkTheme?.(settings);

        const view = get('themeSelectorView');
        const controller = get('themeSelectorController');
        this.debugStartup('runMainThemeSelector:services-ready', {hasView: !!view, hasController: !!controller});

        this.refreshOverridesOnStartup(get, settings);
        this.debugStartup('runMainThemeSelector:overrides-refreshed');

        view.show();
        this.debugStartup('runMainThemeSelector:view-shown');
        view.subscribeToStore();
        this.debugStartup('runMainThemeSelector:store-subscribed');
        await controller.initialize();
        this.debugStartup('runMainThemeSelector:controller-initialized');
        view?.window && this.container.value('mainWindow', view.window);
        this.themeSelectorView = view;
        this.debugStartup('runMainThemeSelector:done');
    }
}

export function applyAppRuntime(prototype) {
    copyPrototypeDescriptors(prototype, AppRuntime.prototype);
}
