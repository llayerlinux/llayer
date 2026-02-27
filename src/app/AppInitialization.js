import {copyPrototypeDescriptors} from '../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import { MODULES } from './AppModules.js';

const CURRENT_DIR = GLib.get_current_dir();

function loadGlobalCSS() {
    const cssPath = GLib.build_filenamev([CURRENT_DIR, 'styles', 'style.css']);
    return Gio.File.new_for_path(cssPath).query_exists(null)
        ? (() => {
            const cssProvider = new Gtk.CssProvider();
            cssProvider.load_from_path(cssPath);
            const screen = Gdk.Screen.get_default();
            Gtk.StyleContext.add_provider_for_screen(
                screen,
                cssProvider,
                Gtk.STYLE_PROVIDER_PRIORITY_USER
            );
            return true;
        })()
        : false;
}

class AppInitialization {
    async initialize(options = {}) {
        return this.initialized
            ? undefined
            : (async () => {
                const setupGtk = () => {
                    Gtk.init(null);
                    const settings = Gtk.Settings.get_default();
                    settings?.set_property('gtk-application-prefer-dark-theme', true);
                    settings?.set_property('gtk-theme-name', 'Adwaita-dark');
                    loadGlobalCSS();
                };
                options.skipGtk !== true && setupGtk();

                this.settingsManager = new MODULES.SettingsManager({eventBus: this.eventBus});
                this.settingsManager.load();

                [
                    ['applyTweaksPlugins', 'TweaksView'],
                    ['applyThemeSelectorLocalization', 'ThemeSelectorView']
                ].forEach(([applyKey, viewKey]) => {
                    const applyMixin = MODULES[applyKey];
                    const View = MODULES[viewKey];
                    typeof applyMixin === 'function' && View?.prototype && applyMixin(View.prototype);
                });

                await this.initializeDI();
                await this.initializeServices();
                await this.initializeEventBus();

                MODULES.AppSettingsCompat?.setup?.(this.container, this.settingsManager?.getAll?.() ?? {}, {});

                this.initialized = true;
            })();
    }

    async initializeDI() {
        this.container.value('container', this.container);
        this.container.value('currentDir', CURRENT_DIR);
        this.container.value('appName', 'LastLayer');
        this.container.value('version', '1.1');

        const processRunner = new MODULES.ProcessRunner({logger: {}});

        const execAsync = async (argv, options = {}) => {
            const result = (Array.isArray(argv) && argv.length > 0)
                ? await processRunner.run(argv, options)
                : null;
            return result
                ? (result.success
                    ? result.stdout
                    : result.stderr?.trim() || `Command failed: ${argv.join(' ')}`)
                : null;
        };

        this.container.value('execAsync', execAsync);
        this.container.value('processRunner', processRunner);
    }

    async initializeServices() {
        const get = (name) => (this.container.has(name) ? this.container.get(name) : null);
        const currentDir = CURRENT_DIR;

        this.container.value('modules', MODULES);

        const services = {
            'logger': () => new MODULES.Logger({enableFile: false, enableConsole: true}),
            'notifier': () => new MODULES.Notifier(this.logger),
            'soundService': () => new MODULES.SoundService(this.logger, currentDir),
            'securityManager': () => new MODULES.SecurityManager(this.logger),
            'taskRunner': () => {
                const securityManager = get('securityManager');
                const taskRunner = new MODULES.TaskRunner();
                securityManager && (
                    taskRunner.checkCommandSafety = (command, args) =>
                        securityManager.checkCommandSafety(command, args)
                );
                return taskRunner;
            },
            'commandExecutor': () => {
                const taskRunner = this.container.get('taskRunner');
                return {
                    async execute(command, args, options = {}) {
                        return taskRunner.run(command, args, options);
                    },
                    async executeCommand(argv = [], options = {}) {
                        return (Array.isArray(argv) && argv.length > 0)
                            ? taskRunner.run(argv[0], argv.slice(1), options)
                            : Promise.reject(new Error('Invalid command'));
                    }
                };
            },
            'settingsService': () => new MODULES.SettingsService({settingsManager: this.settingsManager}),
            'appSettingsService': () => new MODULES.AppSettingsService({
                logger: this.logger,
                currentDir,
                homeDir: GLib.get_home_dir()
            }),
            'restorePointService': () => {
                const settingsService = get('settingsService');
                return new MODULES.RestorePointService({
                    execAsync: this.container.get('execAsync'),
                    settingsService,
                    eventBus: this.eventBus,
                    logger: null,
                    scriptBuilder: MODULES.ScriptBuilder,
                    regenerateEffective: (themePath) => {
                        const settings = settingsService?.getAll?.() || {};
                        const parameterService = get('hyprlandParameterService');
                        const hotkeyService = get('hotkeyService');
                        parameterService?.writeEffectiveOverrides?.(themePath, settings, {skipMainConfigPatch: true});
                        hotkeyService?.writeEffectiveOverrides?.(themePath, settings, {skipMainConfigPatch: true});
                    }
                });
            },
            'dependencyIsolationService': () => new MODULES.DependencyIsolationService({
                execAsync: this.container.get('execAsync'),
                legacySettingsStorage: get('legacySettingsStorage'),
                logger: this.logger,
                commands: MODULES.Commands
            }),
            'themeCacheService': () => {
                const settingsService = get('settingsService');
                return new MODULES.ThemeCacheService(settingsService);
            },
            'serverEditHttpService': () => new MODULES.ServerEditHttpService(),
            'distributionService': () => new MODULES.DistributionService(),
            'desktopShellService': () => new MODULES.DesktopShellService(),
            'commandExecutionService': () => new MODULES.CommandExecutionService(),
            'networkThemeService': () => {
                const settingsService = get('settingsService');
                const themeCacheService = get('themeCacheService');
                return new MODULES.NetworkThemeService(settingsService, themeCacheService);
            },
            'themeRepository': () => {
                const repository = new MODULES.ThemeRepository(null, get('translator'));
                const networkThemeService = get('networkThemeService');
                const eventBus = get('eventBus');

                networkThemeService && repository.setNetworkThemeService(networkThemeService);
                eventBus && repository.setEventBus(eventBus);

                return repository;
            },
            'hyprlandParameterService': () => new MODULES.HyprlandParameterService({
                logger: this.logger,
                themeRepository: get('themeRepository'),
                settingsManager: this.settingsManager
            }),
            'hotkeyService': () => new MODULES.HotkeyService({
                logger: this.logger,
                themeRepository: get('themeRepository'),
                settingsManager: this.settingsManager
            }),
            'hyprlandOverridePopup': () => new MODULES.HyprlandOverridePopup({
                t: get('translator'),
                parameterService: get('hyprlandParameterService'),
                hotkeyService: get('hotkeyService'),
                themeRepository: get('themeRepository'),
                settingsManager: this.settingsManager,
                eventBus: this.eventBus,
                logger: this.logger
            }),
            'themeInstallationService': () => new MODULES.ThemeInstallationService({
                logger: this.logger,
                taskRunner: get('taskRunner'),
                securityManager: get('securityManager'),
                eventBus: this.eventBus,
                notifier: get('notifier'),
                settingsService: get('settingsService')
            }),
            'applyThemeUseCase': () => new MODULES.ApplyTheme(
                get('themeRepository'),
                this.container.get('commandExecutor'),
                this.logger,
                this.eventBus,
                this.container.get('notifier'),
                get('settingsService'),
                get('themeInstallationService'),
                get('soundService'),
                this.container
            ),
            'installThemeUseCase': () => new MODULES.InstallTheme(
                get('networkThemeService'),
                get('settingsService'),
                get('soundService'),
                this.logger,
                get('eventBus'),
                get('applyThemeUseCase'),
                get('themeRepository'),
                get('execAsync')
            ),
            'uploadThemeUseCase': () => new MODULES.UploadThemeUseCase(
                this.container.get('settingsService'),
                this.logger,
                this.container.get('notifier'),
                get('translator')
            ),
            'checkForUpdatesUseCase': () => new MODULES.CheckForUpdatesUseCase(
                this.container.get('settingsService'),
                this.container.get('networkThemeService'),
                this.container.get('version')
            ),
            'downloadRiceUseCase': () => new MODULES.DownloadRiceUseCase(
                get('networkThemeService'),
                get('settingsService'),
                get('soundService'),
                this.logger,
                get('eventBus'),
                get('applyThemeUseCase'),
                get('themeRepository'),
                get('execAsync')
            ),
            'loadNetworkThemesUseCase': () => new MODULES.LoadNetworkThemes(
                this.container.get('themeRepository'),
                this.container.get('settingsService'),
                this.logger,
                this.eventBus
            ),
            'fixHyprlandUseCase': () => new MODULES.FixHyprlandUseCase(this.container),
            'themeSelectorStore': () => new MODULES.ThemeSelectorStore(),
            'themeSelectorController': () => {
                const store = this.container.get('themeSelectorStore');
                return new MODULES.ThemeSelectorController(store, {
                    themeRepository: get('themeRepository'),
                    applyThemeUseCase: get('applyThemeUseCase'),
                    installThemeUseCase: get('installThemeUseCase'),
                    networkThemeService: get('networkThemeService'),
                    logger: this.logger,
                    eventBus: this.eventBus,
                    notifier: this.container.get('notifier'),
                    settingsService: get('settingsService'),
                    appSettingsService: get('appSettingsService'),
                    soundService: get('soundService'),
                    downloadRiceUseCase: get('downloadRiceUseCase'),
                    loadNetworkThemesUseCase: get('loadNetworkThemesUseCase'),
                    uploadThemeUseCase: get('uploadThemeUseCase'),
                    translator: get('translator'),
                    checkForUpdatesUseCase: get('checkForUpdatesUseCase'),
                    loadAppSettingsUseCase: get('loadAppSettingsUseCase'),
                    container: this.container
                });
            },
            'themeSelectorView': () => {
                const controller = this.container.get('themeSelectorController');
                const view = new MODULES.ThemeSelectorView(controller);
                controller?.setView?.(view);
                return view;
            },
            'updateHyprlandCheckpointUseCase': () => {
                const restorePointService = get('restorePointService');
                const runBackup = restorePointService ?
                    (dir) => restorePointService.backupHyprland(dir) : null;
                const updateScript = restorePointService ?
                    (folders) => restorePointService.updateBackupScript(folders) : null;
                return new MODULES.UpdateHyprlandCheckpointUseCase({
                    execAsync: this.container.get('execAsync'),
                    runEmbeddedFindAndBackupHyprland: runBackup,
                    updateBackupScript: updateScript,
                    restorePointService: restorePointService,
                    logger: this.logger
                });
            },
            'tweaksStore': () => new MODULES.TweaksStore(this.container, MODULES.Tweaks)
        };

        for (const [name, factory] of Object.entries(services)) {
            this.container.singleton(name, factory);
        }

        this.container.singleton('translationService', () => new MODULES.TranslationService({diContainer: this.container}));

        this.container.singleton('translator', (container) => {
            return container.get('translationService')?.getTranslator?.() || ((k) => k);
        });

        this.container.value('PerformanceStatsReporter', MODULES.PerformanceStatsReporter);

        this.notifier = get('notifier');

        this.eventBus && get('logger') && this.eventBus.setLogger?.(get('logger'));

        get('translationService')?.setDependencies?.(this.container, get('settingsService'));
        this.settingsManager?.setTranslationFunction?.(get('translator'));

        this.container.singleton('AppSettings', () => MODULES.AppSettings);
        this.container.value('SettingsManager', this.settingsManager);
        this.container.value('settingsManager', this.settingsManager);

        this.container.singleton('appSettingsRepository', (container) =>
            new MODULES.AppSettingsRepository(container));

        this.container.singleton('loadAppSettingsUseCase', (container) =>
            new MODULES.LoadAppSettings(container));

        this.container.singleton('storeAppSettingsUseCase', (container) =>
            new MODULES.StoreAppSettings(container));

        this.container.singleton('resetAppSettingsUseCase', (container) =>
            new MODULES.ResetAppSettings(container));

        this.container.singleton('appSettingsStore', (container) =>
            new MODULES.AppSettingsStore(container));

        this.container.singleton('AppSettingsView', () => MODULES.AppSettingsView);

        this.container.value('AppSettingsCompat', MODULES.AppSettingsCompat);
        this.container.value('SettingsTab', MODULES.SettingsTab);
        this.container.value('AdvancedTab', MODULES.AdvancedTab);
        this.container.value('HyprlandTab', MODULES.HyprlandTab);
        this.container.value('StartPointTab', MODULES.StartPointTab);
        this.container.value('HelpTab', MODULES.HelpTab);
        this.container.value('AboutTab', MODULES.AboutTab);
        this.container.value('ThemeAppsSection', MODULES.ThemeAppsSection);
        this.container.value('SecuritySection', MODULES.SecuritySection);
        this.container.value('HyprlandOverridePopup', MODULES.HyprlandOverridePopup);
        this.container.value('EventBindings', MODULES.EventBindings);
        this.container.value('createStateProxy', MODULES.createStateProxy);
        this.container.value('clonePlainObject', MODULES.clonePlainObject);
        this.container.value('makeRoundedPixbuf', MODULES.ViewUtils.makeRoundedPixbuf);
        this.container.value('BarRegistry', MODULES.BarRegistry);
        this.container.value('commands', MODULES.Commands);

        this.container.singleton('appSettingsController', () =>
            new MODULES.AppSettingsController(this.container));

        this.container.singleton('tweaksController', () =>
            new MODULES.TweaksController(this.container, MODULES.TweaksView, MODULES.Tweaks));

        this.container.transient('serverEditAuthView', () => new MODULES.ServerEditAuthView());
        this.container.transient('serverEditView', (container) => new MODULES.ServerEditView(container));
        this.container.transient('serverEditAuthController', (container) =>
            new MODULES.ServerEditAuthController(
                container.get('serverEditAuthView'),
                container.get('logger'),
                container.get('serverEditHttpService')
            ));
        this.container.transient('serverEditController', (container) =>
            new MODULES.ServerEditController(
                container.get('serverEditView'),
                container.get('eventBus'),
                container.get('logger'),
                container.get('serverEditHttpService')
            ));
        this.container.transient('startServerEditUseCase', (container) =>
            new MODULES.StartServerEditUseCase(
                container.get('serverEditAuthController'),
                container.get('serverEditController'),
                container.get('settingsService'),
                container.get('logger'),
                container.has('translator') ? container.get('translator') : null
            ));

        get('hyprlandParameterService')?.initialize?.();
    }

    async initializeEventBus() {
        const { Events } = MODULES;
        this.container.value('eventBus', this.eventBus);

        this.eventBus.emit(Events.APP_STARTED, {timestamp: Date.now()});
    }
}

export function applyAppInitialization(prototype) {
    copyPrototypeDescriptors(prototype, AppInitialization.prototype);
}
