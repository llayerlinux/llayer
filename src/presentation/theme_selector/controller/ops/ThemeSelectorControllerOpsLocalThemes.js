import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {TabType, ViewTabName} from '../../../common/Constants.js';

class ThemeSelectorControllerOpsLocalThemes {
    notifyThemeAdded(themeName) {
        this.notifier?.success?.(
            this.translate('SUCCESS'),
            this.translate('THEME_ADDED_LOCAL', {theme: themeName})
        );
    }

    notifyThemeAlreadyExists(themeName) {
        this.notifier?.warning?.(
            this.translate('WARNING'),
            this.translate('THEME_ALREADY_EXISTS', {theme: themeName})
        );
    }

    scheduleLocalRefresh(delay = 300) {
        this.scheduleLocalReload(delay);
    }

    addLocalThemeToStore(themeName) {
        const newTheme = this.themeRepository.loadLocalTheme(themeName),
            currentThemes = ((stored) => Array.isArray(stored) ? stored : [])(this.store.get('localThemes')),
            normalizedName = themeName.toLowerCase(),
            match = (t) => (t?.name || '').toLowerCase() === normalizedName;

        this.store.loadLocalThemes(
            currentThemes.some(match)
                ? currentThemes.map(t => match(t) ? {...newTheme} : t)
                : [...currentThemes, newTheme]
        );

        [ViewTabName.INSTALLED, TabType.LOCAL].includes(this.view.currentTab)
            && this.view.updateThemesList(this.store.get('localThemes'));
    }

    hasDirectoryChildren(targetDir) {
        if (!targetDir?.query_exists(null)) return false;
        const enumerator = targetDir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        const hasChildren = enumerator.next_file(null) !== null;
        enumerator.close(null);
        return hasChildren;
    }

    handleAddLocalTheme(selectedPath) {
        let sourceDir = Gio.File.new_for_path(selectedPath);

        if (!sourceDir.query_exists(null)) {
            this.notifier?.error?.(
                this.translate('ERROR'),
                this.translate('THEME_FOLDER_NOT_FOUND')
            );
            return;
        }

        const themeName = sourceDir.get_basename(),
              themesBasePath = this.themeRepository.basePath ?? `${GLib.get_home_dir()}/.config/themes`,
              targetDir = Gio.File.new_for_path(`${themesBasePath}/${themeName}`),
              sourcePath = sourceDir.get_path();

        if (sourcePath.startsWith(themesBasePath + '/')) {
            this.addLocalThemeToStore(themeName);
            this.scheduleLocalRefresh();
            this.notifyThemeAdded(themeName);
            return;
        }

        if (this.hasDirectoryChildren(targetDir)) {
            this.notifyThemeAlreadyExists(themeName);
            this.addLocalThemeToStore(themeName);
            this.scheduleLocalRefresh();
            return;
        }

        const themesBaseDir = Gio.File.new_for_path(themesBasePath);
        !themesBaseDir.query_exists(null) && themesBaseDir.make_directory_with_parents(null);

        if (!targetDir.make_symbolic_link(sourcePath, null)) return;

        this.addLocalThemeToStore(themeName);
        this.scheduleLocalRefresh();
        this.notifyThemeAdded(themeName);
    }
}

export function applyThemeSelectorControllerOpsLocalThemes(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerOpsLocalThemes.prototype);
}
