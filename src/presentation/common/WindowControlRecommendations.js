function getWindowControlRecommendationTemplates() {
    return [
        {
            type: 'keybind',
            id: 'mouse_movewindow',
            bindType: 'bindm',
            modifiers: ['SUPER'],
            key: 'mouse:272',
            dispatcher: 'movewindow',
            args: '',
            demoGif: 'movewindow.gif'
        },
        {
            type: 'keybind',
            id: 'mouse_resizewindow',
            bindType: 'bindm',
            modifiers: ['SUPER'],
            key: 'mouse:273',
            dispatcher: 'resizewindow',
            args: '',
            demoGif: 'resizewindow.gif',
            dependents: [
                'touchpad_clickfinger',
                'touchpad_tap_to_click',
                'touchpad_tap_button_map',
                'touchpad_tap_and_drag',
                'resize_on_border',
                'windowrule_pseudo_all'
            ]
        },
        {
            type: 'param',
            id: 'touchpad_clickfinger',
            parentId: 'mouse_resizewindow',
            defaultValue: 'true',
            paramPath: 'input:touchpad:clickfinger_behavior'
        },
        {
            type: 'param',
            id: 'touchpad_tap_to_click',
            parentId: 'mouse_resizewindow',
            defaultValue: 'true',
            paramPath: 'input:touchpad:tap-to-click'
        },
        {
            type: 'param',
            id: 'touchpad_tap_button_map',
            parentId: 'mouse_resizewindow',
            defaultValue: 'lrm',
            paramPath: 'input:touchpad:tap_button_map'
        },
        {
            type: 'param',
            id: 'touchpad_tap_and_drag',
            parentId: 'mouse_resizewindow',
            defaultValue: 'true',
            paramPath: 'input:touchpad:tap-and-drag'
        },
        {
            type: 'param',
            id: 'resize_on_border',
            parentId: 'mouse_resizewindow',
            defaultValue: 'true',
            paramPath: 'general:resize_on_border'
        },
        {
            type: 'rule',
            id: 'windowrule_pseudo_all',
            parentId: 'mouse_resizewindow',
            ruleLine: 'windowrulev2 = pseudo, class:.*'
        },
        {
            type: 'workspaceRule',
            id: 'workspace_float_all',
            demoGif: 'floatwindow.gif',
            ruleTemplate: 'workspace = {ws}, defaultFloat:true',
            workspaces: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        }
    ];
}

export { getWindowControlRecommendationTemplates };
