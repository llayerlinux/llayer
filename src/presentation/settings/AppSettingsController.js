import GLib from 'gi://GLib';
import { getFromContainer, firstNonEmptyString, snapshotsEqual, parseThemesPath } from '../../infrastructure/utils/Utils.js';
import { AppSettingsView } from './AppSettingsView.js';
import { Events } from '../../app/eventBus.js';

export class AppSettingsController {
    constructor(container) {
        this.container = container;

        this.bus = getFromContainer(container, 'eventBus');

        this.store = getFromContainer(container, 'appSettingsStore');
        this.logger = getFromContainer(container, 'logger');
        this.notifier = getFromContainer(container, 'notifier');
        this.settingsService = getFromContainer(container, 'settingsService');
        this.themeRepository = getFromContainer(container, 'themeRepository');
        this.soundService = getFromContainer(container, 'soundService');
        this.settingsManager = getFromContainer(container, 'settingsManager');
        this.applyGtkThemeUseCase = getFromContainer(container, 'applyGtkThemeUseCase');

        this.loadUC = getFromContainer(container, 'loadAppSettingsUseCase');
        this.storeUC = getFromContainer(container, 'storeAppSettingsUseCase');
        this.resetUC = getFromContainer(container, 'resetAppSettingsUseCase');
        this.updateCheckpointUC = getFromContainer(container, 'updateHyprlandCheckpointUseCase');
        this.applyThemeUC = getFromContainer(container, 'applyThemeUseCase');
        this.dependencyIsolationService = getFromContainer(container, 'dependencyIsolationService');

        this.opening = false;
        this.pendingTheme = null;
        this.lastAppliedThemeSnapshot = null;
        this.baselineSettingsSnapshot = null;

        this.bus?.on(Events.APPSETTINGS_OPEN, () => this.open());
        this.bus?.on(Events.APPSETTINGS_COMMIT_REQUESTED, () => this.commit());
        this.bus?.on(Events.APPSETTINGS_RESET_REQUESTED, () => this.reset());
        this.bus?.on(Events.APPSETTINGS_CLOSE_REQUESTED, () => this.close());

        this.bus?.on(Events.APPSETTINGS_LOADED, (settings) => {
            this.handleSettingsApplied(settings);
        });
        this.bus?.on(Events.APPSETTINGS_COMMITTED, (payload) => {
            const settings = this.extractCommittedSettings(payload);
            this.handleSettingsApplied(settings);
        });
    }

    extractCommittedSettings(payload) {
        if (!payload || typeof payload !== 'object') return payload;
        return Object.prototype.hasOwnProperty.call(payload, 'settings')
            ? payload.settings
            : payload;
    }

    handleSettingsApplied(settings) {
        this.updateBaseline(settings);
        this.applyGtkTheme(settings);
        this.applySoundPreference(settings);
    }

    emitRestorePointUpdates(timestamp, updatedSettings) {
        const emitter = 'AppSettingsController';
        this.bus?.emit(Events.APPSETTINGS_COMMITTED, { settings: updatedSettings, emitter });
        this.bus?.emit(Events.APPSETTINGS_CHANGED, { settings: updatedSettings, emitter });
        this.bus?.emit(Events.APPSETTINGS_RESTOREPOINT_DISPLAY, { timestamp, emitter });
    }

    async updateCheckpoint({ folders = [], theme = null } = {}) {
        const effectiveTheme = theme || this.settingsService?.getCurrentTheme?.() || null;
        const result = await this.updateCheckpointUC.execute({ folders, theme: effectiveTheme });
        const checkpointStamp = firstNonEmptyString(result?.lastUpdate, this.getRestorePointLastUpdate());

        result && typeof result === 'object' && (result.lastUpdate = checkpointStamp || null);
        checkpointStamp && this.settingsService?.setRestorePointLastUpdate(checkpointStamp);

        if (checkpointStamp && this.store) {
            this.emitRestorePointUpdates(checkpointStamp, this.store.patch({ restore_point_last_update: checkpointStamp }));
        } else {
            const latest = firstNonEmptyString(this.getRestorePointLastUpdate());
            latest && this.bus?.emit(Events.APPSETTINGS_RESTOREPOINT_DISPLAY, { timestamp: latest, emitter: 'AppSettingsController' });
        }

        result && this.applyThemeUC && await this.applyThemeUC.execute('default');
        return result;
    }

    getRestorePointLastUpdate() {
        return firstNonEmptyString(
            this.settingsService?.getRestorePointLastUpdate() ?? null,
            this.store?.snapshot?.settings?.restore_point_last_update
        );
    }

    effectiveSettings(settings) {
        return settings && typeof settings === 'object' ? settings : (this.store?.snapshot?.settings || null);
    }

    getThemesPath(settings) {
        return this.parseThemesPath(settings?.localThemesPath);
    }

    parseThemesPath(path) {
        return parseThemesPath(path, GLib.get_home_dir());
    }

    async loadThemesFromRepository(path) {
        const normalized = this.parseThemesPath(path);
        typeof this.themeRepository.basePath === 'string' && this.themeRepository.basePath !== normalized && (this.themeRepository.basePath = normalized);

        const themes = await this.themeRepository.getLocalThemes();
        return Array.isArray(themes) && themes.length ? themes.filter(t => t && t.name !== 'default') : null;
    }

    getSkipInstallList(settings = null) {
        const firstList = [
            this.settingsService?.getSkipList?.(),
            this.effectiveSettings(settings)?.skip_install_theme_apps
        ].find((list) => Array.isArray(list));
        return firstList ? [...firstList] : [];
    }

    async open() {
        if (this.opening) return;
        this.opening = true;

        this.loadUC && this.loadUC.execute()
            .then(() => this.view?.syncFromStore?.())
            .catch((e) => this.err('Load', e));

        this.view = new (getFromContainer(this.container, 'AppSettingsView') || AppSettingsView)(this.container, this);

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.view.present();
            return GLib.SOURCE_REMOVE;
        });

        this.opening = false;
    }

    async commit(options = {}) {
        const snapshot = this.store?.snapshot?.settings;
        if (!snapshot) return;

        const updates = this.createWritableSettings(snapshot);
        this.settingsManager.update(updates);

        this.settingsManager.write(null, { silent: false, force: true })
            && this.bus?.emit(Events.APPSETTINGS_COMMITTED, { settings: this.settingsManager.getAll() });
    }

    async reset() {
        await this.resetUC.execute();
    }

    setPatch(patch, options = {}) {
        const prev = this.store?.snapshot?.settings || null;
        const updated = this.store.patch(patch);

        const diffOverride = options && typeof options === 'object' ? options.diffOverride : null;
        diffOverride && getFromContainer(this.container, 'themeSelectorController')?.setSettingsRefreshOverride?.({
            languageChanged: !!diffOverride.languageChanged,
            themeChanged: !!diffOverride.themeChanged
        });

        if (prev && updated && snapshotsEqual(
            this.createComparisonSnapshot(prev),
            this.createComparisonSnapshot(updated)
        )) return updated;

        this.applySoundPreference(updated);
        this.bus?.emit(Events.APPSETTINGS_CHANGED, updated);
        return updated;
    }

    close() {
        this.view?.close?.();
        this.view = null;
    }

    createWritableSettings(snapshot) {
        const updates = (snapshot && typeof snapshot === 'object') ? {...snapshot} : {};

        for (const key of ['theme', 'hyprlandOverrides', 'hotkeyOverrides']) {
            const value = this.settingsManager?.get(key);
            value !== undefined && (updates[key] = value);
        }

        return updates;
    }

    ensureThemeApplied() {
        if (!this.pendingTheme || !this.applyGtkThemeUseCase) return;
        const pending = this.pendingTheme;
        this.pendingTheme = null;
        this.applyGtkThemeUseCase.execute(pending.gtkTheme, pending);
        const snapshot = this.extractThemeSnapshot(pending);
        snapshot && (this.lastAppliedThemeSnapshot = snapshot);
    }

    err(where, e) {
        this.notifier?.error?.(`Error ${where.toLowerCase()}`);
    }

    extractThemeSnapshot(settings) {
        if (!settings || typeof settings !== 'object') return null;
        return {
            theme: settings.theme ?? null,
            gtkTheme: settings.gtkTheme ?? null
        };
    }

    createComparisonSnapshot(data) {
        return (data && typeof data === 'object') ? {...data} : {};
    }

    updateBaseline(settings) {
        const snapshot = this.createComparisonSnapshot(settings);
        this.baselineSettingsSnapshot = Object.keys(snapshot).length > 0 ? snapshot : null;
    }

    applyGtkTheme(settings) {
        const target = settings || this.store?.snapshot?.settings;
        if (!target) return;

        const snapshot = this.extractThemeSnapshot(target),
            {lastAppliedThemeSnapshot} = this,
            unchanged = lastAppliedThemeSnapshot
                && snapshot
                && snapshot.theme === lastAppliedThemeSnapshot.theme
                && snapshot.gtkTheme === lastAppliedThemeSnapshot.gtkTheme;
        !unchanged && this.applyGtkThemeUseCase &&
            (this.applyGtkThemeUseCase.execute(target.gtkTheme, target),
                this.lastAppliedThemeSnapshot = snapshot);
        !unchanged && !this.applyGtkThemeUseCase && (this.pendingTheme = target);
    }

    applySoundPreference(settings) {
        this.soundService?.setEnabled(settings?.soundEnabled !== false);
    }

    writeSettingsFile() {
        const snapshot = this.store?.snapshot?.settings;
        if (!snapshot) return;
        const updates = this.createWritableSettings(snapshot);
        this.settingsManager?.update(updates);
        this.settingsManager?.write(null, { silent: true, force: true });
    }
}
