#!/usr/bin/env -S gjs -m
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import System from 'system';
import { tryOrDefault, tryOrNullAsync, tryRun } from '../utils/ErrorUtils.js';

const prependEnvPath = (name, value) => {
    if (!value) return;
    const current = GLib.getenv(name);
    if (!current || current.length === 0) {
        GLib.setenv(name, value, true);
        return;
    }
    const parts = current.split(':');
    if (parts.includes(value)) return;
    GLib.setenv(name, `${value}:${current}`, true);
};

const resolveRuntimePaths = () => {
    const scriptPath = Gio.File.new_for_uri(import.meta.url).get_path();
    const inboxDir = GLib.path_get_dirname(scriptPath);
    const infraDir = GLib.path_get_dirname(inboxDir);
    const srcDir = GLib.path_get_dirname(infraDir);
    const rootDir = GLib.path_get_dirname(srcDir);
    const supporterDir = GLib.build_filenamev([srcDir, 'supporter']);
    return { rootDir, supporterDir };
};

const parseJsonObject = (value, fallback = null) => {
    const parsed = tryOrDefault('InboxUnifyWorker.parseJsonObject', () => JSON.parse(value), fallback);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
};

const setupSupporterRuntime = async (supporterDir) => {
    if (!GLib.file_test(supporterDir, GLib.FileTest.IS_DIR)) return;

    prependEnvPath('GI_TYPELIB_PATH', supporterDir);
    prependEnvPath('LD_LIBRARY_PATH', supporterDir);

    await tryOrNullAsync('InboxUnifyWorker.setupSupporterRuntime', async () => {
        const GIRepository = (await import('gi://GIRepository')).default;
        GIRepository.Repository.prepend_search_path(supporterDir);
        GIRepository.Repository.prepend_library_path(supporterDir);
        return true;
    });
};

const parsePayload = () => {
    if (!ARGV || ARGV.length === 0) return null;
    if (ARGV.length >= 2) {
        const rawOptions = ARGV.length >= 3 ? ARGV[2] : '';
        const options = rawOptions ? parseJsonObject(rawOptions, {}) : {};
        return { themePath: ARGV[0], themeName: ARGV[1], options };
    }
    const payload = parseJsonObject(ARGV[0], null);
    if (!payload) {
        return null;
    }

    if (payload.optionsStr && (!payload.options || typeof payload.options !== 'object')) {
        payload.options = parseJsonObject(payload.optionsStr, {});
    }

    if (!payload.options || typeof payload.options !== 'object' || Array.isArray(payload.options)) {
        payload.options = {};
    }

    return payload;
};

const ensureCommandQueueDir = (dirPath) => {
    tryRun('InboxUnifyWorker.ensureCommandQueueDir', () => {
        GLib.mkdir_with_parents(dirPath, parseInt('0755', 8));
    });
};

const enqueueCommand = (command) => {
    if (!command) return false;
    const queueDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'lastlayer_popup_commands']);
    ensureCommandQueueDir(queueDir);
    const id = typeof GLib.uuid_string_random === 'function'
        ? GLib.uuid_string_random()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const filename = `${Date.now()}-${id}.cmd`;
    const filePath = GLib.build_filenamev([queueDir, filename]);
    return tryRun('InboxUnifyWorker.enqueueCommand', () => {
        GLib.file_set_contents(filePath, command);
    });
};

const createProxyEventBus = () => ({
    emit: (event, data) => {
        switch (event) {
            case 'wm.conversion.start':
                enqueueCommand(`wm_conversion_start:${JSON.stringify(data || {})}`);
                return;
            case 'wm.conversion.complete':
                enqueueCommand(`wm_conversion_complete:${JSON.stringify(data || {})}`);
                return;
            default:
                return;
        }
    },
    on: () => 0,
    off: () => {}
});

const main = async () => {
    const paths = resolveRuntimePaths();
    tryRun('InboxUnifyWorker.chdir', () => GLib.chdir(paths.rootDir));
    await setupSupporterRuntime(paths.supporterDir);

    const [{ ThemeUnifier }, { SettingsManager }, { HyprlandParameterService }] = await Promise.all([
        import('../unifier/index.js'),
        import('../settings/SettingsManager.js'),
        import('../hyprland/HyprlandParameterService.js')
    ]);

    const payload = parsePayload();
    const themePath = payload?.themePath;
    const themeName = payload?.themeName;
    const unifyOptions = payload?.options && typeof payload.options === 'object' && !Array.isArray(payload.options)
        ? payload.options
        : {};

    if (!themePath || !themeName) {
        printerr('[InboxUnifyWorker] Missing themePath/themeName');
        System.exit(1);
    }

    const settingsManager = new SettingsManager({ eventBus: null });
    const settings = settingsManager.load();

    const proxyEventBus = createProxyEventBus();

    const unifier = new ThemeUnifier({
        logger: null,
        eventBus: proxyEventBus,
        settingsManager,
        getPreviewSource: () => settings?.previewSource || 'auto'
    });

    const unifyResult = await unifier.unify(themePath, themeName, {
        inPlace: true,
        ...unifyOptions,
    });
    if (!unifyResult.success) {
        printerr(`[InboxUnifyWorker] Unification failed: ${unifyResult.error || 'unknown error'}`);
        System.exit(2);
    }

    tryRun('InboxUnifyWorker.applyOverrides', () => {
        const parameterService = new HyprlandParameterService({
            logger: null,
            settingsManager
        });
        if (typeof parameterService?.processThemeAfterInstall === 'function') {
            parameterService.processThemeAfterInstall(themePath, settings);
        }
    }) || printerr('[InboxUnifyWorker] Overrides warning: failed to apply');

    enqueueCommand(`theme_updated:${themeName}`);
};

main().then(undefined, (e) => {
    printerr(`[InboxUnifyWorker] Error: ${e?.message || e}`);
    System.exit(1);
});
