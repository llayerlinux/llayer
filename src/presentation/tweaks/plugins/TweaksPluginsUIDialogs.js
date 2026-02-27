import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import {COMMAND_BIN} from './TweaksPluginsConstants.js';
import {applyOptionalSetters, setupPointerCursors} from '../../common/ViewUtils.js';

export const TweaksPluginsUIDialogs = {
    createDialogLabel(text) {
        return new Gtk.Label({
            label: text,
            halign: Gtk.Align.START
        });
    },

    createDialogEntry({text = null, placeholder = null} = {}) {
        const props = {};
        applyOptionalSetters([
            [text, (value) => {
                props.text = value;
            }],
            [placeholder, (value) => {
                props.placeholder_text = value;
            }, Boolean]
        ]);
        return new Gtk.Entry(props);
    },

    createParamTypeCombo(activeId) {
        const combo = new Gtk.ComboBoxText();
        combo.append('int', this.translate('PLUGINS_PARAM_TYPE_INT'));
        combo.append('string', this.translate('PLUGINS_PARAM_TYPE_STRING'));
        combo.append('color', this.translate('PLUGINS_PARAM_TYPE_COLOR'));
        combo.append('bool', this.translate('PLUGINS_PARAM_TYPE_BOOL'));
        applyOptionalSetters([[activeId, (value) => combo.set_active_id(value), Boolean]]);
        return combo;
    },

    createPluginDialog({ title, defaultWidth, defaultHeight, resizable = true }) {
        const dialog = new Gtk.Dialog({
            title,
            modal: true,
            destroy_with_parent: true,
            default_width: defaultWidth,
            default_height: defaultHeight,
            resizable
        });

        dialog.get_style_context().add_class('plugin-dialog');

        const mainWindow = this.getMainWindow ? this.getMainWindow() : null;
        applyOptionalSetters([[mainWindow, (window) => dialog.set_transient_for(window), (window) => Boolean(window) && window !== dialog]]);

        dialog.set_position(Gtk.WindowPosition.CENTER_ON_PARENT);
        dialog.set_keep_above(true);
        dialog.set_type_hint(Gdk.WindowTypeHint.DIALOG);
        return dialog;
    },

    createParameterForm({ name = '', description = '', type = 'string', defaultValue = '' } = {}) {
        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin: 12
        });

        const nameLabel = this.createDialogLabel(this.translate('PLUGINS_PARAM_NAME_LABEL'));
        const nameEntry = this.createDialogEntry({
            text: name,
            placeholder: this.translate('PLUGINS_PARAM_NAME_PLACEHOLDER')
        });

        const descLabel = this.createDialogLabel(this.translate('PLUGINS_PARAM_DESCRIPTION_LABEL'));
        const descEntry = this.createDialogEntry({
            text: description,
            placeholder: this.translate('PLUGINS_PARAM_DESCRIPTION_PLACEHOLDER')
        });

        const typeLabel = this.createDialogLabel(this.translate('PLUGINS_PARAM_TYPE_LABEL'));
        const typeCombo = this.createParamTypeCombo(type);

        const defaultLabel = this.createDialogLabel(this.translate('PLUGINS_PARAM_DEFAULT_LABEL'));
        const defaultEntry = this.createDialogEntry({
            text: defaultValue,
            placeholder: this.translate('PLUGINS_PARAM_DEFAULT_PLACEHOLDER')
        });

        [
            nameLabel,
            nameEntry,
            descLabel,
            descEntry,
            typeLabel,
            typeCombo,
            defaultLabel,
            defaultEntry
        ].forEach((widget) => mainBox.pack_start(widget, false, false, 0));

        return {
            mainBox,
            nameEntry,
            descEntry,
            typeCombo,
            defaultEntry
        };
    },

    readParameterForm(form) {
        return {
            name: form.nameEntry.get_text().trim(),
            description: form.descEntry.get_text().trim(),
            type: form.typeCombo.get_active_id(),
            defaultRaw: form.defaultEntry.get_text().trim()
        };
    },

    addNewParameter(pluginName, container) {
        let dialog = this.createPluginDialog({
            title: this.translate('PLUGINS_PARAM_DIALOG_TITLE', {plugin: pluginName}),
            defaultWidth: 400,
            defaultHeight: 350,
            resizable: true
        });

        dialog.add_button(this.translate('CANCEL'), Gtk.ResponseType.CANCEL);
        let addButton = dialog.add_button(this.translate('ADD'), Gtk.ResponseType.OK);
        addButton.get_style_context().add_class('plugin-dialog-add-button');

        let contentArea = dialog.get_content_area(),
            form = this.createParameterForm({
            type: 'string'
        });

        contentArea.pack_start(form.mainBox, true, true, 0);
        dialog.show_all();
        setupPointerCursors(dialog);

        dialog.connect('response', (_, response) => {
            if (response === Gtk.ResponseType.OK) {
                let values = this.readParameterForm(form),
                    paramName = values.name,
                    paramDesc = values.description || this.translate('PLUGINS_PARAM_CUSTOM_DESCRIPTION'),
                    paramType = values.type,
                    paramDefault = values.defaultRaw;

                if (paramName && paramType) {
                    let newParam = {
                        name: paramName,
                        description: paramDesc,
                        type: paramType,
                        default: this.convertDefaultValue(paramDefault, paramType),
                        isCustom: true
                    };

                    this.writeCustomParameterInfo(pluginName, paramName, {
                        name: paramName,
                        description: paramDesc,
                        type: paramType,
                        default: newParam.default,
                        isCustom: true
                    });

                    this.applyParamDefault(pluginName, paramName, newParam.default);

                    this.refreshPluginParametersUI(pluginName);

                    this.updatePluginButtonAndContainer(pluginName);

                    this.notify(this.translate('PLUGINS_NOTIFY_PARAM_ADDED', {
                        param: paramName, plugin: pluginName
                    }));
                }
            }
            dialog.destroy();
        });
    },

    editParameter(pluginName, param) {
        const dialog = this.createPluginDialog({
            title: `Edit parameter "${param.name}"`,
            defaultWidth: 450,
            defaultHeight: 400,
            resizable: true
        });

        dialog.add_button(this.translate('CANCEL'), Gtk.ResponseType.CANCEL);
        const deleteButton = dialog.add_button(this.translate('DELETE'), Gtk.ResponseType.REJECT);
        deleteButton.get_style_context().add_class('plugin-dialog-delete-button');
        const okButton = dialog.add_button(this.translate('SAVE'), Gtk.ResponseType.OK);
        okButton.get_style_context().add_class('plugin-dialog-confirm-button');

        const contentArea = dialog.get_content_area();
        const form = this.createParameterForm({
            name: param.name,
            description: this.isCustomParamDefaultDescription(param.description)
                ? this.translate('PLUGINS_PARAM_CUSTOM_DESCRIPTION')
                : (param.description || ''),
            type: param.type,
            defaultValue: param.default === undefined || param.default === null ? '' : String(param.default)
        });
        contentArea.pack_start(form.mainBox, true, true, 0);
        dialog.show_all();
        setupPointerCursors(dialog);

        dialog.connect('response', (_, response) => {
            switch (response) {
                case Gtk.ResponseType.REJECT:
                    this.removeParamCompletely(pluginName, param.name);
                    this.notify(this.translate('PLUGINS_NOTIFY_PARAM_REMOVED', {
                        param: param.name, plugin: pluginName
                    }));
                    break;
                case Gtk.ResponseType.OK: {
                    const values = this.readParameterForm(form);
                    const newName = values.name;
                    const newDesc = values.description || this.translate('PLUGINS_PARAM_CUSTOM_DESCRIPTION');
                    const newType = values.type;
                    const newDefault = values.defaultRaw;

                    if (newName && newType) {
                        const oldName = param.name;

                        if (newName !== oldName) {
                            this.deletePluginParam(pluginName, oldName);
                            this.execSyncCommand(`${COMMAND_BIN.HYPRCTL} keyword plugin:${pluginName}:${oldName} unset`);
                            this.removeCustomParameterInfo(pluginName, oldName);
                        }

                        param.name = newName;
                        param.description = newDesc;
                        param.type = newType;
                        param.default = this.convertDefaultValue(newDefault, newType);

                        this.writeCustomParameterInfo(pluginName, newName, {
                            name: newName, description: newDesc, type: newType, default: param.default, isCustom: true
                        });

                        this.applyParamDefault(pluginName, newName, param.default);
                        this.refreshPluginParametersUI(pluginName);

                        this.notify(this.translate('PLUGINS_NOTIFY_PARAM_UPDATED', {
                            param: newName, plugin: pluginName
                        }));
                    }
                    break;
                }
            }
            dialog.destroy();
        });
    }
};
