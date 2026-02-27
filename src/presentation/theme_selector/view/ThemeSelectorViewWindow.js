import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import {AboutView} from '../../about/AboutView.js';
import {MoreSectionsView} from '../../more_sections/MoreSectionsView.js';
import {MoreSectionsController} from '../../more_sections/MoreSectionsController.js';
import {ThemeContextMenuController} from '../../theme_context_menu/ThemeContextMenuController.js';
import {ThemeContextMenuView} from '../../theme_context_menu/ThemeContextMenuView.js';
import {UpdateNotificationView} from '../../update_notification/UpdateNotificationView.js';
import * as HeaderBarModule from '../components/HeaderBar.js';
import * as BottomBarModule from '../components/BottomBar.js';
import * as NetworkProgressModule from '../components/NetworkProgress.js';
import * as UploadDialogModule from '../dialogs/UploadDialog.js';
import * as ThemesListModule from '../components/ThemesList.js';
import * as DownloadsContainerModule from '../components/DownloadsContainer.js';
import * as WidgetFactoryModule from '../components/WidgetFactory.js';
import * as ViewUtils from '../../common/ViewUtils.js';
import { Events } from '../../../app/eventBus.js';
import {ViewTabName} from '../../common/Constants.js';

const {Box, Button, Scrollable} = WidgetFactoryModule;

const MoreSectionsControllerModule = {MoreSectionsController};

function buildOptionalComponent(componentClass, builder) {
    return componentClass ? builder(componentClass) : null;
}

export function applyThemeSelectorViewWindow(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeSelectorViewWindow.prototype);
}

class ThemeSelectorViewWindow {
    getClampedWindowPosition(geometry, windowWidth, windowHeight) {
        const w = (Number.isFinite(windowWidth) && windowWidth > 0) ? windowWidth : 400;
        const h = (Number.isFinite(windowHeight) && windowHeight > 0) ? windowHeight : 640;
        return [
            Math.min(geometry.x + Math.max(0, geometry.width - w), Math.max(geometry.x, geometry.x + geometry.width - w - 20)),
            Math.min(geometry.y + Math.max(0, geometry.height - h), Math.max(geometry.y, geometry.y + Math.floor((geometry.height - h) / 2)))
        ];
    }

    registerTranslatedWidgets(pairs) {
        pairs.forEach(([widget, key, method = 'set_tooltip_text']) => {
            this.registerWidgetTranslation(widget, key, (w, t) => w?.[method]?.(t));
        });
    }

    createWindow() {
        if (this.window) return this.window;

        let width = this.windowManager?.DEFAULT_WIDTH || 400,
            height = this.windowManager?.DEFAULT_HEIGHT || 640;
        this.window = new Gtk.Window({title: 'LastLayer', type: Gtk.WindowType.TOPLEVEL, decorated: false});
        this.window.set_name('my-theme-selector');
        this.window.set_wmclass('LastLayerPopup', 'LastLayerPopup');
        this.window.get_style_context().add_class('lastlayer-main-window');
        this.window.set_keep_above(true);
        this.window.set_resizable(false);
        this.window.set_type_hint(Gdk.WindowTypeHint.UTILITY);
        this.window.set_default_size(width, height);
        this.registerWindowTranslation();
        this.window.connect('realize', () => {
            const screen = this.window.get_screen();
            const geometry = screen.get_monitor_geometry(screen.get_primary_monitor?.() || 0);
            const [x, y] = this.getClampedWindowPosition(geometry, width, height);
            this.window.move(x, y);
            this.window.get_style_context().invalidate();
            this.window.queue_draw();
        });
        this.window.connect('delete-event', () => { this.hide(); return true; });
        this.window.connect('key-press-event', (_w, e) => {
            if (e.get_keyval()[1] === Gdk.KEY_Escape) { this.hide(); return true; }
            return false;
        });
        this.window.add(this.createMainContent());
        ViewUtils.autoSetupPointerCursors(this.window);
        return this.window;
    }

    createMainContent() {
        this.headerBox = this.createHeaderBox();
        this.downloadsContainer = this.createDownloadsContainer();
        this.networkProgressArea = this.createNetworkProgressArea();
        this.mainContentBox = this.createMainContentBox();
        this.bottomBar = this.createBottomBar();
        this.contentBox = Box({
            vertical: true, className: 'my-theme-selector-popup-content', margin_bottom: 0, margin_top: 0, spacing: 0,
            children: [this.headerBox, this.networkProgressArea, this.mainContentBox, this.bottomBar, this.downloadsContainer]
        });
        this.translateWidgetTexts(this.contentBox);
        return this.contentBox;
    }

    createHeaderBox() {
        return buildOptionalComponent(HeaderBarModule?.HeaderBar, (HeaderBar) => {
            this.headerBarComponent = new HeaderBar({
                t: k => this.translate(k), createIcon: (n, s) => this.createIcon(n, s),
                onTabSwitch: t => {
                    this.currentTab = t;
                    [ViewTabName.INSTALLED, ViewTabName.NETWORK].includes(t) && this.controller?.handleTabSwitch?.(t);
                    this.handleTabSwitch(t);
                },
                onExitTweaks: () => this.exitTweaksTab(), getCurrentTab: () => this.currentTab, Box, Button
            });
            const header = this.headerBarComponent.build();
            const w = this.headerBarComponent.getWidgets();
            Object.assign(this, {
                btnInstalled: w.btnInstalled,
                btnNetwork: w.btnNetwork,
                parametersBtn: w.parametersBtn,
                moreSectionsBtn: w.moreSectionsBtn,
                aboutBtn: w.aboutBtn
            });
            this.tabManager?.setButtons({
                installed: w.btnInstalled,
                network: w.btnNetwork,
                settings: w.parametersBtn,
                moreSections: w.moreSectionsBtn,
                about: w.aboutBtn
            });
            this.registerTranslatedWidgets([
                [w.btnInstalled, 'INSTALLED_TAB', 'set_label'],
                [w.btnNetwork, 'NETWORK_TAB', 'set_label'],
                [w.parametersBtn, 'TWEAKS_ICON_TOOLTIP', 'set_tooltip_text'],
                [w.moreSectionsBtn, 'MORE_SECTIONS_ICON_TOOLTIP', 'set_tooltip_text'],
                [w.aboutBtn, 'ABOUT_ICON_TOOLTIP', 'set_tooltip_text']
            ]);
            return header;
        });
    }

    createBottomBar() {
        return buildOptionalComponent(BottomBarModule?.BottomBar, (BottomBar) => {
            this.bottomBarComponent = new BottomBar({
                Box, t: k => this.translate(k), createIcon: (n, s) => this.createIcon(n, s),
                onClose: () => this.hide(), onAddTheme: () => this.openAddThemeDialog(),
                onUploadTheme: () => this.isUploadInProgress ? this.showNotification(this.translate('UPLOAD_IN_PROGRESS'), 'info') : this.openUploadThemeDialog(),
                onOpenSettings: () => this.openSettingsDialog(),
                onRefresh: () => {
                    const t = this.controller?.store?.get('activeTab');
                    this.controller?.store?.setLoadingState?.(t, 'loading');
                    this.getEventBus()?.emit?.(Events.UI_REFRESH_REQUESTED, {tab: t});
                    this.controller?.handleRefresh?.();
                },
                onOpenCurrentState: () => {
                    this.showCurrentStatePopup?.();
                    this.bottomBarComponent?.setInfoButtonAlert?.(false);
                },
                isUploadInProgress: () => this.isUploadInProgress
            });
            const bar = this.bottomBarComponent.build();
            const w = this.bottomBarComponent.getWidgets();
            Object.assign(this, {
                closeBtn: w.closeBtn,
                addButton: w.addButton,
                uploadButton: w.uploadButton,
                uploadButtonIcon: w.uploadButtonIcon,
                uploadButtonSpinner: w.uploadButtonSpinner,
                bottomSettingsButton: w.settingsButton,
                refreshButton: w.refreshButton,
                infoButton: w.infoButton
            });
            this.registerTranslatedWidgets([
                [w.closeBtn, 'CLOSE_ICON_TOOLTIP'],
                [w.addButton, 'ADD_LOCAL_THEME_TOOLTIP'],
                [w.uploadButton, 'UPLOAD_ICON_TOOLTIP'],
                [w.settingsButton, 'SETTINGS_ICON_TOOLTIP'],
                [w.refreshButton, 'REFRESH_ICON_TOOLTIP'],
                [w.infoButton, 'INFO_GENERIC']
            ]);
            this.bottomBarComponent.setContextTab(this.currentTab);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                this.refreshServiceAlert?.();
                return GLib.SOURCE_REMOVE;
            });
            return bar;
        });
    }

    createMainContentBox() {
        if (ThemesListModule?.ThemesList) {
            this.themesListComponent = new ThemesListModule.ThemesList({
                Box,
                Scrollable,
                onScrollNearEnd: () => this.handleNetworkScrollEnd(),
                getCurrentTab: () => this.currentTab
            });
            const r = this.themesListComponent.build(), w = this.themesListComponent.getWidgets();
            Object.assign(this, {
                gridBox: w.gridBox,
                gridContentBox: w.gridContentBox,
                scrollableGrid: w.scrollableGrid,
                mainContentBox: r.mainContentBox
            });
        }
        this.updateNotificationView = new UpdateNotificationView();
        this.hideNetworkProgressBar();
        return this.mainContentBox;
    }

    handleNetworkScrollEnd() {
        this.currentTab === ViewTabName.NETWORK && this.controller?.loadMoreNetworkThemes?.();
    }

    createNetworkProgressArea() {
        this.networkProgressComponent = new NetworkProgressModule.NetworkProgress({
            Box,
            getCurrentTab: () => this.currentTab
        });
        this.networkProgressBar = this.networkProgressComponent.getWidgets().progressBar;
        return this.networkProgressComponent.build();
    }

    createDownloadsContainer() {
        return buildOptionalComponent(DownloadsContainerModule?.DownloadsContainer, (DownloadsContainer) => {
            this.downloadsContainerComponent = new DownloadsContainer({
                Box,
                onAdaptWindowSize: () => this.adaptWindowSizeAfterDownload()
            });
            this.downloadsBox = this.downloadsContainerComponent.getWidgets().downloadsBox;
            this.activeDownloadContainers = [];
            this.processManager = null;
            return this.downloadsContainerComponent.build();
        });
    }

    initializeAdditionalComponents() {
        this.aboutView = new AboutView(this.controller, this.logger);
        const moreSectionsController = MoreSectionsControllerModule?.MoreSectionsController
            ? new MoreSectionsControllerModule.MoreSectionsController(this.container, this.controller.store, this.logger)
            : this.controller;
        MoreSectionsControllerModule?.MoreSectionsController && moreSectionsController.setMainController?.(this.controller);
        this.moreSectionsView = new MoreSectionsView(moreSectionsController, this.logger);
        moreSectionsController?.setView?.(this.moreSectionsView);
        this.themeContextMenuController = new ThemeContextMenuController(this.container, this.logger);
        this.themeContextMenuView = new ThemeContextMenuView(this.themeContextMenuController, this.logger, this.t);
        this.themeContextMenuController.setView?.(this.themeContextMenuView);
        this.updateLocalizationControllers();
    }

    openAddThemeDialog() {
        ViewUtils.openFileChooserDialog({
            title: this.translate('FILE_CHOOSER_ADD_TITLE'),
            action: Gtk.FileChooserAction.SELECT_FOLDER,
            parent: this.window,
            currentFolder: `${GLib.get_home_dir()}/.config`,
            buttons: [
                {label: this.translate('CANCEL'), response: Gtk.ResponseType.CANCEL},
                {label: this.translate('ADD'), response: Gtk.ResponseType.ACCEPT}
            ],
            translateWidgets: (widget) => this.translateWidgetTexts(widget),
            onResponse: (dlg, response) => {
                if (response !== Gtk.ResponseType.ACCEPT) {
                    return;
                }
                this.controller?.handleAddLocalTheme?.(dlg.get_filename());
            }
        });
    }

    openUploadThemeDialog() {
        this.currentUploadDialog = new UploadDialogModule.UploadDialog({
            t: (k, p) => this.translate(k, p),
            parentWindow: this.window,
            cssProvider: this.cssProvider,
            onUpload: async (d, opts) => {
                this.isUploadInProgress = true;
                this.bottomBarComponent?.setUploadInProgress?.(true);
                await this.controller.handleUploadTheme(d, opts);
                this.isUploadInProgress = false;
                this.bottomBarComponent?.setUploadInProgress?.(false);
            },
            onFinalize: (s, m) => this.finalizeUploadDialog(s, m),
            onClose: () => {
                this.currentUploadDialog = null;
                this.isUploadInProgress = false;
                this.bottomBarComponent?.setUploadInProgress?.(false);
            },
            showNotification: (m, t) => this.showNotification?.(m, t),
            updateAuthorAvatar: (t, w) => this.updateContextMAuthorAvatar?.(t, w),
            lastArchivePath: this.lastUploadArchivePath,
            lastPreviewPath: this.lastUploadPreviewPath,
            setLastArchivePath: p => {
                this.lastUploadArchivePath = p;
            },
            setLastPreviewPath: p => {
                this.lastUploadPreviewPath = p;
            }
        }).open();
    }

    finalizeUploadDialog(status, msg = null) {
        if (!this.currentUploadDialog) return;

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            let dialogRef = this.currentUploadDialog;
            if (!dialogRef) return GLib.SOURCE_REMOVE;

            let ok = status === 'success',
                m = msg || this.translate(ok ? 'UPLOAD_SUCCESS_TOAST' : 'UPLOAD_ERROR_UNKNOWN');
            dialogRef.statusLabel?.set_text?.(m || '');
            [dialogRef.progressSpinner, dialogRef.btnSaveSpinner].forEach(s => {
                s?.stop?.();
                s?.hide?.();
            });
            dialogRef.btnSaveText?.show?.();
            if (ok) {
                this.showNotification(m, 'info');
                dialogRef.dialog?.destroy?.();
            } else {
                [dialogRef.btnSave, dialogRef.btnCancel].forEach(b => b?.set_sensitive?.(true));
                this.showNotification(m, 'error');
            }
            this.currentUploadDialog === dialogRef && (this.currentUploadDialog = null);
            this.isUploadInProgress = false;
            this.bottomBarComponent?.setUploadInProgress?.(false);
            return GLib.SOURCE_REMOVE;
        });
    }

    showPropertiesHelp(p) {
        const fallbackDialog = () => ViewUtils.showMessageDialog({
            parent: p,
            messageType: Gtk.MessageType.INFO,
            buttons: Gtk.ButtonsType.OK,
            title: this.translate('PROPERTIES_HELP_TITLE'),
            secondaryText: this.translate('PROPERTIES_HELP')
        });
        return ViewUtils?.showPropertiesHelp
            ? ViewUtils.showPropertiesHelp({
                translator: k => this.translate(k),
                parent: p,
                cssProvider: this.cssProvider
            })
            : fallbackDialog();
    }

    showThemeItemMenu(theme, triggerWidget, event = null) {
        const isDefaultTheme = theme?.name === 'default';
        return isDefaultTheme
            ? this.showDefaultRestorePointsMenu()
            : this.showThemeContextMenu(theme, triggerWidget, event);
    }

}
