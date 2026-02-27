import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { COMMAND_BIN } from './TweaksPluginsConstants.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

export const TweaksPluginsTabRepositories = {
    buildRepositoriesSection(state) {
        let repoSection = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL, spacing: 8, margin_bottom: 16
        });

        let repoLabel = this.createLabel(
            this.translate('PLUGINS_MANAGE_REPOS'),
            {marginBottom: 8, className: 'tweaks-category-title'}
        );

        let repositoriesListContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin_bottom: 8
        });
        repositoriesListContainer.get_style_context().add_class('repositories-list-container');

        let repositoriesScrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: false,
            max_content_height: 300,
            min_content_height: 180,
            propagate_natural_height: true
        });
        repositoriesScrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        repositoriesScrolled.get_style_context().add_class('repositories-scrolled');

        let repositoriesListBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL, spacing: 2
        });
        repositoriesListBox.get_style_context().add_class('repositories-list');

        repositoriesScrolled.add(repositoriesListBox);
        repositoriesListContainer.pack_start(repositoriesScrolled, true, true, 0);

        let refreshRepositoriesList = () => {
            repositoriesListBox.get_children().forEach(child => repositoriesListBox.remove(child));

            let storedRepos = this.getStoredRepositories(),
                itemHeight = 58,
                repoCount = storedRepos.length,
                calculatedHeight = Math.max(70, Math.min(300, repoCount * itemHeight + 16));

            repositoriesScrolled.set_min_content_height(calculatedHeight);
            repositoriesScrolled.set_max_content_height(Math.max(calculatedHeight, 300));

            if (repoCount === 0) {
                repositoriesListContainer.hide();
                return;
            }

            repositoriesListContainer.show();
            storedRepos.forEach(repoData => {
                const repoItem = this.createRepositoryListItem(repoData, () => {
                    refreshRepositoriesList();
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.FEEDBACK_LONG_MS, () => {
                        this.updatePluginsListAsync();
                        return GLib.SOURCE_REMOVE;
                    });
                });
                repositoriesListBox.pack_start(repoItem, false, false, 0);
            });
            repositoriesListContainer.show_all();
            repositoriesScrolled.queue_resize();
        };

        let repoInputBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, margin_bottom: 8
        });

        let repoEntry = new Gtk.Entry({
            placeholder_text: this.translate('PLUGINS_REPO_PLACEHOLDER'), text: '', hexpand: true
        });

        let addRepoBtn = this.createActionButton(
            this.translate('PLUGINS_ADD_REPO'),
            ['suggested-action']
        );

        let updateReposBtn = this.createActionButton(
            this.translate('PLUGINS_REFRESH_REPOS')
        );

        addRepoBtn.connect('clicked', () => {
            let url = repoEntry.get_text().trim();
            if (url && !state.isRunning) {
                state.isRunning = true;
                addRepoBtn.set_sensitive(false);
                addRepoBtn.set_label(this.translate('PLUGINS_ADDING_REPO'));

                this.terminalBuffer.set_text(`$ hyprpm add ${url}\n\n`, -1);
                this.showTerminalAt(repoSection, repoInputBox);

                let proc = Gio.Subprocess.new(
                    [COMMAND_BIN.HYPRPM, 'add', url],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE
                );

                proc.communicate_utf8_async(null, null, (p, res) => {
                    let [, stdout] = p.communicate_utf8_finish(res),
                        success = p.get_successful(),
                        code = p.get_exit_status();

                    this.appendTerminalProcessOutput(stdout, success, code);

                    if (success) {
                        let repoInfo = this.extractRepositoryInfo(url),
                            newRepo = {
                            url: url,
                            author: repoInfo.author,
                            authorUrl: repoInfo.authorUrl,
                            platform: repoInfo.platform
                        };

                        let exists = this.storedRepositories.some(r => r.url === url);
                        if (!exists) {
                            this.storedRepositories.push(newRepo);
                            this.writeRepositoriesFile();
                        }

                        repoEntry.set_text('');
                        refreshRepositoriesList();

                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.FEEDBACK_SHORT_MS, () => {
                            this.updatePluginsListAsync();
                            return GLib.SOURCE_REMOVE;
                        });
                    }

                    addRepoBtn.set_label(this.translate('PLUGINS_ADD_REPO'));
                    addRepoBtn.set_sensitive(true);
                    state.isRunning = false;
                });
            }
        });

        repoInputBox.pack_start(repoEntry, true, true, 0);
        repoInputBox.pack_start(addRepoBtn, false, false, 0);
        repoInputBox.pack_start(updateReposBtn, false, false, 0);

        repoSection.pack_start(repoLabel, false, false, 0);
        repoSection.pack_start(repositoriesListContainer, false, false, 0);
        repoSection.pack_start(repoInputBox, false, false, 0);

        this.repoSection = repoSection;
        this.repositoriesListContainer = repositoriesListContainer;

        return {
            repoSection,
            repositoriesListContainer,
            refreshRepositoriesList
        };
    }
};
