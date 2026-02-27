import GLib from 'gi://GLib';
import {applyRestorePointServiceStatePaths} from './RestorePointServiceStatePaths.js';
import {applyRestorePointServiceStateStore} from './RestorePointServiceStateStore.js';
import {applyRestorePointServiceOperationsPoints} from './RestorePointServiceOperationsPoints.js';
import {applyRestorePointServiceOperationsScripts} from './RestorePointServiceOperationsScripts.js';
import {applyRestorePointServiceOperationsRuntime} from './RestorePointServiceOperationsRuntime.js';

export class RestorePointService {
    constructor({execAsync = null, settingsService = null, eventBus = null, logger = null, scriptBuilder = null, regenerateEffective = null} = {}) {
        this.execAsync = execAsync;
        this.settingsService = settingsService;
        this.eventBus = eventBus;
        this.logger = logger;
        this.scriptBuilder = scriptBuilder;
        this.regenerateEffective = regenerateEffective;

        this.homeDir = GLib.get_home_dir();
        this.prefDir = `${this.homeDir}/.config/lastlayer_pref`;
        this.scriptDir = `${this.homeDir}/.config/lastlayer/scripts`;
        this.defaultThemeDir = this.getDefaultThemeDir();
        this.updateScriptPath = `${this.scriptDir}/start_point_update.sh`;
        this.restorePointsMetaPath = `${this.prefDir}/restore_points.json`;
        this.debugLogPath = GLib.build_filenamev([GLib.get_user_cache_dir(), 'lastlayer', 'restore_point.log']);

        this.ensureDir(this.prefDir);
        this.ensureDir(this.getThemesBasePath());
        this.ensureDir(this.defaultThemeDir);
    }
}

const RESTORE_POINT_SERVICE_MIXINS = [
    applyRestorePointServiceStatePaths,
    applyRestorePointServiceStateStore,
    applyRestorePointServiceOperationsPoints,
    applyRestorePointServiceOperationsScripts,
    applyRestorePointServiceOperationsRuntime
];

RESTORE_POINT_SERVICE_MIXINS.forEach((applyMixin) => applyMixin(RestorePointService.prototype));
