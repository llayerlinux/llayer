import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull } from '../utils/ErrorUtils.js';

class HyprlandParameterServiceApply {
    processConfigFile(configPath, overrides, result) {
        const readResult = tryOrNull(
            `HyprlandParameterServiceApply.read.${configPath}`,
            () => GLib.file_get_contents(configPath)
        );
        const [success, contents] = readResult ?? [];

        if (success) {
            const overrideResult = this.applyOverridesToContent(new TextDecoder().decode(contents), overrides);
            overrideResult.modified && (
                GLib.file_set_contents(configPath, overrideResult.content),
                result.overridesApplied += overrideResult.count,
                result.migratedFiles.push(configPath)
            );
            return;
        }

        !readResult && (
            this.log(`Error processing ${configPath}`),
            result.errors.push({ file: configPath, error: 'failed to read config file' })
        );
    }

    applyOverridesToConfig(themePath, settings) {
        const result = {
            success: true,
            migratedFiles: [],
            overridesApplied: 0,
            errors: []
        };

        let configFiles = this.findHyprlandConfigs(themePath);
        if (configFiles.length === 0) {
            this.log(`No hyprland configs found in ${themePath}`);
            return result;
        }

        let collection = this.getMergedParameters(themePath, settings),
            overrides = collection.getApplicableOverrides();

        for (const configPath of configFiles) {
            this.processConfigFile(configPath, overrides, result);
        }

        this.writeEffectiveOverrides(themePath, settings);
        result.success = result.errors.length === 0;
        return result;
    }

    findHyprlandConfigs(themePath) {
        let configs = [],
            mainConf = `${themePath}/hyprland.conf`;
        GLib.file_test(mainConf, GLib.FileTest.EXISTS) && configs.push(mainConf);

        let hyprlandDir = `${themePath}/hyprland`;
        if (!GLib.file_test(hyprlandDir, GLib.FileTest.IS_DIR)) return configs;

        let enumerator = tryOrNull(
            'HyprlandParameterServiceApply.findHyprlandConfigs',
            () => Gio.File.new_for_path(hyprlandDir).enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            )
        );
        if (!enumerator) {
            this.log('Error scanning hyprland dir');
            return configs;
        }

        let info;
        while ((info = enumerator.next_file(null))) {
            let name = info.get_name(),
                isConfFile = info.get_file_type() === Gio.FileType.REGULAR && name.endsWith('.conf');
            isConfFile && configs.push(`${hyprlandDir}/${name}`);
        }
        enumerator.close(null);

        return configs;
    }

    applyOverridesToContent(content, overrides) {
        let result = content;
        let count = 0;

        Object.entries(overrides)
            .filter(([path]) => this.parameters.has(path))
            .forEach(([path, value]) => {
                const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`^(\\s*${escapedPath}\\s*=\\s*)(.*)$`, 'gm');

                const newContent = result.replace(regex, `$1${value}`);
                if (newContent !== result) {
                    result = newContent;
                    count++;
                }
            });

        return {
            content: result,
            modified: count > 0,
            count
        };
    }

    async reapplyOverridesToAllThemes(settings) {
        let results = { processed: 0, errors: [] };
        let themes = this.themeRepository ? await this.themeRepository.getLocalThemes() : [];

        for (let theme of themes) {
            let applyResult = this.applyOverridesToConfig(this.getThemeRootPath(theme.name), settings);
            applyResult?.success
                ? results.processed++
                : results.errors.push({ theme: theme.name, error: applyResult?.errors?.[0]?.error || 'failed to apply overrides' });
        }

        return results;
    }
}

export function applyHyprlandParameterServiceApply(prototype) {
    copyPrototypeDescriptors(prototype, HyprlandParameterServiceApply.prototype);
}
