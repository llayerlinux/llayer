import { getWindowControlRecommendationTemplates } from '../../common/WindowControlRecommendations.js';

export function getGlobalRecommendationCategories() {
    return {
        'FLEXIBLE_WINDOW_CONTROL': {
            labelKey: 'MANAGED_WINDOWS',
            defaultLabel: 'Managed Windows',
            author: 'llayer',
            collapsedByDefault: false
        },
        'FLOAT_WORKSPACES': {
            labelKey: 'FLOAT_WORKSPACES',
            defaultLabel: 'Float Workspaces',
            author: 'llayer',
            collapsedByDefault: false
        }
    };
}

export function getGlobalRecommendedSettings() {
    const overridesById = {
        mouse_movewindow: {
            category: 'FLEXIBLE_WINDOW_CONTROL',
            labelKey: 'REC_MOVE_WINDOW',
            label: 'Super + Left Click',
            descriptionKey: 'REC_MOVE_WINDOW_DESC',
            description: 'Hold Super and left-click drag to move windows'
        },
        mouse_resizewindow: {
            category: 'FLEXIBLE_WINDOW_CONTROL',
            labelKey: 'REC_RESIZE_WINDOW',
            label: 'Super + Right Click',
            descriptionKey: 'REC_RESIZE_WINDOW_DESC',
            description: 'Hold Super and right-click drag to resize windows'
        },
        touchpad_clickfinger: {
            category: 'FLEXIBLE_WINDOW_CONTROL',
            labelKey: 'RECOMMENDATION_TOUCHPAD_CLICKFINGER',
            label: 'Enable touchpad clickfinger',
            descriptionKey: 'RECOMMENDATION_TOUCHPAD_CLICKFINGER_DESC',
            description: 'Two-finger tap = right click, three-finger = middle click'
        },
        touchpad_tap_to_click: {
            category: 'FLEXIBLE_WINDOW_CONTROL',
            labelKey: 'RECOMMENDATION_TOUCHPAD_TAP_TO_CLICK',
            label: 'Enable touchpad tap-to-click',
            descriptionKey: 'RECOMMENDATION_TOUCHPAD_TAP_TO_CLICK_DESC',
            description: 'Tap touchpad to click instead of pressing'
        },
        touchpad_tap_button_map: {
            category: 'FLEXIBLE_WINDOW_CONTROL',
            labelKey: 'RECOMMENDATION_TOUCHPAD_TAP_BUTTON_MAP',
            label: 'Set touchpad tap button map (lrm)',
            descriptionKey: 'RECOMMENDATION_TOUCHPAD_TAP_BUTTON_MAP_DESC',
            description: 'Map 1/2/3 finger taps to left/right/middle buttons'
        },
        touchpad_tap_and_drag: {
            category: 'FLEXIBLE_WINDOW_CONTROL',
            labelKey: 'RECOMMENDATION_TOUCHPAD_TAP_AND_DRAG',
            label: 'Enable touchpad tap-and-drag',
            descriptionKey: 'RECOMMENDATION_TOUCHPAD_TAP_AND_DRAG_DESC',
            description: 'Tap and hold, then drag to move/select'
        },
        resize_on_border: {
            category: 'FLEXIBLE_WINDOW_CONTROL',
            labelKey: 'RECOMMENDATION_RESIZE_ON_BORDER',
            label: 'Enable resize on window borders',
            descriptionKey: 'RECOMMENDATION_RESIZE_ON_BORDER_DESC',
            description: 'Drag window borders to resize'
        },
        windowrule_pseudo_all: {
            category: 'FLEXIBLE_WINDOW_CONTROL',
            labelKey: 'RECOMMENDATION_PSEUDO_RULE',
            label: 'Enable pseudo-tiling for all windows',
            descriptionKey: 'RECOMMENDATION_PSEUDO_RULE_DESC',
            description: 'Windows keep their size in tiling layout',
            primaryRule: 'windowrulev2 = pseudo'
        },
        workspace_float_all: {
            category: 'FLOAT_WORKSPACES',
            labelKey: 'RECOMMENDATION_FLOAT_ALL',
            label: 'Float all windows globally (ws 1-10)',
            descriptionKey: 'RECOMMENDATION_FLOAT_ALL_DESC',
            description: 'New windows float by default on selected workspaces'
        }
    };

    return getWindowControlRecommendationTemplates().map((entry) => ({
        ...entry,
        ...(overridesById[entry.id] || {})
    }));
}
