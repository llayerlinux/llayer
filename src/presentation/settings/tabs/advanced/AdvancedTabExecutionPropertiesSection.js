import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor } from '../../../common/ViewUtils.js';

function syncDependentCheck(check, allow) {
    check.set_sensitive(allow);
    !allow && check.get_active() && check.set_active(false);
}

export function applyAdvancedTabExecutionPropertiesSection(targetPrototype) {
    targetPrototype.buildExecutionPropertiesSection = function(box) {
        const frame = new Gtk.Frame({label: this.t('THEME_EXECUTION_PROPERTIES')});
        frame.set_margin_top(8);
        frame.set_margin_bottom(8);

        const propsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const showInstallCheck = this.createCheckbox(
            'SHOW_INSTALL_TERMINAL',
            this.settings.show_install_terminal
        );
        this.widgets.showInstallTerminalCheck = showInstallCheck;

        const showAfterInstallCheck = this.createCheckbox(
            'SHOW_AFTER_INSTALL_TERMINAL',
            this.settings.show_after_install_terminal
        );
        this.widgets.showAfterInstallTerminalCheck = showAfterInstallCheck;

        const autoCloseInstallCheck = this.createCheckbox(
            'AUTO_CLOSE_INSTALL_TERMINAL',
            this.settings.auto_close_install_terminal,
            this.settings.show_install_terminal
        );
        this.widgets.autoCloseInstallTerminalCheck = autoCloseInstallCheck;

        const autoCloseAfterInstallCheck = this.createCheckbox(
            'AUTO_CLOSE_AFTER_INSTALL_TERMINAL',
            this.settings.auto_close_after_install_terminal,
            this.settings.show_after_install_terminal
        );
        this.widgets.autoCloseAfterInstallTerminalCheck = autoCloseAfterInstallCheck;

        const forceHideCheck = this.createCheckbox(
            'FORCE_HIDE_SCRIPT_TERMINALS',
            this.settings.force_hide_script_terminals
        );
        this.widgets.forceHideScriptTerminalsCheck = forceHideCheck;

        const patcherHoldCheck = this.createCheckbox(
            'PATCHER_HOLD_TERMINAL',
            this.settings.patcher_hold_terminal
        );
        this.widgets.patcherHoldTerminalCheck = patcherHoldCheck;

        const syncDependencies = () => {
            let hideActive = forceHideCheck.get_active();
            let showInstallActive = showInstallCheck.get_active();
            let patchHoldActive = patcherHoldCheck.get_active();

            showInstallCheck.set_sensitive(!hideActive);
            syncDependentCheck(autoCloseInstallCheck, !hideActive && showInstallActive && !patchHoldActive);
            syncDependentCheck(autoCloseAfterInstallCheck, showAfterInstallCheck.get_active());
        };

        showInstallCheck.connect('toggled', this.guardStoreUpdate(() => {
            const isActive = showInstallCheck.get_active();
            syncDependentCheck(autoCloseInstallCheck, isActive);
            this.settings.show_install_terminal = isActive;
            isActive && forceHideCheck.get_active() && forceHideCheck.set_active(false);
            syncDependencies();
        }));

        showAfterInstallCheck.connect('toggled', this.guardStoreUpdate(() => {
            const isActive = showAfterInstallCheck.get_active();
            syncDependentCheck(autoCloseAfterInstallCheck, isActive);
            this.settings.show_after_install_terminal = isActive;
            syncDependencies();
        }));

        autoCloseInstallCheck.connect('toggled', this.guardStoreUpdate(() => {
            this.settings.auto_close_install_terminal = autoCloseInstallCheck.get_active();
            syncDependencies();
        }));

        autoCloseAfterInstallCheck.connect('toggled', this.guardStoreUpdate(() => {
            this.settings.auto_close_after_install_terminal = autoCloseAfterInstallCheck.get_active();
            syncDependencies();
        }));

        forceHideCheck.connect('toggled', this.guardStoreUpdate(() => {
            const isActive = forceHideCheck.get_active();
            this.settings.force_hide_script_terminals = isActive;
            isActive && showInstallCheck.get_active() && showInstallCheck.set_active(false);
            isActive && autoCloseInstallCheck.get_active() && autoCloseInstallCheck.set_active(false);
            syncDependencies();
        }));

        patcherHoldCheck.connect('toggled', this.guardStoreUpdate(() => {
            const isActive = patcherHoldCheck.get_active();
            this.settings.patcher_hold_terminal = isActive;
            isActive && autoCloseInstallCheck.get_active() && autoCloseInstallCheck.set_active(false);
            syncDependencies();
        }));

        propsBox.pack_start(showInstallCheck, false, false, 0);
        propsBox.pack_start(showAfterInstallCheck, false, false, 0);
        propsBox.pack_start(autoCloseInstallCheck, false, false, 0);
        propsBox.pack_start(autoCloseAfterInstallCheck, false, false, 0);

        const terminalSeparator = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        terminalSeparator.set_margin_top(8);
        terminalSeparator.set_margin_bottom(8);
        propsBox.pack_start(terminalSeparator, false, false, 0);

        propsBox.pack_start(forceHideCheck, false, false, 0);
        propsBox.pack_start(patcherHoldCheck, false, false, 0);

        const note = this.createClassedLabel(`* ${this.t('TERMINAL_DISPLAY_NOTE')}`, null, {wrap: true, xalign: 0});
        note.set_margin_top(8);
        propsBox.pack_start(note, false, false, 0);

        const timingSeparator = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        timingSeparator.set_margin_top(12);
        timingSeparator.set_margin_bottom(8);
        propsBox.pack_start(timingSeparator, false, false, 0);

        const timingBtn = new Gtk.Button({
            label: this.t('TIMING_SETTINGS_BTN')
        });
        timingBtn.set_tooltip_text(this.t('TIMING_SETTINGS_DESC'));
        addPointerCursor(timingBtn);
        timingBtn.connect('clicked', () => this.showTimingSettingsPopup());
        propsBox.pack_start(timingBtn, false, false, 0);

        syncDependencies();

        frame.add(propsBox);
        box.pack_start(frame, false, false, 0);
    };
}
