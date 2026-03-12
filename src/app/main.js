#!/usr/bin/env -S gjs -m
import GLib from 'gi://GLib';
import GLibUnix from 'gi://GLibUnix';
import { MODULES } from './AppModules.js';
import { applyAppInstanceManager } from './AppInstanceManager.js';
import { applyAppOverrides } from './AppOverrides.js';
import { applyAppInitialization } from './AppInitialization.js';
import { applyAppRuntime } from './AppRuntime.js';
import { tryOrNullAsync } from '../infrastructure/utils/ErrorUtils.js';

export class LastLayerApp {
    constructor() {
        this.window = null;
        this.initialized = false;
        this.isWindowReady = false;
        this.M = MODULES;
        this.container = new MODULES.DIContainer();
        this.eventBus = new MODULES.EventBusClass();
        this.eventBus.Events = MODULES.Events;
        this.notifier = null;
        this.settingsManager = null;
        this.instancePidPath = null;
        this.commandListenerId = null;
        this.lockUpdaterId = null;
        this.lockFilePath = GLib.build_filenamev([GLib.get_user_cache_dir(), 'lastlayer_popup.lock']);
        this.commandFilePath = GLib.build_filenamev([GLib.get_user_cache_dir(), 'lastlayer_popup_command.txt']);
        this.commandQueueDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'lastlayer_popup_commands']);
        this.themeSelectorView = null;
        this.inboxWatcher = null;
    }
}

applyAppInstanceManager(LastLayerApp.prototype);
applyAppOverrides(LastLayerApp.prototype);
applyAppInitialization(LastLayerApp.prototype);
applyAppRuntime(LastLayerApp.prototype);

const app = new LastLayerApp();

function handleSignal(_signal) {
    app.shutdown();
}

GLibUnix?.signal_add && (() => {
    GLibUnix.signal_add(GLib.PRIORITY_HIGH, 2, () => {
        handleSignal('SIGINT');
        return false;
    });

    GLibUnix.signal_add(GLib.PRIORITY_HIGH, 15, () => {
        handleSignal('SIGTERM');
        return false;
    });
})();

const runApp = async () => {
    const started = await tryOrNullAsync('App.main.run', async () => {
        await app.run();
        return true;
    });

    if (started) {
        return;
    }

    app.shutdown();
};

runApp();
