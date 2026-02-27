import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import { OverrideCollection } from '../../domain/valueObjects/OverrideCollection.js';
import { tryRun } from '../utils/ErrorUtils.js';

const isObjectLike = (value) => Boolean(value) && typeof value === 'object';

class HyprlandParameterServiceOverrides {
    getGlobalOverrides(settings) {
        const globalParams = this.settingsManager?.readGlobalHyprland?.(),
            overrides = settings?.hyprlandOverrides,
            fallback = this.settingsManager?.getAll?.()?.hyprlandOverrides;
        return [
            globalParams && Object.keys(globalParams).length > 0 ? globalParams : null,
            isObjectLike(overrides) ? overrides : null,
            isObjectLike(fallback) ? fallback : null
        ].find(Boolean) || {};
    }

    getPerRiceOverrides(themePath) {
        const rf = (name) => ((p) => GLib.file_test(p, GLib.FileTest.EXISTS)
            ? this.readJsonFile(p, `Error reading ${name}`) : null)(`${themePath}/${name}`),
            nj = rf('per_rice_hyprland.json'), lj = !nj && rf('.overrides.json');
        if (nj) return nj.params ?? {};
        return (!lj || (lj?.params ?? lj?.overrides)) ? ((lj?.params ?? lj?.overrides) ?? {})
            : Object.fromEntries(Object.entries(lj).filter(([k, v]) =>
                !['version', 'updatedAt', 'overrides', 'params'].includes(k) && typeof v === 'string'));
    }

    savePerRiceOverrides(themePath, params) {
        const saved = tryRun('HyprlandParameterServiceOverrides.savePerRiceOverrides', () => {
            GLib.file_set_contents(
                `${themePath}/per_rice_hyprland.json`,
                JSON.stringify({ version: 1, params, updatedAt: new Date().toISOString() }, null, 2)
            );
        });
        !saved && this.log('Error saving per_rice_hyprland');
        return saved;
    }

    saveGlobalOverrides(params) {
        return this.settingsManager?.writeGlobalHyprland?.(params) ?? false;
    }

    getMergedParameters(themePath, settings) {
        const collection = new OverrideCollection();
        collection.loadOriginals(this.parseThemeOriginals(themePath));
        collection.loadGlobals(this.getGlobalOverrides(settings));
        collection.loadPerRice(this.getPerRiceOverrides(themePath));
        return collection;
    }

    generateOverrideScript(overrides) {
        const lines = [];
        lines.push('# Hyprland parameter overrides');
        lines.push('applyHyprlandOverrides() {');

        for (const [path, value] of Object.entries(overrides)) {
            let param = this.parameters.get(path);
            if (!param) continue;

            lines.push(`    # ${param.description || path}`);
            lines.push(`    hyprctl keyword ${path.replace(/:/g, ':')} "${this.escapeValue(value)}" 2>/dev/null || true`);
        }

        lines.push('}');
        lines.push('');
        lines.push('applyHyprlandOverrides');

        return lines.join('\n');
    }

    escapeValue(value) {
        return typeof value === 'boolean'
            ? (value ? 'true' : 'false')
            : String(value).replace(/"/g, '\\"');
    }

    async getExceptionsForParameter(parameterPath) {
        const exceptions = [];
        for (const theme of (this.themeRepository ? await this.themeRepository.getLocalThemes() : [])) {
            const perRice = this.getPerRiceOverrides(this.getThemeRootPath(theme.name));
            perRice[parameterPath] !== undefined && exceptions.push({
                themeName: theme.name,
                themeTitle: theme.title || theme.name,
                value: perRice[parameterPath]
            });
        }

        return exceptions;
    }

    async resetParameterExceptions(parameterPath) {
        let resetCount = 0;
        let themes = this.themeRepository ? await this.themeRepository.getLocalThemes() : [];

        for (const theme of themes) {
            let themePath = this.getThemeRootPath(theme.name),
                perRice = this.getPerRiceOverrides(themePath);
            if (perRice[parameterPath] === undefined) continue;

            delete perRice[parameterPath];
            this.savePerRiceOverrides(themePath, perRice);
            resetCount++;
        }

        return resetCount;
    }
}

export function applyHyprlandParameterServiceOverrides(prototype) {
    copyPrototypeDescriptors(prototype, HyprlandParameterServiceOverrides.prototype);
}
