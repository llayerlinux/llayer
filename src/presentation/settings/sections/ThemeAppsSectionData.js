import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

class ThemeAppsSectionData {
    loadThemesSync() {
        const themes = this.themeRepository.getLocalThemes();
        return Array.isArray(themes) && themes.length > 0
            ? themes
            : this.enumerateThemesDirectory();
    }

    enumerateThemesDirectory() {
        const themes = [],
            themesPath = `${GLib.get_home_dir()}/.config/themes`,
            themesDir = Gio.File.new_for_path(themesPath);
        themesDir.query_exists(null) && (() => {
            const enumerator = themesDir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                const type = info.get_file_type(),
                    name = info.get_name(),
                    isThemeType = type === Gio.FileType.DIRECTORY || type === Gio.FileType.SYMBOLIC_LINK;
                !!name && !name.startsWith('.') && name !== 'default' && isThemeType && themes.push({
                    name: name,
                    title: name,
                    path: `${themesPath}/${name}`
                });
            }
            enumerator.close(null);
        })();

        themes.sort((a, b) => a.name.localeCompare(b.name));
        return themes;
    }

    collectThemeNames(themes) {
        const namesSet = new Set();

        themes.forEach(theme => {
            theme && theme.name && theme.name !== 'default' && namesSet.add(theme.name);
        });

        return Array.from(namesSet).sort();
    }

    collectUniqueThemes(themes) {
        const namesMap = new Map();

        themes.forEach(theme => {
            const themeName = theme?.name;
            const canAdd = !!themeName && themeName !== 'default' && !namesMap.has(themeName);
            canAdd && namesMap.set(themeName, theme);
        });

        return Array.from(namesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }
}

export function applyThemeAppsSectionData(prototype) {
    copyPrototypeDescriptors(prototype, ThemeAppsSectionData.prototype);
}
