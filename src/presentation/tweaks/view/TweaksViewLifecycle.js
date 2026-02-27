import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

export function applyTweaksViewLifecycle(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, TweaksViewLifecycle.prototype);
}

class TweaksViewLifecycle {
    present() {
        this.buildTweaksInterface();
        return this.tweaksNotebookGlobal;
    }

    close() {
        this.exitTweaksTab();
    }

    createTabLabel(textKey) {
        const label = new Gtk.Label({
            label: this.translate(textKey)
        });
        label.get_style_context().add_class('tweaks-tab-label');
        label.set_margin_left(10);
        label.set_margin_right(10);
        return label;
    }

    ensureNotebook() {
        !this.tweaksNotebookGlobal && (() => {
            this.tweaksNotebookGlobal = new Gtk.Notebook({hexpand: true, vexpand: true});
            this.tweaksNotebookGlobal.set_show_border(true);
            this.tweaksNotebookGlobal.set_margin_top(4);
            this.tweaksNotebookGlobal.set_margin_bottom(4);
            this.tweaksNotebookGlobal.set_margin_start(4);
            this.tweaksNotebookGlobal.set_margin_end(4);
            this.tweaksNotebookGlobal.set_show_tabs(true);
            this.tweaksNotebookGlobal.set_tab_pos(Gtk.PositionType.TOP);
            this.tweaksNotebookGlobal.get_style_context().add_class('tweaks-notebook');
            this.tweaksNotebookGlobal.connect('switch-page', (_, __, pageNum) => {
                pageNum === 2 && GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.TAB_SWITCH_DELAY_MS, () => (this.updateAllPluginParametersOnTabSwitch(), GLib.SOURCE_REMOVE));
            });
        })();
    }

    ensureBasicOuter() {
        !this.basicOuterGlobal && (
            this.basicOuterGlobal = this.Box({vertical: true, hexpand: true, vexpand: true, margin_start: 2, margin_end: 2}),
            this.basicOuterGlobal.get_style_context().add_class('tweaks-basic-container')
        );
    }

    ensureTweaksBox() {
        !this.tweaksBoxGlobal && this.createAllUIElements(10, 5, 5, 20, 1, true, true);
    }

    attachTweaksBox() {
        this.tweaksBoxGlobal && (() => {
            const parent = this.tweaksBoxGlobal.get_parent();
            parent && parent !== this.basicOuterGlobal && parent.remove(this.tweaksBoxGlobal);
            !this.tweaksBoxGlobal.get_parent() && this.basicOuterGlobal.pack_start(this.tweaksBoxGlobal, true, true, 0);
        })();
    }

    appendTab(condition, contentFn, labelKey) {
        condition && (() => {
            const content = contentFn();
            this.tweaksNotebookGlobal.append_page(content, this.createTabLabel(labelKey));
            content.show_all();
        })();
    }

    buildTweaksInterface() {
        this.ensureNotebook();
        this.ensureBasicOuter();
        this.ensureTweaksBox();
        this.attachTweaksBox();

        const pages = this.tweaksNotebookGlobal.get_n_pages();
        [
            {condition: pages === 0, build: () => this.basicOuterGlobal, labelKey: 'PLUGINS_BASIC_TAB'},
            {condition: pages <= 1, build: () => this.createAdvancedTab(), labelKey: 'PLUGINS_ADVANCED_TAB'},
            {condition: pages <= 2, build: () => this.createPluginsTab(), labelKey: 'PLUGINS_TAB'}
        ].forEach(({condition, build, labelKey}) => this.appendTab(condition, build, labelKey));

        this.tweaksNotebookGlobal.set_current_page(0);
        this.tweaksNotebookGlobal.show_all();
    }
}
