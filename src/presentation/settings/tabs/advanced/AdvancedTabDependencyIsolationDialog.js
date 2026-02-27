import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import { addPointerCursor, applyOptionalSetters, setupPointerCursors } from '../../../common/ViewUtils.js';
import { TIMEOUTS } from '../../../../infrastructure/constants/Timeouts.js';
import { applyAdvancedTabDependencyIsolationDialogPrograms } from './AdvancedTabDependencyIsolationDialogPrograms.js';
import { applyAdvancedTabDependencyIsolationDialogProcesses } from './AdvancedTabDependencyIsolationDialogProcesses.js';
import { applyAdvancedTabDependencyIsolationDialogSettings } from './AdvancedTabDependencyIsolationDialogSettings.js';

class AdvancedTabDependencyIsolationDialog {

    createInfoRow(prefixText, valueText, valueClass = null) {
        const row = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 4});
        const prefixLabel = new Gtk.Label({
            label: prefixText,
            halign: Gtk.Align.START,
            xalign: 0
        });
        const valueLabel = new Gtk.Label({
            label: valueText,
            halign: Gtk.Align.START,
            xalign: 0
        });
        applyOptionalSetters([[valueClass, (value) => valueLabel.get_style_context().add_class(value), Boolean]]);
        row.pack_start(prefixLabel, false, false, 0);
        row.pack_start(valueLabel, false, false, 0);
        return {row, valueLabel};
    }


    createDependencyIsolationDialog(enabled) {
        const t = this.t;

        const dialog = new Gtk.Dialog({
            title: t('DEPENDENCY_ISOLATION_TITLE'),
            modal: true,
            resizable: true,
            default_width: 950,
            type_hint: Gdk.WindowTypeHint.DIALOG,
            transient_for: this.dialog
        });
        dialog.set_position(Gtk.WindowPosition.CENTER_ON_PARENT);
        dialog.set_keep_above(true);
        dialog.set_skip_taskbar_hint(true);
        dialog.set_skip_pager_hint(true);
        dialog.get_style_context().add_class('dependency-isolation-popup');

        const mainBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 8, margin: 12, vexpand: false, valign: Gtk.Align.START});

        const infoFrame = new Gtk.Frame({label: t('DEPENDENCY_ISOLATION_STATUS_LABEL')});
        const infoBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin: 8});

        const currentMode = this.settings.isolation_grouping_mode || 'hybrid';
        const modeLabels = {
            'hybrid': `📦 ${t('DEPENDENCY_ISOLATION_MODE_HYBRID') || 'Hybrid'}`,
            'per-rice': `🍚 ${t('DEPENDENCY_ISOLATION_MODE_PER_RICE') || 'Per-Rice'}`,
            'per-program': `🔧 ${t('DEPENDENCY_ISOLATION_MODE_PER_PROGRAM') || 'Per-Program'}`
        };
        const statusRowData = this.createInfoRow(
            `🔒 ${t('DEPENDENCY_ISOLATION_STATUS_LABEL')}:`,
            enabled ? t('DEPENDENCY_ISOLATION_STATUS_ENABLED') : t('DEPENDENCY_ISOLATION_STATUS_DISABLED'),
            enabled ? 'status-enabled' : 'status-disabled'
        );

        const modeRowData = this.createInfoRow(
            `⚙️ ${t('DEPENDENCY_ISOLATION_CURRENT_MODE') || 'Current Mode'}`,
            modeLabels[currentMode] || currentMode,
            'current-mode-label'
        );
        const modeValueLabel = modeRowData.valueLabel;

        const descLabel = new Gtk.Label({
            label: '💡 ' + t('DEPENDENCY_ISOLATION_DESCRIPTION'),
            wrap: true,
            halign: Gtk.Align.START
        });

        const pathLabel = new Gtk.Label({
            label: `📁 ${t('DEPENDENCY_ISOLATION_BASE_PATH')}`,
            halign: Gtk.Align.START
        });

        infoBox.pack_start(statusRowData.row, false, false, 0);
        infoBox.pack_start(modeRowData.row, false, false, 0);
        infoBox.pack_start(descLabel, false, false, 0);
        infoBox.pack_start(pathLabel, false, false, 0);
        infoFrame.add(infoBox);
        mainBox.pack_start(infoFrame, false, false, 0);

        const programsSection = this.buildDependencyIsolationProgramsSection(dialog);
        mainBox.pack_start(programsSection.frame, true, true, 0);

        const processesSection = this.buildDependencyIsolationProcessesSection(dialog);
        mainBox.pack_start(processesSection.frame, true, true, 0);

        const settingsSection = this.buildDependencyIsolationSettingsSection(modeLabels, modeValueLabel);
        mainBox.pack_start(settingsSection.frame, false, false, 0);

        const contentArea = dialog.get_content_area();
        contentArea.pack_start(mainBox, true, true, 0);

        const closeButton = dialog.add_button(t('DEPENDENCY_ISOLATION_CLOSE') || t('CLOSE'), Gtk.ResponseType.CLOSE);
        addPointerCursor(closeButton);
        dialog.connect('response', () => dialog.destroy());

        applyOptionalSetters([[
            dialog.get_action_area(),
            (area) => {
                area.set_margin_end(16);
                area.set_margin_bottom(12);
            }
        ]]);

        dialog.show_all();
        setupPointerCursors(dialog);

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_QUICK_MS, () => {
            programsSection.populateProgramsList();
            processesSection.populateProcessesList();
            return GLib.SOURCE_REMOVE;
        });
    }

}

export function applyAdvancedTabDependencyIsolationDialog(prototype) {
    applyAdvancedTabDependencyIsolationDialogPrograms(prototype);
    applyAdvancedTabDependencyIsolationDialogProcesses(prototype);
    applyAdvancedTabDependencyIsolationDialogSettings(prototype);
    copyPrototypeDescriptors(prototype, AdvancedTabDependencyIsolationDialog.prototype);
}
