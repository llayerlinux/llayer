import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';

export function applyAdvancedTabBuild(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, AdvancedTabBuild.prototype);
}

class AdvancedTabBuild {
    createTabLabel(text) {
        const tabLabel = new Gtk.Label({label: text});
        tabLabel.set_margin_left(10);
        tabLabel.set_margin_right(10);
        return tabLabel;
    }

    build() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 2,
            margin_bottom: 16,
            margin_start: 20,
            margin_end: 20
        });

        this.buildExecutionPropertiesSection(box);
        this.buildDependencyIsolationSection(box);
        this.addSeparator(box, 3);
        this.buildSupportedBarsSection(box);
        this.buildBarSettingsSection(box);
        this.addSeparator(box);

        this.themeAppsSection && (() => {
            const {frame} = this.themeAppsSection.build();
            box.pack_start(frame, false, false, 0);
            box.pack_start(this.themeAppsSection.buildNote(), false, false, 0);
        })();

        const tabLabel = this.createTabLabel(this.t('ADVANCED_TAB'));

        return {box, tabLabel};
    }
}
