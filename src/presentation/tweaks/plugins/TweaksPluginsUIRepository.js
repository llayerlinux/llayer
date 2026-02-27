import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { COMMAND_BIN } from './TweaksPluginsConstants.js';
import { addPointerCursor } from '../../common/ViewUtils.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

export const TweaksPluginsUIRepository = {
    createRepositoryListItem(repoData, onRemove) {
        const container = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 8,
            margin_end: 12
        });
        container.get_style_context().add_class('repository-item');

        const icon = this.createLabel('\uD83D\uDCE6', {marginEnd: 4, className: 'repository-success-icon'});

        const infoBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true
        });

        const urlButton = this.createLinkButton(
            repoData.url,
            repoData.url,
            {className: 'repository-url-link', hexpand: true}
        );
        urlButton.get_child?.()?.set_ellipsize?.(3);

        const authorRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 4});
        const authorPrefix = this.createLabel(
            `${this.translate('AUTHOR_LABEL')}:`,
            {xalign: 0, className: 'repository-author-prefix'}
        );

        const authorText = this.createLabel(
            repoData.author || this.translate('UNKNOWN'),
            {xalign: 0, className: 'repository-author-text'}
        );

        authorRow.pack_start(authorPrefix, false, false, 0);
        authorRow.pack_start(authorText, false, false, 0);

        infoBox.pack_start(urlButton, false, false, 0);
        infoBox.pack_start(authorRow, false, false, 0);

        const removeBtn = new Gtk.Button({label: '\u2212'});
        removeBtn.get_style_context().add_class('repo-remove-btn');
        removeBtn.set_tooltip_text(this.translate('PLUGINS_REMOVE_REPO'));
        removeBtn.set_size_request(28, 28);
        addPointerCursor(removeBtn);
        removeBtn.connect('clicked', () => {
            const urlMatch = repoData.url.match(/\/([^\/]+?)(?:\.git)?$/);
            const repoName = urlMatch ? urlMatch[1].replace('.git', '') : null;
            const idx = !repoName ? this.storedRepositories.findIndex(r => r.url === repoData.url) : -1;
            const removeStoredRepository = () => {
                idx !== -1 && (
                    this.storedRepositories.splice(idx, 1),
                    this.writeRepositoriesFile(),
                    onRemove?.()
                );
            };

            switch (true) {
            case !repoName:
                return removeStoredRepository();
            case this.isTerminalRunning?.():
                return;
            default:
                break;
            }

            removeBtn.set_sensitive(false);
            removeBtn.set_label('...');

            this.terminalBuffer && this.showTerminalAt && this.repoSection && this.repositoriesListContainer && (
                this.terminalBuffer.set_text(`$ hyprpm remove ${repoName}\n\n`, -1),
                this.showTerminalAt(this.repoSection, this.repositoriesListContainer),
                this.setTerminalRunning(true)
            );

            const proc = Gio.Subprocess.new(
                [COMMAND_BIN.HYPRPM, 'remove', repoName],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE
            );

            proc.communicate_utf8_async(null, null, (p, res) => {
                const [, stdout] = p.communicate_utf8_finish(res);
                const success = p.get_successful();
                const code = p.get_exit_status();

                this.appendTerminalProcessOutput(stdout, success, code);

                const idx = this.storedRepositories.findIndex(r => r.url === repoData.url);
                idx !== -1 && (
                    this.storedRepositories.splice(idx, 1),
                    this.writeRepositoriesFile()
                );

                onRemove?.();

                this.setTerminalRunning?.(false);

                GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.DEBOUNCE_MS, () => {
                    this.updatePluginsListAsync();
                    return GLib.SOURCE_REMOVE;
                });
            });
        });

        container.pack_start(icon, false, false, 0);
        container.pack_start(infoBox, true, true, 0);
        container.pack_start(removeBtn, false, false, 0);

        return container;
    }
};
