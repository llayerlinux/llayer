import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import {addPointerCursor} from '../../../common/ViewUtils.js';
import { applyAdvancedTabDependencyIsolationDialog } from './AdvancedTabDependencyIsolationDialog.js';

export function applyAdvancedTabDependencyIsolationUI(targetPrototype) {
    applyAdvancedTabDependencyIsolationDialog(targetPrototype);
    copyPrototypeDescriptors(targetPrototype, AdvancedTabDependencyIsolationUI.prototype);
}

class AdvancedTabDependencyIsolationUI {

    buildDependencyIsolationSection(box) {
        const isolationContainer = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4});
        isolationContainer.set_margin_top(8);

        const isolationCheckbox = new Gtk.CheckButton({
            label: this.t('DEPENDENCY_ISOLATION_CHECKBOX'),
            active: this.settings.enable_dependency_isolation !== false
        });
        this.widgets.isolationCheckbox = isolationCheckbox;
        isolationCheckbox.set_tooltip_text(this.t('DEPENDENCY_ISOLATION_TOOLTIP'));

        isolationCheckbox.connect('toggled', this.guardStoreUpdate(() => {
            const enabled = isolationCheckbox.get_active();
            this.settings.enable_dependency_isolation = enabled;

            const themeAppsSection = this.themeAppsSection;
            themeAppsSection?.[
                enabled ? 'restoreIsolationModes' : 'setAllIsolationModesDisabled'
            ]?.call(themeAppsSection);

            this.writeSettingsFile();
        }));

        const infoButton = new Gtk.Button({
            label: '⚙️',
            tooltip_text: this.t('DEPENDENCY_ISOLATION_INFO_BUTTON_TOOLTIP')
        });
        infoButton.set_size_request(32, 32);
        addPointerCursor(infoButton);
        infoButton.connect('clicked', () => this.showDependencyIsolationInfo(isolationCheckbox.get_active()));

        const checkboxContainer = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
        checkboxContainer.pack_start(isolationCheckbox, false, false, 0);

        const helpInfoButton = new Gtk.Button();
        const iconImage = new Gtk.Image();
        iconImage.set_from_icon_name?.('dialog-information-symbolic', Gtk.IconSize.SMALL_TOOLBAR);
        helpInfoButton.set_image?.(iconImage);
        helpInfoButton.get_style_context().add_class('circular');
        helpInfoButton.get_style_context().add_class('flat');
        helpInfoButton.set_tooltip_text(this.t('DEPENDENCY_ISOLATION_HELP_TOOLTIP') || 'Help');
        addPointerCursor(helpInfoButton);
        helpInfoButton.connect('clicked', () => this.showIsolationHelpDialog());
        checkboxContainer.pack_start(helpInfoButton, false, false, 0);

        const isolationRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        isolationRow.pack_start(checkboxContainer, false, false, 0);
        isolationRow.pack_end(infoButton, false, false, 0);

        isolationContainer.pack_start(isolationRow, false, false, 0);

        const isolationNote = new Gtk.Label({
            label: '🔒 ' + this.t('DEPENDENCY_ISOLATION_NEW_DESCRIPTION'),
            wrap: true,
            xalign: 0
        });
        isolationNote.set_margin_top(4);
        isolationNote.get_style_context().add_class('tweaks-info-message');
        isolationContainer.pack_start(isolationNote, false, false, 0);

        box.pack_start(isolationContainer, false, false, 0);
    }

    showDependencyIsolationInfo(isolationEnabled) {

        this.createDependencyIsolationDialog(isolationEnabled);
    }

}
