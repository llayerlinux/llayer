import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=3.0';
import { isPlainObject } from '../../../infrastructure/utils/Utils.js';
import { runMessageDialog } from '../../common/ViewUtils.js';

export function applyThemeContextMenuControllerMenu(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeContextMenuControllerMenu.prototype);
}

class ThemeContextMenuControllerMenu {
    hasContainerApi() {
        return this.container
            && typeof this.container.has === 'function'
            && typeof this.container.get === 'function';
    }

    getThemeSelectorView() {
        return this.hasContainerApi() && this.container.has('themeSelectorView')
            ? this.container.get('themeSelectorView')
            : null;
    }

    playClickSound() {
        this.soundService?.playSound?.('button_hover.wav');
    }

    async showContextMenu(themeName, isNetwork, triggerWidget, event = null, themeObject = null) {
        const menuData = this.prepareThemeContextMenuData(themeName, isNetwork, themeObject);
        if (!menuData.success) return;

        this.currentMenuData = menuData;
        this.currentWidget = triggerWidget;
        await this.view.showMenu(menuData, triggerWidget, event);
        menuData.theme && this.fetchFreshStatsFromServer(menuData.theme, isNetwork);
        isNetwork && menuData.theme?.name && this.checkLocalThemeExists(menuData.theme.name) && this.view?.setLocalThemeAvailable?.(true);
    }

    async closeMenu() {
        this.view?.hideMenu?.();

        this.currentMenuData = null;
        this.currentWidget = null;

        this.playClickSound();
    }

    async toggleViewMode() {
        if (!this.currentMenuData || !this.currentMenuData.theme) {
            return;
        }

        const theme = this.currentMenuData.theme;
        const themeName = theme.name;
        const widget = this.currentWidget;

        this.view?.hideMenu?.();

        const showLocalAsNetwork = async () => {
            const storeData = this.getThemeInfoFromStore(themeName, true);
            const cached = this.cachedNetworkTheme && typeof this.cachedNetworkTheme === 'object'
                ? this.cachedNetworkTheme
                : {};

            const networkTheme = {
                ...theme,
                isNetwork: true,
                isLocal: false,
                ...(storeData && storeData.id !== null ? {
                    author: storeData.author ?? theme.author,
                    adaptedBy: storeData.adaptedBy ?? theme.adaptedBy,
                    published: storeData.published ?? theme.published,
                    youtubeLink: storeData.youtubeLink ?? theme.youtubeLink,
                    tags: Array.isArray(storeData.tags) && storeData.tags.length > 0
                        ? storeData.tags
                        : (Array.isArray(theme.tags) ? theme.tags : []),
                    properties: isPlainObject(storeData.properties) && Object.keys(storeData.properties).length > 0
                        ? storeData.properties
                        : (isPlainObject(theme.properties) ? theme.properties : {}),
                    repoUrl: storeData.repoUrl ?? theme.repoUrl,
                    packageSupport: storeData.packageSupport ?? theme.packageSupport,
                    description: storeData.description ?? theme.description,
                    includes: storeData.includes ?? theme.includes ?? null
                } : {}),
                ...(this.cachedNetworkTheme ? {
                    downloadCount: cached.downloadCount ?? theme.downloadCount,
                    installCount: cached.installCount ?? theme.installCount,
                    applyCount: cached.applyCount ?? theme.applyCount,
                    averageInstallMs: cached.averageInstallMs ?? theme.averageInstallMs,
                    averageApplyMs: cached.averageApplyMs ?? theme.averageApplyMs,
                    ...(cached.author ? {author: cached.author} : {}),
                    ...(cached.adaptedBy ? {adaptedBy: cached.adaptedBy} : {}),
                    ...(cached.published ? {published: cached.published} : {}),
                    ...(cached.youtubeLink ? {youtubeLink: cached.youtubeLink} : {}),
                    ...(cached.tags ? {tags: cached.tags} : {}),
                    ...(cached.properties ? {properties: cached.properties} : {}),
                    ...(cached.repoUrl ? {repoUrl: cached.repoUrl} : {}),
                    ...(cached.description ? {description: cached.description} : {}),
                    ...(cached.packageSupport ? {packageSupport: cached.packageSupport} : {}),
                    ...(cached.includes ? {includes: cached.includes} : {})
                } : {})
            };

            await this.showContextMenu(themeName, true, widget, null, networkTheme);
        };
        await (!this.currentMenuData.isNetwork
            ? showLocalAsNetwork()
            : this.showContextMenu(themeName, false, widget, null, null));

        this.playClickSound();
    }

    checkLocalThemeExists(themeName) {
        return !!themeName && Gio.File.new_for_path(`${this.getLocalThemesBasePath()}/${themeName}`).query_exists(null);
    }

    async showPropertiesHelp() {
        const translator = (key, params) => this.translate(key, params),
              themeSelectorView = this.getThemeSelectorView(),
              parentDialog = this.view?.popup || this.currentWidget || null,
              ViewUtils = this.hasContainerApi() && this.container.has('ViewUtils')
                  ? this.container.get('ViewUtils')
                  : null;

        const showByViewUtils = () => ViewUtils.showPropertiesHelp({
            translator,
            parent: parentDialog,
            cssProvider: themeSelectorView?.cssProvider || null
        }),  showByThemeSelector = () => themeSelectorView.showPropertiesHelp(parentDialog),
             showByDialog = () => runMessageDialog({
            parent: parentDialog,
            messageType: Gtk.MessageType.INFO,
            buttons: Gtk.ButtonsType.OK,
            title: translator('PROPERTIES_HELP_TITLE'),
            secondaryText: translator('THEME_PROPERTIES_HELP_BODY')
        });
        (ViewUtils?.showPropertiesHelp
            ? showByViewUtils
            : (themeSelectorView?.showPropertiesHelp ? showByThemeSelector : showByDialog))();

        this.playClickSound();
    }

}
