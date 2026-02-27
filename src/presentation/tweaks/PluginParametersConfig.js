export const PLUGIN_PARAMETERS = {
    'borders-plus-plus': [
        {
            name: 'add_borders',
            type: 'int',
            min: 0,
            max: 10,
            default: 1,
            label: 'Additional borders',
            description: 'Number of extra border layers.',
            labelKey: 'PLUGIN_PARAM_ADD_BORDERS',
            descriptionKey: 'PLUGIN_PARAM_ADD_BORDERS_DESC'
        },
        {
            name: 'col.border_1',
            type: 'color',
            default: '0xffffffff',
            label: 'Primary border color',
            description: 'Color of the first border layer.',
            labelKey: 'PLUGIN_PARAM_COL_BORDER_1',
            descriptionKey: 'PLUGIN_PARAM_COL_BORDER_1_DESC'
        },
        {
            name: 'col.border_2',
            type: 'color',
            default: '0xff444444',
            label: 'Secondary border color',
            description: 'Color of the second border layer.',
            labelKey: 'PLUGIN_PARAM_COL_BORDER_2',
            descriptionKey: 'PLUGIN_PARAM_COL_BORDER_2_DESC'
        },
        {
            name: 'border_size_1',
            type: 'int',
            min: 0,
            max: 20,
            default: 10,
            label: 'Primary border thickness',
            description: 'Width of the first border layer (px).',
            labelKey: 'PLUGIN_PARAM_BORDER_SIZE_1',
            descriptionKey: 'PLUGIN_PARAM_BORDER_SIZE_1_DESC'
        },
        {
            name: 'border_size_2',
            type: 'int',
            min: 0,
            max: 20,
            default: -1,
            label: 'Secondary border thickness',
            description: 'Width of the second border layer (px). Use -1 to disable.',
            labelKey: 'PLUGIN_PARAM_BORDER_SIZE_2',
            descriptionKey: 'PLUGIN_PARAM_BORDER_SIZE_2_DESC'
        }
    ],
    'hyprbars': [
        {
            name: 'bar_color',
            type: 'color',
            default: '0xff333333',
            label: 'Bar color',
            description: 'Background color of the Hyprbars strip.',
            labelKey: 'PLUGIN_PARAM_BAR_COLOR',
            descriptionKey: 'PLUGIN_PARAM_BAR_COLOR_DESC'
        },
        {
            name: 'bar_height',
            type: 'int',
            min: 10,
            max: 50,
            default: 15,
            label: 'Bar height',
            description: 'Height of the Hyprbars strip (px).',
            labelKey: 'PLUGIN_PARAM_BAR_HEIGHT',
            descriptionKey: 'PLUGIN_PARAM_BAR_HEIGHT_DESC'
        },
        {
            name: 'bar_text_size',
            type: 'int',
            min: 8,
            max: 24,
            default: 10,
            label: 'Text size',
            description: 'Font size used for Hyprbars text.',
            labelKey: 'PLUGIN_PARAM_BAR_TEXT_SIZE',
            descriptionKey: 'PLUGIN_PARAM_BAR_TEXT_SIZE_DESC'
        },
        {
            name: 'bar_text_font',
            type: 'string',
            default: 'Ubuntu',
            label: 'Text font',
            description: 'Font family used for Hyprbars text.',
            labelKey: 'PLUGIN_PARAM_BAR_TEXT_FONT',
            descriptionKey: 'PLUGIN_PARAM_BAR_TEXT_FONT_DESC'
        },
        {
            name: 'bar_button_padding',
            type: 'int',
            min: 0,
            max: 20,
            default: 5,
            label: 'Button padding',
            description: 'Padding around Hyprbars buttons (px).',
            labelKey: 'PLUGIN_PARAM_BAR_BUTTON_PADDING',
            descriptionKey: 'PLUGIN_PARAM_BAR_BUTTON_PADDING_DESC'
        },
        {
            name: 'bar_padding',
            type: 'int',
            min: 0,
            max: 20,
            default: 10,
            label: 'Bar padding',
            description: 'Inner padding applied to the Hyprbars strip (px).',
            labelKey: 'PLUGIN_PARAM_BAR_PADDING',
            descriptionKey: 'PLUGIN_PARAM_BAR_PADDING_DESC'
        }
    ],
    'hyprexpo': [
        {
            name: 'columns',
            type: 'int',
            min: 1,
            max: 10,
            default: 3,
            label: 'Columns',
            description: 'Number of columns shown in Hyprexpo.',
            labelKey: 'PLUGIN_PARAM_COLUMNS',
            descriptionKey: 'PLUGIN_PARAM_COLUMNS_DESC'
        },
        {
            name: 'gap_size',
            type: 'int',
            min: 0,
            max: 50,
            default: 5,
            label: 'Gap size',
            description: 'Gap between Hyprexpo windows (px).',
            labelKey: 'PLUGIN_PARAM_GAP_SIZE',
            descriptionKey: 'PLUGIN_PARAM_GAP_SIZE_DESC'
        },
        {
            name: 'bg_col',
            type: 'color',
            default: '0xff111111',
            label: 'Background color',
            description: 'Background color used by Hyprexpo.',
            labelKey: 'PLUGIN_PARAM_BG_COL',
            descriptionKey: 'PLUGIN_PARAM_BG_COL_DESC'
        },
        {
            name: 'workspace_method',
            type: 'string',
            default: 'center current',
            label: 'Workspace method',
            description: 'Layout method used to arrange workspaces.',
            labelKey: 'PLUGIN_PARAM_WORKSPACE_METHOD',
            descriptionKey: 'PLUGIN_PARAM_WORKSPACE_METHOD_DESC'
        }
    ],
    'hyprwinwrap': [
        {
            name: 'class',
            type: 'string',
            default: 'kitty-bg',
            label: 'Window class',
            description: 'Window class to wrap with Hyprwinwrap.',
            labelKey: 'PLUGIN_PARAM_CLASS',
            descriptionKey: 'PLUGIN_PARAM_CLASS_DESC'
        }
    ],
    'hyprtrails': [
        {
            name: 'color',
            type: 'color',
            default: '0xffff0000',
            label: 'Trail color',
            description: 'Color of the Hyprtrails cursor trail.',
            labelKey: 'PLUGIN_PARAM_COLOR',
            descriptionKey: 'PLUGIN_PARAM_COLOR_DESC'
        }
    ],
    'hyprfocus': [
        {
            name: 'enabled',
            type: 'bool',
            default: true,
            label: 'Enabled',
            description: 'Toggle Hyprfocus effects.',
            labelKey: 'PLUGIN_PARAM_ENABLED',
            descriptionKey: 'PLUGIN_PARAM_ENABLED_DESC'
        },
        {
            name: 'animate_floating',
            type: 'bool',
            default: true,
            label: 'Animate floating windows',
            description: 'Animate focus effects for floating windows.',
            labelKey: 'PLUGIN_PARAM_ANIMATE_FLOATING',
            descriptionKey: 'PLUGIN_PARAM_ANIMATE_FLOATING_DESC'
        },
        {
            name: 'animate_workspacechange',
            type: 'bool',
            default: true,
            label: 'Animate workspace change',
            description: 'Animate focus when switching workspaces.',
            labelKey: 'PLUGIN_PARAM_ANIMATE_WORKSPACECHANGE',
            descriptionKey: 'PLUGIN_PARAM_ANIMATE_WORKSPACECHANGE_DESC'
        }
    ]
};
