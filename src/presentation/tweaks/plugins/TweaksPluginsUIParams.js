import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor, applyOptionalSetters } from '../../common/ViewUtils.js';

export const TweaksPluginsUIParams = {
    createPluginParametersContainer(pluginName) {
        const container = this.Box({
            vertical: true, spacing: 4, margin_top: 6, margin_bottom: 6, margin_start: 24, margin_end: 12
        });

        container.get_style_context().add_class('plugin-parameters-container');
        container.pack_start(this.createLabel(
            this.translate('PLUGINS_PARAMETERS_TITLE', {plugin: pluginName}),
            {marginBottom: 4, className: 'plugin-name-label'}
        ), false, false, 0);

        this.getPluginParameters(pluginName).forEach(param => {
            const paramWidget = this.createPluginParameterWidget(pluginName, param);
            paramWidget && container.pack_start(paramWidget, false, false, 0);
        });

        const addButtonContainer = this.Box({
            vertical: false, margin_top: 8, margin_bottom: 6
        });
        addButtonContainer.set_halign(Gtk.Align.CENTER);

        const addButton = new Gtk.Button({
            tooltip_text: this.translate('PLUGINS_ADD_PARAM_TOOLTIP'),
            label: this.translate('PLUGINS_ADD_PARAM_WITH_ICON')
        });

        addButton.get_style_context().add_class('suggested-action');
        addButton.get_style_context().add_class('plugin-add-parameter-button');
        addButton.set_size_request(160, 32);
        addButton._isAddButton = true;
        addPointerCursor(addButton);

        addButton.connect('clicked', () => {
            this.addNewParameter(pluginName, container);
        });

        addButtonContainer.pack_start(addButton, false, false, 0);
        container.pack_start(addButtonContainer, false, false, 0);

        container.pack_start(new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL, margin_top: 4
        }), false, false, 0);

        return container;
    },

    updateAllPluginParametersOnTabSwitch() {
        const bucket = this.ensurePluginParameters();
        Object.keys(bucket ?? {}).forEach((pluginName) => this.refreshPluginParametersUI(pluginName));
    },

    createPluginParameterWidget(pluginName, param) {
        const paramBox = this.Box({
            vertical: false, spacing: 8, margin_top: 2, margin_bottom: 2
        });

        const labelBox = this.Box({
            vertical: true, spacing: 1, hexpand: true
        });

        const nameContainer = this.Box({
            vertical: false, spacing: 6, hexpand: true
        });

        const nameLabel = new Gtk.Label({
            label: this.translatePluginParamLabel(param),
            halign: Gtk.Align.START,
            hexpand: false
        });
        nameLabel.get_style_context().add_class('plugin-name-label');

        const editButton = new Gtk.Button({
            tooltip_text: this.translate('PLUGINS_EDIT_PARAM_TOOLTIP'), relief: Gtk.ReliefStyle.NONE
        });
        editButton.set_size_request(20, 20);

        const editLabel = new Gtk.Label({label: '\u270F\uFE0F'});
        editLabel.get_style_context().add_class('plugin-edit-icon');

        editButton.add(editLabel);
        editButton.get_style_context().add_class('plugin-edit-button');
        addPointerCursor(editButton);

        editButton.connect('clicked', () => {
            this.editParameter(pluginName, param);
        });

        nameContainer.pack_start(nameLabel, false, false, 0);
        nameContainer.pack_start(editButton, false, false, 0);
        nameContainer.pack_end(new Gtk.Label({label: '', hexpand: true}), true, true, 0);

        labelBox.pack_start(nameContainer, false, false, 0);

        this.translatePluginParamDescription(param)?.trim?.().length > 0 && (() => {
            const descLabel = new Gtk.Label({
                label: this.translatePluginParamDescription(param),
                halign: Gtk.Align.START,
                wrap: true
            });
            descLabel.get_style_context().add_class('plugin-description');
            labelBox.pack_start(descLabel, false, false, 0);
        })();

        const inputWidget = this.createParamWidget(pluginName, param);

        inputWidget && (() => {
            inputWidget._pluginName = pluginName;
            inputWidget._pluginParam = param;
            paramBox.pack_start(labelBox, true, true, 0);
            paramBox.pack_start(inputWidget, false, false, 0);
        })();

        return paramBox;
    },

    updatePluginParametersValues(pluginName, container) {
        this.debugPluginParametersCache(`updating values for ${pluginName}`);

        const widgets = this.getAllWidgetsInContainer(container);

        widgets.forEach(widget => {
            if (!(widget._pluginParam && widget._pluginName === pluginName)) {
                return;
            }
            const param = widget._pluginParam;
            const currentValue = this.getParamCurrentValue(pluginName, param, param.default);

            switch (param.type) {
                case 'int': {
                    const intValue = parseInt(currentValue);
                    const normalizedValue = isNaN(intValue) ? param.default : intValue;
                    widget.set_value(normalizedValue);
                    break;
                }
                case 'bool':
                    widget.set_active(currentValue === 1 || currentValue === true || currentValue === 'true');
                    break;
                case 'color': {
                    const colorValue = typeof (currentValue ?? param.default) === 'number'
                        ? this.convertNumberToHex(currentValue ?? param.default)
                        : String(currentValue ?? param.default ?? '0xffffffff');
                    widget?._colorEntry && (
                        widget._colorEntry.set_text(
                            colorValue.match(/^0x[0-9a-fA-F]{6,8}$/)
                                ? colorValue
                                : String(param.default ?? '0xffffffff')
                        ),
                        typeof currentValue === 'number' && this.setPluginParam(pluginName, param.name, colorValue)
                    );
                    break;
                }
                case 'string':
                    widget?.set_text?.(String(currentValue ?? param.default ?? ''));
                    break;
                case 'enum':
                    applyOptionalSetters([[widget, (value) => value.set_active_id(String(currentValue ?? param.default ?? '')), Boolean]]);
                    break;
                default:
                    break;
            }
        });
    },

    refreshPluginParametersUI(pluginName) {
        const pluginsBox = this.pluginsOuterGlobal?.get_child?.(),
              widgets = pluginsBox && this.getAllWidgetsInContainer(pluginsBox)
                  .filter((item) => item?.get_style_context?.()?.has_class?.('plugin-parameters-container')),
              match = widgets && widgets.find((widget) => widget.get_parent?.()
                  && this.getAllWidgetsInContainer(widget).some((child) => child?._pluginName === pluginName));
        if (!match) return;

        const parent = match.get_parent?.(),
              newContainer = this.createPluginParametersContainer(pluginName);
        parent.pack_start(newContainer, false, false, 0);
        parent.remove(match);
        newContainer.show_all?.();
        this.debugPluginParametersCache(`after UI rebuild ${pluginName}`);
    }
};
