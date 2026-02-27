import { getWindowControlRecommendationTemplates } from '../../../common/WindowControlRecommendations.js';

export function getRecommendationCategories() {
    return {
        'MANAGED_WINDOWS': {
            labelKey: 'MANAGED_WINDOWS',
            defaultLabel: 'Managed Windows',
            author: 'llayer',
            collapsedByDefault: false
        }
    };
}

export function getRecommendedSettings() {
    const overridesById = {
        mouse_movewindow: {
            category: 'MANAGED_WINDOWS',
            label: 'Super + Left Click',
            description: 'MOVE_WINDOW_DESC',
            defaultDescription: 'Hold Super and drag to move windows'
        },
        mouse_resizewindow: {
            category: 'MANAGED_WINDOWS',
            label: 'Super + Right Click',
            description: 'RESIZE_WINDOW_DESC',
            defaultDescription: 'Hold Super and drag to resize windows'
        },
        touchpad_clickfinger: {
            category: 'MANAGED_WINDOWS',
            labelKey: 'RECOMMENDATION_TOUCHPAD_CLICKFINGER',
            description: 'RECOMMENDATION_TOUCHPAD_CLICKFINGER_DESC'
        },
        touchpad_tap_to_click: {
            category: 'MANAGED_WINDOWS',
            labelKey: 'RECOMMENDATION_TOUCHPAD_TAP_TO_CLICK',
            description: 'RECOMMENDATION_TOUCHPAD_TAP_TO_CLICK_DESC'
        },
        touchpad_tap_button_map: {
            category: 'MANAGED_WINDOWS',
            labelKey: 'RECOMMENDATION_TOUCHPAD_TAP_BUTTON_MAP',
            description: 'RECOMMENDATION_TOUCHPAD_TAP_BUTTON_MAP_DESC'
        },
        touchpad_tap_and_drag: {
            category: 'MANAGED_WINDOWS',
            labelKey: 'RECOMMENDATION_TOUCHPAD_TAP_AND_DRAG',
            description: 'RECOMMENDATION_TOUCHPAD_TAP_AND_DRAG_DESC'
        },
        resize_on_border: {
            category: 'MANAGED_WINDOWS',
            labelKey: 'RECOMMENDATION_RESIZE_ON_BORDER',
            description: 'RECOMMENDATION_RESIZE_ON_BORDER_DESC'
        },
        windowrule_pseudo_all: {
            category: 'MANAGED_WINDOWS',
            labelKey: 'RECOMMENDATION_PSEUDO_RULE',
            description: 'RECOMMENDATION_PSEUDO_RULE_DESC'
        },
        workspace_float_all: {
            category: 'MANAGED_WINDOWS',
            labelKey: 'RECOMMENDATION_FLOAT_ALL',
            description: 'RECOMMENDATION_FLOAT_ALL_DESC'
        }
    };

    return getWindowControlRecommendationTemplates().map((entry) => ({
        ...entry,
        ...(overridesById[entry.id] || {})
    }));
}
