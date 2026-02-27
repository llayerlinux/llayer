import Gtk from 'gi://Gtk?version=3.0';
import { applyParams } from '../../infrastructure/utils/Utils.js';
import { runMessageDialog } from '../common/ViewUtils.js';

export class MoreSectionsController {

    constructor(container, store, logger = null) {
        this.container = container;
        this.store = store;
        this.logger = logger;
        this.view = null;
        this.translations = null;
        this.mainController = null;

        this.soundService = container.get('soundService');
        this.notifier = container.get('notifier');
        this.fixHyprlandUseCase = container.has?.('fixHyprlandUseCase')
            ? container.get('fixHyprlandUseCase')
            : null;

        this.isFixingHyprland = false;
        this.translator = container?.has?.('translator') ? container.get('translator') : null;
    }

    setView(view) {
        this.view = view;
        view?.setController?.(this);
    }

    setTranslations(translations) {
        this.translations = translations;
    }

    setMainController(mainController) {
        this.mainController = mainController;
    }

    handleSectionClick(section) {
        const {type, badge} = section ?? {};
        const isDevBadge = typeof badge === 'string' && badge.includes('dev.png');

        switch (type) {
            case 'contest':
                return isDevBadge ? this.handleDevSection(section) : this.handleContestSection();
            case 'fix-hyprland':
                return this.handleFixHyprlandSection();
            case 'dev':
            case 'cli':
            case 'grub':
            case 'refind':
            case 'login-rices':
                return this.handleDevSection(section);
            default:
                return this.handleUnknownSection(section);
        }
    }

    handleContestSection() {
        this.mainController?.handleTabSwitch?.('rice-contest');
    }

    handleFixHyprlandSection() {
        return this.isFixingHyprland
            ? undefined
            : (() => {
                this.isFixingHyprland = true;

                const settings = this.getSettings() ?? {};
                const result = this.fixHyprlandUseCase.execute({
                    playSound: true,
                    settingsThemeHint: settings.theme
                });

                result.success
                    ? (() => {
                        const message = result.themeReapplied
                            ? this.translate('FIX_HYPRLAND_SUCCESS')
                            : this.getBaseSuccessMessage();
                        this.showFixHyprlandResultDialog(message, true);
                    })()
                    : this.showFixHyprlandResultDialog(
                        result.error || this.translate('FIX_HYPRLAND_ERROR'),
                        false
                    );

                this.isFixingHyprland = false;
            })();
    }

    getBaseSuccessMessage() {
        return this.translate('FIX_HYPRLAND_BASE_SUCCESS');
    }

    getParentWindow() {
        return (this.view?.window instanceof Gtk.Window)
            ? this.view.window
            : (() => {
                const themeSelectorView = this.container?.has?.('themeSelectorView')
                    ? this.container.get('themeSelectorView')
                    : null;
                return themeSelectorView?.window instanceof Gtk.Window ? themeSelectorView.window : null;
            })();
    }

    showFixHyprlandResultDialog(message, isSuccess = true) {
        const parentWindow = this.getParentWindow();

        const translate = (key) => this.mainController?.translate?.(key) || this.translator?.(key) || key;
        runMessageDialog({
            parent: parentWindow,
            messageType: isSuccess ? Gtk.MessageType.INFO : Gtk.MessageType.ERROR,
            buttons: Gtk.ButtonsType.OK,
            title: translate('FIX_HYPRLAND_SECTION'),
            secondaryText: message,
            keepAbove: true,
            urgencyHint: true,
            present: true
        });
    }

    showDevSectionDialog(sectionName) {
        const parentWindow = this.getParentWindow();

        runMessageDialog({
            parent: parentWindow,
            messageType: Gtk.MessageType.INFO,
            buttons: Gtk.ButtonsType.OK,
            title: sectionName,
            secondaryText: this.translate('MORE_SECTIONS_DEV_IN_PROGRESS')
        });
    }

    handleDevSection(section) {
        const inProgress = !!(section.badge && section.badge.includes('dev.png'));
        return inProgress
            ? this.showDevSectionDialog(section.name)
            : this.showNotImplementedMessage(section.name, this.translate('MORE_SECTIONS_COMING_SOON', {
                section: section.name
            }));
    }

    handleUnknownSection(section) {
        this.showNotImplementedMessage(section.name, this.translate('MORE_SECTIONS_NOT_IMPLEMENTED'));
    }

    showNotImplementedMessage(sectionName, message) {
        const title = this.translate('MORE_SECTIONS_INFO_TITLE', {section: sectionName});
        this.notifier.notify('info', title, message);
    }

    getSettings() {
        const state = this.store.getState();
        return state.settings ?? {};
    }

    translate(key, params = null) {
        const raw = this.translator ? this.translator(key, params || undefined) : null;
        const base = typeof key === 'string' ? key : String(key ?? '');
        return typeof raw === 'string' ? raw : applyParams(base, params ?? {});
    }

    log(level, message, data = null) {
        this.logger?.[level]?.('MoreSectionsController', message, data);
    }

    destroy() {
        this.container = this.store = this.view = this.translations = this.mainController =
            this.logger = this.soundService = this.notifier = this.fixHyprlandUseCase = null;
    }
}
