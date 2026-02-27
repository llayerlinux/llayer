import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
function ensureIsolationModeMap(settings) {
    settings.per_rice_isolation_mode ||= {};
    return settings.per_rice_isolation_mode;
}

class ThemeAppsSectionActions {
    onIsolationModeChanged(app, mode) {
        const perRiceIsolationMode = ensureIsolationModeMap(this.settings);

        mode === 'hybrid' ? delete perRiceIsolationMode[app] : perRiceIsolationMode[app] = mode;

        this.onIsolationModesChanged?.(perRiceIsolationMode);
    }

    onAppToggled(app, isEnabled) {
        const skipList = this.settings.skip_install_theme_apps ?? [];
        const idx = skipList.indexOf(app);
        isEnabled
            ? idx >= 0 && skipList.splice(idx, 1)
            : idx === -1 && skipList.push(app);

        this.settings.skip_install_theme_apps = [...skipList];
        this.onSkipListChanged?.(this.settings.skip_install_theme_apps);
    }

    reload() {
        this.loaded = false;
        this.populate({force: true});
    }

    refresh() {
        this.reload();
    }

    collectSkipList() {
        return Object.entries(this.checkboxes ?? {})
            .filter(([, checkbox]) => checkbox?.get_active?.() === false)
            .map(([themeName]) => themeName);
    }

    syncCheckboxes(skipList) {
        const skipSet = new Set(skipList ?? []);
        Object.entries(this.checkboxes ?? {}).forEach(([themeName, checkbox]) => {
            const shouldBeActive = !skipSet.has(themeName);
            checkbox.get_active() !== shouldBeActive && checkbox.set_active(shouldBeActive);
            this.isolationCombos?.[themeName]?.set_visible(shouldBeActive);
        });
    }

    syncIsolationModes(perRiceIsolation) {
        const modes = perRiceIsolation ?? {};
        Object.entries(this.isolationCombos ?? {}).forEach(([themeName, combo]) => {
            const mode = modes[themeName] || 'hybrid';
            combo.get_active_id() !== mode && combo.set_active_id(mode);
        });
    }

    collectIsolationModes() {
        return Object.entries(this.isolationCombos ?? {}).reduce((modes, [themeName, combo]) => {
            const mode = combo?.get_active_id?.();
            mode && mode !== 'hybrid' && (modes[themeName] = mode);
            return modes;
        }, {});
    }

    setAllIsolationModesDisabled() {
        this.savedIsolationModes = this.collectIsolationModes();
        this.settings.per_rice_isolation_mode = {};
        Object.keys(this.isolationCombos ?? {}).forEach(app => {
            this.settings.per_rice_isolation_mode[app] = 'disabled';
        });
        this.onIsolationModesChanged?.(this.settings.per_rice_isolation_mode);
        this.reload();
    }

    restoreIsolationModes() {
        const defaultMode = this.settings.isolation_grouping_mode || 'hybrid';
        this.settings.per_rice_isolation_mode = {};
        Object.keys(this.savedIsolationModes).forEach(themeName => {
            this.settings.per_rice_isolation_mode[themeName] = this.savedIsolationModes[themeName] || defaultMode;
        });
        this.onIsolationModesChanged?.(this.settings.per_rice_isolation_mode);
        this.reload();
    }

    setAllIsolationModesToGlobal(globalMode, oldMode = 'hybrid') {
        const combos = this.isolationCombos ?? {};
        const perRiceIsolationMode = ensureIsolationModeMap(this.settings);
        Object.keys(combos).forEach(app => {
            perRiceIsolationMode[app] = globalMode;
        });

        this.onIsolationModesChanged?.(perRiceIsolationMode);

        this.reload();
    }
}

export function applyThemeAppsSectionActions(prototype) {
    copyPrototypeDescriptors(prototype, ThemeAppsSectionActions.prototype);
}
