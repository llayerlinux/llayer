import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import {WINDOW_HINT_METHODS} from './AppSettingsViewConstants.js';
import {setupPointerCursors} from '../../common/ViewUtils.js';

export function applyAppSettingsViewBuild(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, AppSettingsViewBuild.prototype);
}

class AppSettingsViewBuild {
    buildTab(TabClass, options, fallbackLabel) {
        const instance = TabClass ? new TabClass(options) : null;
        const fallback = {
            box: new Gtk.Box(),
            tabLabel: new Gtk.Label({label: fallbackLabel})
        };
        const {box, tabLabel} = instance?.build?.() || fallback;
        return {instance, box, tabLabel};
    }

    build() {
        const currentSettings = this.store?.snapshot?.settings ?? {};
        const compatSettings = this.compat.composeSnapshot(currentSettings);

        this.compat.syncGlobals(compatSettings);
        this.replaceFormState(compatSettings);

        const settings = this.settingsProxy;
        const widgets = this.widgets;

        const {translator: t, translations} = this.compat.setupLegacyEnvironment({
            viewInstance: this,
            view: this,
            settings,
            widgets
        });
        this.translate = t;
        this.translations = translations;

        this.controller?.ensureThemeApplied?.();

        const dialog = new Gtk.Dialog({
            title: t('SETTINGS_TITLE'),
            modal: true,
            resizable: false,
            default_width: 400,
            default_height: 500
        });

        const selectorView = this.container?.has?.('themeSelectorView')
            ? this.container.get('themeSelectorView')
            : null;
        const parent = selectorView?.window || this.mainWindow || null;
        const cssProvider = selectorView?.cssProvider || null;
        parent && dialog.set_transient_for?.(parent);

        WINDOW_HINT_METHODS.forEach(method => dialog[method]?.(true));

        dialog.set_size_request(520, 580);
        dialog.set_position(Gtk.WindowPosition.CENTER_ALWAYS);
        dialog.get_style_context().add_class('lastlayer-settings-dialog');
        dialog.get_style_context().add_class('config-dialog');
        cssProvider && dialog.get_style_context().add_provider(
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(0);
        contentArea.set_margin_top(0);
        contentArea.set_margin_bottom(0);
        contentArea.get_style_context().add_class('lastlayer-settings-content');

        dialog.get_action_area && (() => {
            const actionArea = dialog.get_action_area();
            actionArea.set_margin_top(16);
            actionArea.set_margin_bottom(16);
            actionArea.set_margin_left(16);
            actionArea.set_margin_right(16);
            actionArea.set_spacing(8);
            actionArea.get_style_context().add_class('lastlayer-settings-actions');
        })();

        const notebook = new Gtk.Notebook();
        notebook.set_show_border(false);
        notebook.set_show_tabs(true);
        notebook.set_tab_pos(Gtk.PositionType.TOP);
        notebook.get_style_context().add_class('tweaks-notebook');
        notebook.get_style_context().add_class('lastlayer-settings-notebook');

        const styleTabPage = (widget, variant = 'basic') => {
            const context = widget?.get_style_context?.();
            if (!context) {
                return widget;
            }

            context.add_class('lastlayer-settings-page');
            context.add_class(
                variant === 'advanced'
                    ? 'tweaks-advanced-container'
                    : 'tweaks-basic-container'
            );
            return widget;
        };

        const deps = {
            t,
            settings,
            widgets,
            translations,
            view: this,
            dialog,
            styleSeparator: (sep) => sep,
            getSystemGtkThemes: () => this.getSystemGtkThemes()
        };

        const supporterProvider = this.container?.get?.('supporterProvider');
        const hasSupporter = supporterProvider?.isActive?.();

        this.ThemeAppsSection && (this.sections.themeApps = new this.ThemeAppsSection({
            t,
            settings,
            widgets,
            themeRepository: this.themeRepository,
            container: this.container,
            onSkipListChanged: (skipList) => {
                this.formState.skip_install_theme_apps = skipList;
                this.store?.patch?.({ skip_install_theme_apps: skipList });
                this.controller?.writeSettingsFile?.();
            },
            onIsolationModesChanged: (modes) => {
                this.formState.per_rice_isolation_mode = modes;
                this.store?.patch?.({ per_rice_isolation_mode: modes });
                this.controller?.writeSettingsFile?.();
            }
        }));

        this.SecuritySection && (this.sections.security = new this.SecuritySection({
            t,
            settings,
            onPatternsChanged: (buffer) => {
                this.securityBuffer = buffer;
            },
            onExceptionsChanged: (buffer) => {
                this.exceptionsBuffer = buffer;
            }
        }));

        const settingsTab = this.buildTab(this.SettingsTab, {
            ...deps,
            getSystemGtkThemes: () => this.getSystemGtkThemes()
        }, 'Settings');
        const {box: rawSettingsBox, tabLabel: settingsTabLabel} = settingsTab;
        const settingsBox = styleTabPage(rawSettingsBox, 'basic');

        const advancedTab = this.buildTab(this.AdvancedTab, {
            ...deps,
            BarRegistry: this.BarRegistry,
            themeAppsSection: this.sections.themeApps,
            writeSettingsFile: () => this.controller?.writeSettingsFile?.(),
            notify: (msg) => this.controller?.notifier?.info?.(msg)
        }, 'Advanced');
        const {box: rawAdvancedBox, tabLabel: advancedTabLabel} = advancedTab;
        const advancedBox = styleTabPage(rawAdvancedBox, 'advanced');
        this.tabs.advanced = advancedTab.instance;

        const parameterService = this.container?.has?.('hyprlandParameterService')
            ? this.container.get('hyprlandParameterService') : null;
        const settingsManager = this.container?.has?.('settingsManager')
            ? this.container.get('settingsManager') : null;
        const overrideTabClass = hasSupporter && this.OverrideTab ? this.OverrideTab : this.HyprlandTab;
        const overrideTab = this.buildTab(overrideTabClass, {
            ...deps,
            parameterService,
            themeRepository: this.themeRepository,
            settingsManager,
            parentWindow: dialog,
            onOverridesChanged: () => {
                this.controller?.writeSettingsFile?.();
            }
        }, 'Override');
        const {box: rawOverrideBox, tabLabel: overrideTabLabel} = overrideTab;
        const overrideBox = styleTabPage(rawOverrideBox, 'advanced');
        this.tabs.override = overrideTab.instance;

        const startPointTab = this.buildTab(this.StartPointTab, {
            ...deps
        }, 'StartPoint');
        const {box: rawStartPointBox, tabLabel: startPointTabLabel} = startPointTab;
        const startPointBox = styleTabPage(rawStartPointBox, 'basic');

        let importTab = null, importBox = null, importTabLabel = null;
        if (hasSupporter && this.ImportTab) {
            importTab = this.buildTab(this.ImportTab, {
                ...deps,
                container: this.container
            }, 'Import');
            importBox = styleTabPage(importTab.box, 'advanced');
            importTabLabel = importTab.tabLabel;
        }

        const securityTab = this.buildSecurityTab(t, settings);
        const {box: rawSecurityBox, tabLabel: securityTabLabel} = securityTab;
        const securityBox = styleTabPage(rawSecurityBox, 'advanced');

        let systemTab = null, systemBox = null, systemTabLabel = null;
        if (hasSupporter && this.SystemTab) {
            systemTab = this.buildTab(this.SystemTab, {
                ...deps
            }, 'System');
            systemBox = styleTabPage(systemTab.box, 'advanced');
            systemTabLabel = systemTab.tabLabel;
        }

        let debugTab = null, debugBox = null, debugTabLabel = null;
        if (hasSupporter && this.DebugTab) {
            debugTab = this.buildTab(this.DebugTab, {
                ...deps,
                settingsManager,
                eventBus: this.bus,
                container: this.container
            }, 'Debug');
            debugBox = styleTabPage(debugTab.box, 'advanced');
            debugTabLabel = debugTab.tabLabel;
        }

        const helpTab = this.buildTab(this.HelpTab, {t}, 'Help');
        const {box: rawHelpBox, tabLabel: helpTabLabel} = helpTab;
        const helpBox = styleTabPage(rawHelpBox, 'basic');

        const currentDir = this.container.has('currentDir') ? this.container.get('currentDir') : GLib.get_current_dir();
        const settingsState = this.store?.snapshot?.settings ?? {};
        const aboutTab = this.buildTab(this.AboutTab, {
            t,
            makeRoundedPixbuf: this.makeRoundedPixbuf,
            loadStartupData: () => this.loadStartupDataInternal(),
            isUpdateVersionIgnored: (v) => this.isUpdateVersionIgnored(v),
            playSupportClickSound: () => this.playSupportClickSound(),
            assetsPath: `${currentDir}/assets`,
            thanksUrl: settingsState.thanksUrl
        }, 'About');
        const {box: rawAboutBox, tabLabel: aboutTabLabel} = aboutTab;
        const aboutBox = styleTabPage(rawAboutBox, 'basic');
        this.tabs.about = aboutTab.instance;

        notebook.append_page(settingsBox, settingsTabLabel);
        notebook.append_page(advancedBox, advancedTabLabel);
        notebook.append_page(overrideBox, overrideTabLabel);
        notebook.append_page(startPointBox, startPointTabLabel);
        hasSupporter && importBox && notebook.append_page(importBox, importTabLabel);
        notebook.append_page(securityBox, securityTabLabel);
        hasSupporter && systemBox && notebook.append_page(systemBox, systemTabLabel);
        hasSupporter && debugBox && notebook.append_page(debugBox, debugTabLabel);
        notebook.append_page(helpBox, helpTabLabel);
        notebook.append_page(aboutBox, aboutTabLabel);

        notebook.connect('switch-page', (nb, page) => {
            const tabLabel = nb.get_tab_label_text(page) || '';
            const advLabel = t('ADVANCED_TAB').toLowerCase();
            (tabLabel.toLowerCase().includes(advLabel) || tabLabel.toLowerCase().includes('advanced'))
                && this.sections.themeApps?.refresh?.();
        });

        const btnCancel = dialog.add_button(t('CANCEL'), Gtk.ResponseType.CANCEL);
        const btnCommit = dialog.add_button(t('SETTINGS_OK'), Gtk.ResponseType.OK);

        btnCancel.get_style_context().add_class('cancel-btn');
        btnCommit.get_style_context().add_class('commit-btn');
        btnCommit.get_style_context().add_class('suggested-action');

        contentArea.pack_start(notebook, true, true, 0);

        dialog.connect('response', async (_dlg, responseId) => (
            responseId === Gtk.ResponseType.OK
                ? this.handleCommit()
                : this.handleCancel()
        ));

        dialog.show_all();
        setupPointerCursors(dialog);

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.sections.themeApps?.refresh?.();
            return GLib.SOURCE_REMOVE;
        });

        return dialog;
    }
}
