import {ViewTabName} from '../../common/Constants.js';

export class HeaderBar {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.createIcon = deps.createIcon || (() => null);
        this.onTabSwitch = deps.onTabSwitch || (() => {
        });
        this.onExitTweaks = deps.onExitTweaks || (() => {
        });
        this.registerTranslation = deps.registerTranslation || (() => {
        });
        this.Box = deps.Box;
        this.Button = deps.Button;
        this.currentTab = ViewTabName.INSTALLED;
        this.btnInstalled = null;
        this.btnNetwork = null;
        this.parametersBtn = null;
        this.moreSectionsBtn = null;
        this.aboutBtn = null;
    }

    build() {
        this.btnInstalled = this.Button({label: this.t('INSTALLED_TAB')});
        this.btnNetwork = this.Button({label: this.t('NETWORK_TAB')});
        this.parametersBtn = this.Button({
            className: 'my-theme-selector-icon-button',
            child: this.createIcon('preferences-other-symbolic', 24),
            tooltipText: this.t('TWEAKS_ICON_TOOLTIP')
        });
        this.moreSectionsBtn = this.Button({
            className: 'my-theme-selector-icon-button',
            child: this.createIcon('open-menu-symbolic', 24),
            tooltipText: this.t('MORE_SECTIONS_ICON_TOOLTIP')
        });
        this.aboutBtn = this.Button({
            className: 'my-theme-selector-icon-button',
            child: this.createIcon('help-about-symbolic', 24),
            tooltipText: this.t('ABOUT_ICON_TOOLTIP')
        });
        const translationBindings = [
            [this.btnInstalled, 'INSTALLED_TAB', (w, txt) => w.set_label(txt)],
            [this.btnNetwork, 'NETWORK_TAB', (w, txt) => w.set_label(txt)],
            [this.parametersBtn, 'TWEAKS_ICON_TOOLTIP', (w, txt) => w.set_tooltip_text(txt)],
            [this.moreSectionsBtn, 'MORE_SECTIONS_ICON_TOOLTIP', (w, txt) => w.set_tooltip_text(txt)],
            [this.aboutBtn, 'ABOUT_ICON_TOOLTIP', (w, txt) => w.set_tooltip_text(txt)]
        ];
        translationBindings.forEach(([widget, key, setter]) => this.registerTranslation(widget, key, setter));

        const clickBindings = [
            [this.btnInstalled, ViewTabName.INSTALLED],
            [this.btnNetwork, ViewTabName.NETWORK],
            [this.parametersBtn, ViewTabName.SETTINGS],
            [this.moreSectionsBtn, ViewTabName.MORE_SECTIONS],
            [this.aboutBtn, ViewTabName.ABOUT]
        ];
        clickBindings.forEach(([button, tab]) => button.connect('clicked', () => this.handleTabClick(tab)));
        this.setActiveTab(ViewTabName.INSTALLED);
        return this.Box({
            className: 'my-theme-selector-tabs', spacing: 1, margin_top: 0, margin_bottom: 0,
            children: [this.btnInstalled, this.btnNetwork, this.Box({hexpand: true}), this.Box({
                spacing: 0,
                children: [this.parametersBtn, this.moreSectionsBtn, this.aboutBtn]
            })]
        });
    }

    handleTabClick(tab) {
        (this.currentTab === ViewTabName.SETTINGS && tab !== ViewTabName.SETTINGS) && this.onExitTweaks();
        this.setActiveTab(tab);
        this.onTabSwitch(tab);
    }

    setActiveTab(tab) {
        this.currentTab = tab;
        this.btnInstalled?.get_style_context().remove_class('active');
        this.btnNetwork?.get_style_context().remove_class('active');
        this.parametersBtn?.get_style_context().remove_class('active');
        switch (tab) {
            case ViewTabName.INSTALLED:
                this.btnInstalled?.get_style_context().add_class('active');
                break;
            case ViewTabName.NETWORK:
                this.btnNetwork?.get_style_context().add_class('active');
                break;
            case ViewTabName.SETTINGS:
                this.parametersBtn?.get_style_context().add_class('active');
                break;
        }
    }

    getCurrentTab() {
        return this.currentTab;
    }

    getWidgets() {
        return {
            btnInstalled: this.btnInstalled,
            btnNetwork: this.btnNetwork,
            parametersBtn: this.parametersBtn,
            moreSectionsBtn: this.moreSectionsBtn,
            aboutBtn: this.aboutBtn
        };
    }
}
