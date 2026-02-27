import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor } from '../../../common/ViewUtils.js';

class AdvancedTabDependencyIsolationDialogSettings {

    buildDependencyIsolationSettingsSection(modeLabels, modeValueLabel) {
        const t = this.t;

        const settingsFrame = new Gtk.Frame({label: t('DEPENDENCY_ISOLATION_SETTINGS')});
        const settingsBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 8, margin: 8});

        const groupingLabel = new Gtk.Label({
            label: `📦 ${t('DEPENDENCY_ISOLATION_GROUPING_MODE')}`,
            xalign: 0,
            margin_bottom: 4
        });
        settingsBox.add(groupingLabel);

        const selectedMode = this.settings.isolation_grouping_mode || 'hybrid';

        const hybridRadio = new Gtk.RadioButton({
            label: t('DEPENDENCY_ISOLATION_MODE_HYBRID'),
            tooltip_text: t('DEPENDENCY_ISOLATION_MODE_HYBRID_TOOLTIP')
        });

        const perRiceRadio = new Gtk.RadioButton({
            label: t('DEPENDENCY_ISOLATION_MODE_PER_RICE'),
            group: hybridRadio,
            tooltip_text: t('DEPENDENCY_ISOLATION_MODE_PER_RICE_TOOLTIP')
        });

        const perProgramRadio = new Gtk.RadioButton({
            label: t('DEPENDENCY_ISOLATION_MODE_PER_PROGRAM'),
            group: hybridRadio,
            tooltip_text: t('DEPENDENCY_ISOLATION_MODE_PER_PROGRAM_TOOLTIP')
        });

        const selectedRadio = ({
            'per-rice': perRiceRadio,
            'per-program': perProgramRadio
        })[selectedMode] || hybridRadio;
        selectedRadio.set_active(true);

        const onModeChanged = () => {
            const newMode = perRiceRadio.get_active()
                ? 'per-rice'
                : (perProgramRadio.get_active() ? 'per-program' : 'hybrid');

            const oldMode = this.settings.isolation_grouping_mode || 'hybrid';
            (newMode !== oldMode) && (
                this.settings.isolation_grouping_mode = newMode,
                this.writeSettingsFile(),
                modeValueLabel.set_text(modeLabels[newMode] || newMode),
                this.themeAppsSection?.setAllIsolationModesToGlobal?.(newMode, oldMode),
                this.notify(t('DEPENDENCY_ISOLATION_MODE_CHANGED').replace('{mode}', t(`DEPENDENCY_ISOLATION_MODE_${newMode.toUpperCase().replace('-', '_')}`)))
            );
        };

        hybridRadio.connect('toggled', onModeChanged);
        perRiceRadio.connect('toggled', onModeChanged);
        perProgramRadio.connect('toggled', onModeChanged);

        const radioBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin_start: 16});
        radioBox.add(hybridRadio);
        radioBox.add(perRiceRadio);
        radioBox.add(perProgramRadio);
        settingsBox.add(radioBox);

        const modeInfoLabel = new Gtk.Label({
            label: `💡 ${t('DEPENDENCY_ISOLATION_MODE_INFO')}`,
            wrap: true,
            xalign: 0,
            margin_top: 8
        });
        modeInfoLabel.get_style_context().add_class('dim-label');
        settingsBox.add(modeInfoLabel);

        const perRiceInfoLabel = new Gtk.Label({
            label: `📝 ${t('DEPENDENCY_ISOLATION_PER_RICE_INFO') || 'Changing global mode updates all rices using the default mode. Individual rice modes can be set in Settings → Theme Apps list.'}`,
            wrap: true,
            xalign: 0,
            margin_top: 4
        });
        perRiceInfoLabel.get_style_context().add_class('dim-label');
        settingsBox.add(perRiceInfoLabel);

        const separator = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL, margin_top: 8, margin_bottom: 8});
        settingsBox.add(separator);

        const patchPostinstallCheckbox = new Gtk.CheckButton({
            label: t('DEPENDENCY_ISOLATION_PATCH_POSTINSTALL'),
            active: this.settings.patch_postinstall_scripts !== false,
            tooltip_text: t('DEPENDENCY_ISOLATION_PATCH_POSTINSTALL_TOOLTIP')
        });

        patchPostinstallCheckbox.connect('toggled', () => {
            this.settings.patch_postinstall_scripts = patchPostinstallCheckbox.get_active();
            this.writeSettingsFile();
        });

        settingsBox.add(patchPostinstallCheckbox);
        settingsFrame.add(settingsBox);

        addPointerCursor(hybridRadio);
        addPointerCursor(perRiceRadio);
        addPointerCursor(perProgramRadio);
        addPointerCursor(patchPostinstallCheckbox);

        return {frame: settingsFrame};
    }

}

export function applyAdvancedTabDependencyIsolationDialogSettings(prototype) {
    copyPrototypeDescriptors(prototype, AdvancedTabDependencyIsolationDialogSettings.prototype);
}
