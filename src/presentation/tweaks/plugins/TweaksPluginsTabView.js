import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { COMMAND_BIN } from './TweaksPluginsConstants.js';
import { addPointerCursor } from '../../common/ViewUtils.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

export const TweaksPluginsTabView = {
    createPluginsTab() {
        this.pluginsOuterGlobal = new Gtk.ScrolledWindow({
            hexpand: true, vexpand: true, margin_top: 0, margin_bottom: 0, margin_start: 0, margin_end: 0
        });
        this.pluginsOuterGlobal.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.pluginsOuterGlobal.get_style_context().add_class('plugins-scrolled');

        const pluginsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 16,
            margin_bottom: 16,
            margin_start: 16,
            margin_end: 16
        });

        pluginsBox.pack_start(this.createLabel(
            `\uD83D\uDD0C ${this.translate('PLUGINS_MANAGE_TITLE')}`,
            {marginBottom: 4, className: 'tweaks-accent-header'}
        ), false, false, 0);

        const infoFrame = new Gtk.Frame();
        infoFrame.set_shadow_type(Gtk.ShadowType.IN);
        infoFrame.get_style_context().add_class('tweaks-info-frame');

        const infoContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const infoRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 4});
        infoRow.pack_start(this.createLabel(
            this.translate('PLUGINS_INFO_TITLE'),
            {xalign: 0, className: 'orange-accent'}
        ), false, false, 0);
        infoRow.pack_start(this.createLabel(
            this.translate('PLUGINS_INFO_DESCRIPTION'),
            {xalign: 0, wrap: true}
        ), true, true, 0);

        infoContainer.pack_start(infoRow, false, false, 0);
        infoFrame.add(infoContainer);
        pluginsBox.pack_start(infoFrame, false, false, 0);

        const noticeRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_bottom: 8
        });

        noticeRow.pack_start(this.createLabel(
            `\u26A0\uFE0F ${this.translate('PLUGINS_REINSTALL_NOTICE')}`,
            {xalign: 0, wrap: true, className: 'footnote'}
        ), false, false, 0);

        const reinstallBtnBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 4});
        const reinstallIcon = Gtk.Image.new_from_file(
            GLib.build_filenamev([GLib.get_current_dir(), 'assets', 'icons', 'uv-layer-shell.svg'])
        );
        reinstallIcon.set_pixel_size(14);
        const reinstallBtnLabel = new Gtk.Label({label: this.translate('PLUGINS_REINSTALL_BTN')});
        reinstallBtnBox.pack_start(reinstallIcon, false, false, 0);
        reinstallBtnBox.pack_start(reinstallBtnLabel, false, false, 0);

        const reinstallBtn = new Gtk.Button();
        reinstallBtn.add(reinstallBtnBox);
        reinstallBtn.get_style_context().add_class('warning-action');
        addPointerCursor(reinstallBtn);

        noticeRow.pack_start(reinstallBtn, false, false, 0);

        const {terminalBuffer, state} = this.initPluginsTerminal();

        reinstallBtn.connect('clicked', () => {
            switch (true) {
            case state.isRunning:
                return;
            case state.terminalOpen:
                this.hideTerminal();
                return;
            default:
                break;
            }

            state.isRunning = true;
            reinstallBtn.set_sensitive(false);
            reinstallBtnLabel.set_label('...');
            terminalBuffer.set_text('$ hyprpm update\n\n', -1);
            this.showTerminalAt(pluginsBox, noticeRow);

            const proc = Gio.Subprocess.new(
                [COMMAND_BIN.HYPRPM, 'update'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE
            );

            proc.communicate_utf8_async(null, null, (p, res) => {
                const [, stdout] = p.communicate_utf8_finish(res);
                const clean = (stdout || '').replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\[2K/g, '');
                terminalBuffer.insert(terminalBuffer.get_end_iter(), clean, -1);

                terminalBuffer.insert(
                    terminalBuffer.get_end_iter(),
                    `\n[${p.get_successful() ? 'OK' : 'Error'}, code ${p.get_exit_status()}]\n`,
                    -1
                );

                if (p.get_successful()) {
                    this.updatePluginsListAsync();
                }
                reinstallBtnLabel.set_label('fix hyprpm');
                reinstallBtn.set_sensitive(true);
                state.isRunning = false;
            });
        });

        pluginsBox.pack_start(noticeRow, false, false, 0);

        const repositoriesSection = this.buildRepositoriesSection(state);

        const separator = new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL, margin_top: 4, margin_bottom: 4
        });

        pluginsBox.pack_start(repositoriesSection.repoSection, false, false, 0);
        pluginsBox.pack_start(separator, false, false, 0);
        pluginsBox.pack_start(this.buildPluginsListSection().pluginsListContainer, false, false, 0);

        this.pluginsOuterGlobal.add(pluginsBox);

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.DEBOUNCE_MS, () => {
            repositoriesSection.refreshRepositoriesList();
            this.updatePluginsListAsync();
            return GLib.SOURCE_REMOVE;
        });

        return this.pluginsOuterGlobal;
    }
};
