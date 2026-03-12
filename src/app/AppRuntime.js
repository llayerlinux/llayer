import {copyPrototypeDescriptors} from '../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=3.0';
import { MODULES } from './AppModules.js';
import { tryOrNull, tryOrNullAsync, tryRun } from '../infrastructure/utils/ErrorUtils.js';

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
        this.stopInboxWatcher();
        this.supporterAuditLog?.shutdown();
        this.stopLockUpdater();
        this.removeLockFile();
        this.cleanupSupporterFiles();

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
        if (hasExistingInstance && labels.detected) {
            this.debugStartup(labels.detected);
        }
        if (!hasExistingInstance && toggled && labels.falsePositive) {
            this.debugStartup(labels.falsePositive);
        }
        return hasExistingInstance;
    }

    ensureRuntimeLock(existingInstanceCommand) {
        const lockCreated = this.createLockFile();
        this.debugStartup('run:lock-created', {lockCreated});
        if (lockCreated) {
            return true;
        }

        GLib.usleep(200000);
        const shouldExitAfterWait = this.shouldExitForExistingInstance(existingInstanceCommand, {
            detected: 'run:existing-instance-toggled-after-wait',
            falsePositive: 'run:toggle-after-wait-false-positive'
        });
        if (shouldExitAfterWait) {
            return false;
        }

        this.removeLockFile();
        if (this.createLockFile()) {
            return true;
        }

        this.debugStartup('run:lock-failed-after-cleanup');
        return false;
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
        await this.loadSupporterModules();
        this.debugStartup('run:ui:supporter-checked');
        await this.runMainThemeSelector();
        this.debugStartup('run:ui:view-ready');
        this.startCommandListener();
        this.startLockUpdater();
        this.writeInstancePid();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            this.startInboxWatcher();
            return GLib.SOURCE_REMOVE;
        });
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


    async loadSupporterModules() {
        const currentDir = this.container?.get?.('currentDir') ?? GLib.get_current_dir();
        const supporterDir = GLib.build_filenamev([currentDir, 'src', 'supporter']);

        const loaded =
            await this.tryLoadSupporterSharedLibrary(currentDir, supporterDir) ||
            await this.tryLoadSupporterResourceBundle(currentDir, supporterDir) ||
            await this.tryLoadSupporterJavaScriptModules(currentDir, supporterDir);

        if (!loaded) {
            this.debugStartup('supporter:not-found');
            return;
        }

        if (GLib.getenv('LASTLAYER_AUDIT') === '1') {
            const auditModule = await tryOrNullAsync(
                'AppRuntime.loadSupporterModules.audit',
                () => import('../infrastructure/audit/SupporterAuditLog.js')
            );
            if (auditModule?.SupporterAuditLog) {
                const { SupporterAuditLog } = auditModule;
                this.supporterAuditLog = new SupporterAuditLog();
                this.container.value('supporterAuditLog', this.supporterAuditLog);
                this.debugStartup('supporter:audit-enabled', { logPath: this.supporterAuditLog.logPath });
            } else {
                this.debugStartup('supporter:audit-failed');
            }
        }
    }

    async tryLoadSupporterSharedLibrary(currentDir, supporterDir) {
        const soPath = GLib.build_filenamev([supporterDir, 'liblastlayer-supporter-1.0.so']);
        const typelibPath = GLib.build_filenamev([supporterDir, 'LastlayerSupporter-1.0.typelib']);

        if (!Gio.File.new_for_path(soPath).query_exists(null) ||
            !Gio.File.new_for_path(typelibPath).query_exists(null)) {
            return false;
        }

        const loaded = await tryOrNullAsync('AppRuntime.tryLoadSupporterSharedLibrary', async () => {
            const GIRepository = (await import('gi://GIRepository')).default;
            GIRepository.Repository.prepend_search_path(supporterDir);
            GIRepository.Repository.prepend_library_path(supporterDir);

            const LastlayerSupporter = (await import('gi://LastlayerSupporter?version=1.0')).default;
            LastlayerSupporter.Resources.extract(currentDir);
            this._supporterExtractedFromBinary = true;
            this._supporterExtractedFiles = LastlayerSupporter.Resources.get_files();
            this._supporterLib = LastlayerSupporter;
            this.debugStartup('supporter:so-extracted', {
                version: LastlayerSupporter.Resources.get_version(),
                files: LastlayerSupporter.Resources.get_file_count(),
            });

            return await this.importSupporterModuleBarrel(currentDir);
        });
        if (loaded !== null) return loaded;

        this.debugStartup('supporter:so-failed');
        return false;
    }

    async tryLoadSupporterResourceBundle(currentDir, supporterDir) {
        const gresourcePath = GLib.build_filenamev([supporterDir, 'supporter.gresource']);
        if (!Gio.File.new_for_path(gresourcePath).query_exists(null)) {
            return false;
        }

        const loaded = await tryOrNullAsync('AppRuntime.tryLoadSupporterResourceBundle', async () => {
            const resource = Gio.Resource.load(gresourcePath);
            Gio.resources_register(resource);
            this._supporterResource = resource;

            const children = resource.enumerate_children('/com/lastlayer/supporter', 0);
            this.extractSupporterResourceFiles(resource, '/com/lastlayer/supporter/', currentDir, children);
            this._supporterExtractedFromBinary = true;
            this.debugStartup('supporter:gresource-extracted');

            return await this.importSupporterModuleBarrel(currentDir);
        });
        if (loaded !== null) return loaded;

        this.debugStartup('supporter:gresource-failed');
        return false;
    }

    extractSupporterResourceFiles(resource, prefix, basePath, children) {
        const extractedPaths = [];
        for (const child of children) {
            const resourcePath = `${prefix}${child}`;
            const subChildren = tryOrNull(
                'AppRuntime.extractSupporterResourceFiles.enumerate',
                () => resource.enumerate_children(resourcePath, 0)
            );
            if (subChildren) {
                this.extractSupporterResourceFiles(resource, `${resourcePath}/`, basePath, subChildren);
                continue;
            }

            const extractedPath = tryOrNull('AppRuntime.extractSupporterResourceFiles.file', () => {
                const data = resource.lookup_data(resourcePath, 0);
                const relativePath = resourcePath.replace('/com/lastlayer/supporter/', '');
                const targetPath = GLib.build_filenamev([basePath, relativePath]);

                const parentDir = GLib.path_get_dirname(targetPath);
                GLib.mkdir_with_parents(parentDir, 0o755);

                const file = Gio.File.new_for_path(targetPath);
                const outputStream = file.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
                outputStream.write_bytes(data, null);
                outputStream.close(null);
                return relativePath;
            });
            extractedPath && extractedPaths.push(extractedPath);
        }
        if (!this._supporterExtractedFiles) this._supporterExtractedFiles = [];
        this._supporterExtractedFiles.push(...extractedPaths);
    }

    async tryLoadSupporterJavaScriptModules(currentDir, supporterDir) {
        const supporterPath = GLib.build_filenamev([supporterDir, 'SupporterModules.js']);
        if (!Gio.File.new_for_path(supporterPath).query_exists(null)) {
            return false;
        }

        const loaded = await tryOrNullAsync(
            'AppRuntime.tryLoadSupporterJavaScriptModules',
            () => this.importSupporterModuleBarrel(currentDir)
        );
        if (loaded !== null) return loaded;

        this.debugStartup('supporter:js-failed');
        return false;
    }

    async importSupporterModuleBarrel(currentDir) {
        const barrelPath = GLib.build_filenamev([currentDir, 'src', 'supporter', 'SupporterModules.js']);
        const barrelFile = Gio.File.new_for_path(barrelPath);

        const supporterModules = await import(barrelFile.get_uri());
        Object.assign(MODULES, supporterModules);
        this.supporterProvider.setModules(supporterModules);
        this.debugStartup('supporter:loaded', {
            modules: Object.keys(supporterModules).length,
            source: this._supporterExtractedFromBinary ? 'binary' : 'js',
        });

        supporterModules.OverrideTab && this.container.value('OverrideTab', supporterModules.OverrideTab);
        supporterModules.ImportTab && this.container.value('ImportTab', supporterModules.ImportTab);
        supporterModules.SystemTab && this.container.value('SystemTab', supporterModules.SystemTab);
        supporterModules.DebugTab && this.container.value('DebugTab', supporterModules.DebugTab);
        return true;
    }

    cleanupSupporterFiles() {
        if (!this._supporterExtractedFromBinary) return;
        const currentDir = this.container?.get?.('currentDir') ?? GLib.get_current_dir();

        if (this._supporterLib?.Resources?.cleanup) {
            tryRun('supporter:cleanup-native', () => this._supporterLib.Resources.cleanup(currentDir));
        }

        if (!this._supporterLib?.Resources?.cleanup) {
            if (!this._supporterExtractedFiles) {
                this._supporterExtractedFiles = null;
                this.debugStartup('supporter:cleanup-done');
                return;
            }

            for (const relPath of this._supporterExtractedFiles) {
                tryRun('supporter:cleanup', () => {
                    const filePath = GLib.build_filenamev([currentDir, relPath]);
                    const file = Gio.File.new_for_path(filePath);
                    file.query_exists(null) && file.delete(null);
                });
            }
        }
        this._supporterExtractedFiles = null;
        this.debugStartup('supporter:cleanup-done');
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
    startInboxWatcher() {
        if (this.inboxWatcher) return;
        const get = (name) => (this.container.has(name) ? this.container.get(name) : null);
        const InboxWatcherService = MODULES.InboxWatcherService;
        if (!InboxWatcherService) return;

        const currentDir = this.container.get('currentDir');
        const workerScriptPath = GLib.build_filenamev([currentDir, 'src', 'infrastructure', 'inbox', 'InboxUnifyWorker.js']);

        this.inboxWatcher = new InboxWatcherService({
            logger: null,
            eventBus: this.eventBus,
            notifier: get('notifier'),
            themeRepository: get('themeRepository'),
            settingsManager: this.settingsManager,
            parameterService: get('hyprlandParameterService'),
            commandWriter: (command) => this.enqueueCommand?.(command),
            workerScriptPath,
            useWorker: true,
            maxRetries: 5,
            stabilityRequiredChecks: 8,
            isSupporterActive: () => this.supporterProvider?.isActive() ?? true,
            getDisabledMessage: () => {
                const t = this.container?.has?.('translationService')
                    ? this.container.get('translationService')
                    : null;
                return t?.translate?.('SUPPORTER_IMPORT_REQUIRED')
                    || 'Для импорта через расширение и унификацию требуется Supporter режим';
            }
        });

        this.inboxWatcher.start();

        if (!this._supporterToggleWatcherBound && this.supporterProvider?.onToggle) {
            this._supporterToggleWatcherBound = true;
            this.supporterProvider.onToggle(() => {
                if (!this.inboxWatcher) return;
                this.inboxWatcher.stop();
                this.inboxWatcher.start();
            });
        }
    }

    stopInboxWatcher() {
        this.inboxWatcher?.stop?.();
        this.inboxWatcher = null;
    }
}

export function applyAppRuntime(prototype) {
    copyPrototypeDescriptors(prototype, AppRuntime.prototype);
}
