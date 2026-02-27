import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import { COMMAND_BIN } from './TweaksPluginsConstants.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

export const TweaksPluginsTabPluginsList = {
    buildPluginsListSection() {
        const pluginsListContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL, spacing: 0
        });

        const pluginsListHeaderBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, margin_bottom: 8
        });

        const pluginsListLabel = this.createLabel(
            this.translate('PLUGINS_INSTALLED_LIST'),
            {className: 'tweaks-category-title'}
        );
        pluginsListLabel.set_hexpand(true);

        const refreshListBtn = this.createActionButton(
            this.translate('PLUGINS_REFRESH_LIST'),
            ['suggested-action']
        );

        const reloadAllBtn = this.createActionButton(
            this.translate('PLUGINS_RELOAD_ALL'),
            ['destructive-action']
        );

        pluginsListHeaderBox.pack_start(pluginsListLabel, true, true, 0);
        pluginsListHeaderBox.pack_start(reloadAllBtn, false, false, 0);
        pluginsListHeaderBox.pack_start(refreshListBtn, false, false, 0);

        this.pluginsListBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL, spacing: 4
        });
        this.pluginsListBox._isPluginsListBox = true;

        pluginsListContainer.pack_start(pluginsListHeaderBox, false, false, 0);
        pluginsListContainer.pack_start(this.pluginsListBox, false, false, 0);

        this.pluginsListContainer = pluginsListContainer;

        refreshListBtn.connect('clicked', () => {
            this.updatePluginsListAsync();
        });

        reloadAllBtn.connect('clicked', async () => {
            reloadAllBtn.set_sensitive(false);
            reloadAllBtn.set_label(this.translate('PLUGINS_RELOADING'));
            await this.processPluginReload(reloadAllBtn);
        });

        return {
            pluginsListContainer
        };
    },

    writeEnabledPluginParameters() {
        (this.getHyprpmPluginsList() ?? [])
            .filter(plugin => plugin.enabled && !plugin.isCore)
            .forEach(plugin => {
                let bucket = this.getPluginParamBucket(plugin.name);
                this.getPluginParameters(plugin.name).forEach(param => {
                    bucket[param.name] === undefined
                        && (bucket[param.name] = this.getPluginOption(plugin.name, param.name, param.default));
                });
            });
        this.writePluginParametersFile();
    },

    loadPluginsList() {
        this.writeEnabledPluginParameters();

        if (!this.pluginsListContainer) return;

        const children = this.pluginsListContainer.get_children?.() ?? [];
        children.forEach(child => {
            this.pluginsListContainer.remove(child);
        });

        const plugins = this.getHyprpmPluginsList();
        if (!plugins.length) {
            const emptyLabel = this.createLabel(
                this.translate('PLUGINS_NOT_FOUND'),
                {halign: Gtk.Align.CENTER, wrap: true, className: 'repositories-empty-label', marginTop: 32, marginBottom: 32}
            );
            emptyLabel.set_valign(Gtk.Align.CENTER);
            this.pluginsListContainer.pack_start(emptyLabel, false, false, 0);
            this.pluginsListContainer.show_all();
            return;
        }

        plugins.forEach(plugin => {
            const pluginItem = this.createPluginListItem(plugin, (action, pluginName) => {
                switch (action) {
                case 'enable':
                    this.execAsync([COMMAND_BIN.HYPRPM, 'enable', pluginName]);
                    break;
                case 'disable':
                    this.execAsync([COMMAND_BIN.HYPRPM, 'disable', pluginName]);
                    break;
                }
            });
            this.pluginsListContainer.pack_start(pluginItem, false, false, 0);
        });

        this.pluginsListContainer.show_all();
    },

    async reloadHyprpmPlugins() {
        await this.execAsync([COMMAND_BIN.HYPRPM, 'reload']);
        return true;
    },

    async processPluginReload(reloadAllBtn) {
        await this.reloadHyprpmPlugins();

        this.notify(this.translate('PLUGINS_RELOADED'));

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.FEEDBACK_SHORT_MS, () => {
            this.updatePluginsListAsync();
            return GLib.SOURCE_REMOVE;
        });

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_IMMEDIATE_MS, () => {
            reloadAllBtn.set_sensitive(true);
            reloadAllBtn.set_label(this.translate('PLUGINS_RELOAD_ALL'));
            return GLib.SOURCE_REMOVE;
        });
    },

    async updatePluginsListAsync() {
        this.loadPluginsList();
    },

    updatePluginUI(pluginName) {
        this.loadPluginsList();
    },

    updatePluginButtonAndContainer(pluginName) {
        this.loadPluginsList();
    }
};
