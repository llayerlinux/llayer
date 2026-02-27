import {DEFAULT_BACKUP_FOLDERS} from '../../infrastructure/constants/BackupDefaults.js';
import {DEFAULT_DANGEROUS_PATTERNS} from '../../infrastructure/proc/SecurityDefaults.js';
import {SecurityManager} from '../../infrastructure/proc/SecurityManager.js';
import {applyAppSettingsViewActions} from './view/AppSettingsViewActions.js';
import {applyAppSettingsViewBuild} from './view/AppSettingsViewBuild.js';
import {applyAppSettingsViewCore} from './view/AppSettingsViewCore.js';
import {applyAppSettingsViewLifecycle} from './view/AppSettingsViewLifecycle.js';
import {applyAppSettingsViewSecurity} from './view/AppSettingsViewSecurity.js';
import {CORE_DEP_KEYS, EventBindingsStub, SECTION_CLASS_KEYS, TAB_CLASS_KEYS} from './view/AppSettingsViewConstants.js';

export class AppSettingsView {
    constructor(container, controller) {
        this.container = container;
        this.controller = controller;
        this.store = container.get('appSettingsStore');
        this.widgets = {};

        const get = (key, defaultValue = null) => container.has(key) ? container.get(key) : defaultValue;

        this.bus = get('eventBus');
        const EventBindings = get('EventBindings', EventBindingsStub);
        this.eventBindings = new EventBindings(this.bus);
        this.updatingFromStore = false;

        this.themeRepository = get('themeRepository');
        const LegacySettingsStorage = get('LegacySettingsStorage');
        this.legacyStorage = get('legacySettingsStorage') || (LegacySettingsStorage ? new LegacySettingsStorage(container) : null);

        const AppSettingsCompatClass = get('AppSettingsCompat');
        this.compat = AppSettingsCompatClass
            ? new AppSettingsCompatClass({legacyStorage: this.legacyStorage, container})
            : {
                composeSnapshot: (s) => s,
                syncGlobals: () => {},
                captureState: () => ({}),
                restoreState: () => {},
                setupLegacyEnvironment: () => ({translator: (k) => k, translations: {}})
            };

        const createStateProxy = get('createStateProxy', (t) => t);
        this.clonePlainObject = get('clonePlainObject', (v) => JSON.parse(JSON.stringify(v ?? {})));

        this.formState = {};
        this.settingsProxy = createStateProxy(this.formState, () => this.onFormStateUpdated());
        this.initialFormState = {};
        this.initialCompatibilitySnapshot = null;

        [this.SettingsTab, this.AdvancedTab, this.HyprlandTab, this.StartPointTab, this.HelpTab, this.AboutTab] =
            TAB_CLASS_KEYS.map(k => get(k));

        [this.ThemeAppsSection, this.SecuritySection] = SECTION_CLASS_KEYS.map(k => get(k));
        [this.mainWindow, this.BarRegistry, this.makeRoundedPixbuf, this.loadStartupData, this.playSound] =
            CORE_DEP_KEYS.map(k => get(k));

        this.getSystemGtkThemesGlobal = get('getSystemGtkThemes');
        this.readBackupFolders = get('readBackupFolders', () => {
            const stored = this.store?.snapshot?.settings?.backupFolders;
            return (Array.isArray(stored) && stored.length) ? [...stored] : [...DEFAULT_BACKUP_FOLDERS];
        });
        this.readExcludedBackupFolders = get('readExcludedBackupFolders', () => {
            const stored = this.store?.snapshot?.settings?.excludedBackupFolders;
            return Array.isArray(stored) ? [...stored] : [];
        });
        this.createStartPointUpdateScript = get('createStartPointUpdateScript', () => '');
        this.isUpdateVersionIgnored = get('isUpdateVersionIgnored', () => false);
        this.loadDefaultDangerousPatterns = get('loadDefaultDangerousPatterns', () => [...DEFAULT_DANGEROUS_PATTERNS]);
        this.getCriticalPatterns = get('getCriticalPatterns', () => {
            const sm = container.has('securityManager') ? container.get('securityManager') : new SecurityManager(null);
            return (sm?.criticalDangerousPatterns ?? [])
                .map((p) => p?.source || null)
                .filter((v) => typeof v === 'string' && v.length > 0);
        });

        this.tabs = {};
        this.sections = {};

        this.securityBuffer = null;
        this.exceptionsBuffer = null;

        this.tempBackupFolders = null;
        this.tempExcludedFolders = null;

        this.dialog = this.build();
        this.initialFormState = this.clonePlainObject(this.formState);
        this.initialCompatibilitySnapshot = this.compat.captureState();
        this.subscribeToEvents();
    }
}

const APP_SETTINGS_VIEW_MIXINS = [
    applyAppSettingsViewCore,
    applyAppSettingsViewBuild,
    applyAppSettingsViewSecurity,
    applyAppSettingsViewActions,
    applyAppSettingsViewLifecycle
];

APP_SETTINGS_VIEW_MIXINS.forEach((applyMixin) => applyMixin(AppSettingsView.prototype));
