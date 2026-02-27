import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import { addPointerCursor } from '../../common/ViewUtils.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

export const TweaksPluginsUIPluginList = {
    createPluginListItem(plugin, onAction) {
        const unknownAuthor = this.translate('UNKNOWN');
        const authorName = (typeof plugin?.author === 'string' && plugin.author.trim().length)
            ? plugin.author
            : unknownAuthor;
        const repositoryUrl = typeof plugin?.repositoryUrl === 'string' ? plugin.repositoryUrl.trim() : '';

        const container = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12
        });

        plugin.isCore && container.get_style_context().add_class('core-plugin-container');

        const statusIcon = this.createLabel(
            plugin.isCore ? '\uD83D\uDD35' : (plugin.enabled ? '\uD83D\uDFE2' : '\uD83D\uDD34'),
            {marginEnd: 8}
        );

        const infoBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL, spacing: 4, hexpand: true
        });

        const nameLabel = this.createLabel(
            typeof plugin?.name === 'string' ? plugin.name : String(plugin?.name ?? ''),
            {className: 'plugin-name-label'}
        );

        const detailsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL, spacing: 4, halign: Gtk.Align.START
        });

        const authorPrefix = this.createLabel(
            `${this.translate('AUTHOR_LABEL')}:`,
            {className: 'plugin-author-status'}
        );

        const authorWidget = (repositoryUrl && authorName !== unknownAuthor)
            ? this.createLinkButton(
                repositoryUrl,
                authorName,
                {className: 'plugin-author-link'}
            )
            : this.createLabel(authorName, {className: 'plugin-author-status'});

        const statusLabel = this.createLabel(
            `| ${this.translate('PLUGINS_STATUS_LABEL')}: ${plugin.isCore
                ? this.translate('PLUGINS_STATUS_SYSTEM')
                : (plugin.enabled ? this.translate('PLUGINS_STATUS_ENABLED') : this.translate('PLUGINS_STATUS_DISABLED'))}`,
            {className: 'plugin-author-status'}
        );

        detailsBox.pack_start(authorPrefix, false, false, 0);
        detailsBox.pack_start(authorWidget, false, false, 0);
        detailsBox.pack_start(statusLabel, false, false, 0);

        infoBox.pack_start(nameLabel, false, false, 0);

        const description = typeof plugin?.description === 'string' ? plugin.description.trim() : '';
        description && infoBox.pack_start(
            this.createLabel(description, {wrap: true, xalign: 0, className: 'plugin-description'}),
            false,
            false,
            0
        );

        infoBox.pack_start(detailsBox, false, false, 0);

        const buttonsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL, spacing: 8
        });

        if (!plugin.isCore) {
            const isEnabled = plugin.enabled;
            const action = isEnabled ? 'disable' : 'enable';
            const button = new Gtk.Button({
                label: this.translate(isEnabled ? 'PLUGINS_DISABLE' : 'PLUGINS_ENABLE'),
                margin_end: 4
            });

            button.get_style_context().add_class(isEnabled ? 'destructive-action' : 'suggested-action');
            addPointerCursor(button);
            button.connect('clicked', () => {
                button.set_label(this.translate(isEnabled ? 'PLUGINS_DISABLING' : 'PLUGINS_ENABLING'));
                button.set_sensitive(false);
                onAction(action, plugin.name, null);
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.FALLBACK_TIMEOUT_MS, () => {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                        this.loadPluginsList();
                        while (Gtk.events_pending()) {
                            Gtk.main_iteration();
                        }
                        return GLib.SOURCE_REMOVE;
                    });
                    return GLib.SOURCE_REMOVE;
                });
            });

            buttonsBox.pack_start(button, false, false, 0);
        }

        container.pack_start(statusIcon, false, false, 0);
        container.pack_start(infoBox, true, true, 0);
        container.pack_start(buttonsBox, false, false, 0);

        const separator = new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL, margin_top: 8
        });

        const itemBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });

        itemBox._pluginName = plugin.name;
        itemBox.pack_start(container, false, false, 0);
        itemBox.pack_start(separator, false, false, 0);

        if (plugin.enabled && !plugin.isCore) {
            const hasParams = this.hasPluginParameters(plugin.name);
            const paramsBtn = new Gtk.Button({
                label: hasParams ? this.translate('PLUGINS_SHOW_PARAMS') : this.translate('PLUGINS_ADD_PARAM')
            });
            paramsBtn.get_style_context().add_class('suggested-action');
            paramsBtn.get_style_context().add_class('plugin-params-button');
            addPointerCursor(paramsBtn);

            const bindParamsToggle = () => {
                const paramsContainer = this.createPluginParametersContainer(plugin.name);
                let paramsVisible = true;
                paramsBtn.set_label(this.translate('PLUGINS_HIDE_PARAMS'));
                paramsBtn.connect('clicked', () => {
                    paramsVisible = !paramsVisible;
                    paramsContainer.set_visible(paramsVisible);
                    paramsBtn.set_label(
                        paramsVisible ? this.translate('PLUGINS_HIDE_PARAMS') : this.translate('PLUGINS_SHOW_PARAMS')
                    );
                    paramsVisible && this.updatePluginParametersValues(plugin.name, paramsContainer);
                });
                itemBox.pack_start(paramsContainer, false, false, 0);
                paramsContainer.set_visible(true);
                this.updatePluginParametersValues(plugin.name, paramsContainer);
            };

            const bindAddParam = () => paramsBtn.connect('clicked', () => {
                this.addNewParameter(plugin.name, null);
            });

            (hasParams ? bindParamsToggle : bindAddParam)();

            buttonsBox.pack_start(paramsBtn, false, false, 0);
        }

        return itemBox;
    }
};
