import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import * as ThemeItemModule from '../components/ThemeItem.js';
import * as PlaceholdersModule from '../components/Placeholders.js';
import * as WidgetFactoryModule from '../components/WidgetFactory.js';
import * as ViewUtils from '../../common/ViewUtils.js';

const {Box} = WidgetFactoryModule;
const SELECTED_ITEM_CLASS = 'my-theme-selector-item-selected';

export function applyThemeSelectorViewLifecycle(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeSelectorViewLifecycle.prototype);
}

class ThemeSelectorViewLifecycle {
    showPlaceholder(text) {
        const placeholder = new Gtk.Label({
            label: text,
            sensitive: false,
            margin: 50,
            justify: Gtk.Justification.CENTER
        });
        placeholder.get_style_context().add_class('placeholder-text');
        this.gridBox?.pack_start(placeholder, true, true, 0);
        this.gridBox?.show_all();
    }

    addDownloadProgress(d) {
        const progressItem = this.downloadsContainerComponent?.addDownload?.(d);
        if (progressItem) {
            this.activeDownloadContainers?.push(progressItem);
            this.themeStateManager?.addContainer(progressItem);
        }
        return progressItem;
    }

    removeDownloadProgress(id) {
        const index = this.activeDownloadContainers?.findIndex(p => p.processId === id) ?? -1;
        if (index >= 0) {
            const progressItem = this.activeDownloadContainers[index];
            this.downloadsContainerComponent?.removeDownload?.(id);
            this.activeDownloadContainers.splice(index, 1);
            this.themeStateManager?.removeContainer(progressItem);
        }
    }

    adaptWindowSize() {
        this.windowManager?.adaptSize();
    }

    shrinkWindowToDefault() {
        this.windowManager?.shrinkToDefault();
    }

    updateDownloadProgress(id, d) {
        const progressItem = this.activeDownloadContainers?.find(p => p.processId === id);
        progressItem?.updateProgress?.(d);
    }

    updateCurrentThemeStyles(n) {
        n === 'default' && (this._defaultThemeStale = false);
        if (!this.gridBox) return;
        this.gridBox.foreach((row) => {
            (row?.get_children?.() || []).forEach((child) => {
                const button = child?.get_child?.() || child?.get_children?.()?.find?.(item => item?._themeName);
                button?.get_style_context?.()?.remove_class(SELECTED_ITEM_CLASS);
                button?._themeName === n && button?.get_style_context?.()?.add_class(SELECTED_ITEM_CLASS);
            });
        });
    }

    showInstallProgress(o, b, l) {
        this.themeStateManager?.setProgressVisibility(o, b, l, true);
    }

    hideInstallProgress(o, b, l) {
        this.themeStateManager?.setProgressVisibility(o, b, l, false);
    }

    restoreNormalLayout() {
        if (!this.mainContentBox.get_children().includes(this.scrollableGrid)) {
            this.mainContentBox.foreach(c => this.mainContentBox.remove(c));
            this.mainContentBox.pack_start(this.scrollableGrid, true, true, 0);
            this.scrollableGrid.show_all();
            this.mainContentBox.show_all();
        }
        this.windowManager?.resetToDefaultSize?.();
    }

    async updateContextMAuthorAvatar(t, w) {
        await this.previewLoader?.updateAuthorAvatar?.(t, w, (p, s, i) => this.makeCircularPixbuf(p, s, i));
    }

    ensureThemeItemComponent() {
        if (!this.themeItemComponent && ThemeItemModule?.ThemeItem) {
            const view = this;
            this.themeItemComponent = new ThemeItemModule.ThemeItem({
                t: k => view.translate(k),
                createIcon: (name, size) => view.createIcon(name, size),
                makeRoundedPixbuf: (path, size, radius) => view.makeRoundedPixbuf(path, size, radius),
                loadNetworkPreview: (theme, widget, size) => view.loadNetworkThemePreview(theme, widget, size, size),
                onThemeClick: async (theme, options) => {
                    if (typeof view.controller?.handleThemeItemClick === 'function') {
                        await view.controller.handleThemeItemClick(theme, options);
                        return;
                    }
                    await view.applyTheme?.(theme);
                },
                onMenuClick: (theme, button) => view.showThemeItemMenu(theme, button),
                onVariantClick: (theme, variantName) => view.controller?.handleVariantClick?.(theme, variantName),
                playHoverSound: () => view.playHoverSound?.(),
                getCurrentTheme: () => {
                    const current = view.controller?.store?.get?.('currentTheme');
                    return (current === 'default' && view._defaultThemeStale) ? null : current;
                },
                currentTab: view.currentTab,
                currentDir: view.getCurrentDir()
            });
        }
        if (this.themeItemComponent) {
            this.themeItemComponent.currentTab = this.currentTab;
        }
        return this.themeItemComponent;
    }

    createThemeItem(theme) {
        const component = this.ensureThemeItemComponent();
        return component?.create(theme);
    }

    createDownloadProgressUI(d) {
        return this.downloadsContainerComponent?.createProgressUI(d) || {
            container: Box({
                vertical: true,
                className: 'download-progress-container'
            }),
            processId: d.processId,
            themeName: d.theme?.name,
            updateProgress: () => {}
        };
    }

    showNetworkProgressBar() {
        this.networkProgressComponent?.show();
    }

    hideNetworkProgressBar() {
        this.networkProgressComponent?.hide();
    }

    updateLocalLoadingProgress(p, t) {
        this.themesListComponent?.updateLocalProgress?.(p, t);
    }

    ensurePlaceholdersComponent() {
        if (!this.placeholdersComponent) {
            this.placeholdersComponent = PlaceholdersModule?.Placeholders
                ? new PlaceholdersModule.Placeholders({t: k => this.translate(k)})
                : null;
        }
        return this.placeholdersComponent;
    }

    createLoadingSpinner() {
        this.clearGridBox();
        this.ensurePlaceholdersComponent()?.showLoading(this.gridBox, 'LOADING_NETWORK_THEMES');
    }

    createPlaceholderInMainContent(t) {
        const placeholder = this.ensurePlaceholdersComponent()?.createCenteredPlaceholder(t);
        if (placeholder) {
            this.mainContentBox.pack_start(placeholder, true, true, 0);
            this.mainContentBox.show_all();
        }
    }

    async applyTheme(theme) {
        await this.controller.handleApplyTheme(theme);
    }

    deleteTheme(theme) {
        this.controller?.handleDeleteTheme?.(theme);
    }

    createIcon(n, s, w, h) {
        return ViewUtils?.IconUtils?.createIcon?.(n, s, w, h, this.getCurrentDir())
            || new Gtk.Image({icon_name: n, icon_size: Gtk.IconSize.BUTTON});
    }

    makeCircularPixbuf(p, d = 64, i = 128) {
        return ViewUtils?.PixbufUtils?.makeCircularPixbuf?.(p, d, i) || null;
    }

    makeRoundedPixbuf(p, s = 96, r = 12) {
        return ViewUtils?.PixbufUtils?.makeRoundedPixbuf?.(p, s, r) || null;
    }

    showNotification(m, t = 'info') {
        const titleKey = t === 'error' ? 'ERROR' : 'INFO_GENERIC';
        this.tryGetService('notifier')?.notify?.(t, this.translate(titleKey), m);
    }

    playHoverSound() {
        this.tryGetService('soundService')?.playButtonHoverSound?.();
    }

    show() {
        if (!this.window) {
            this.createWindow();
        }
        this.window.show_all();
        this.window.present();
        this.isVisible = true;
        if (this.needsStoreSubscription && this.controller?.store) {
            this.subscribeToStore();
            this.needsStoreSubscription = false;
        }
        if (this.pendingThemes && this.gridBox) {
            this.updateThemesList(this.pendingThemes);
            this.pendingThemes = null;
        }
        this.controller?.handleWindowShow?.();
    }

    hide() {
        this.hideDefaultRestorePointsMenu?.();
        this.window.hide();
        this.isVisible = false;
        this.controller?.handleWindowHide?.();
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
            return;
        }
        this.show();
    }

    unsubscribeFromStore() {
        this.subscriptions.forEach(u => u?.());
        this.subscriptions = [];
    }

    showUpdateNotification(info) {
        if (info && this.gridContentBox && this.updateNotificationView) {
            this.updateNotificationView.show(info, this.gridContentBox);
            const banner = this.updateNotificationView.banner;
            this.gridContentBox.get_children?.().includes?.(banner) && this.gridContentBox.reorder_child(banner, 0);
        }
    }

    hideUpdateNotification() {
        this.updateNotificationView?.hide?.();
    }

    captureUpdateNotification() {
        return this.updateNotificationView?.capture?.() ?? null;
    }

    restoreUpdateNotification(i) {
        if (i && this.gridContentBox) {
            this.updateNotificationView?.restore?.(i, this.gridContentBox);
        }
    }

    showHyprlandOverridePopup(theme, triggerWidget) {
        if (!theme) return;

        let popupClass = this.hyprlandOverridePopup ? null : this.tryGetService('HyprlandOverridePopup'),
            isUnavailablePopup = !this.hyprlandOverridePopup && !popupClass;
        if (isUnavailablePopup) {
            this.showNotification(
                this.translate('OVERRIDE_POPUP_NOT_AVAILABLE') || 'Override popup not available',
                'error'
            );
            return;
        }

        if (!this.hyprlandOverridePopup) {
            this.hyprlandOverridePopup = new popupClass({
                t: (k) => this.translate(k),
                parameterService: this.tryGetService('hyprlandParameterService'),
                hotkeyService: this.tryGetService('hotkeyService'),
                themeRepository: this.tryGetService('themeRepository'),
                settingsManager: this.tryGetService('settingsManager'),
                eventBus: this.getEventBus?.(),
                logger: this.tryGetService('logger')
            });
        }
        this.hyprlandOverridePopup.show(theme, triggerWidget);
    }

    destroy() {
        this.eventsComponent?.destroy?.();
        this.unsubscribeFromStore();
        this.networkProgressComponent?.destroy?.();
        this.updateNotificationView?.hide?.();
        this.hyprlandOverridePopup?.hide?.();
        [
            this.aboutView,
            this.moreSectionsView,
            this.themeContextMenuController,
            this.themeContextMenuView,
            this.hyprlandOverridePopup,
            this.currentStateDialog,
            this.window
        ].forEach(v => v?.destroy?.());

        this.eventsComponent = null;
        this.networkProgressComponent = null;
        this.aboutView = null;
        this.moreSectionsView = null;
        this.updateNotificationView = null;
        this.themeContextMenuController = null;
        this.themeContextMenuView = null;
        this.hyprlandOverridePopup = null;
        this.currentStateDialog = null;
        this.window = null;
        this.controller = null;
        this.logger = null;
    }
}
