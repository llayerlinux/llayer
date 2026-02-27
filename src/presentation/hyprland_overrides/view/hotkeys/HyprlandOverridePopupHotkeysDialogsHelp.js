import { showHelpPopover } from '../../../common/HelpPopoverShared.js';

const HOTKEY_HELP_ITEM_DEFINITIONS = [
    {
        icon: 'input-keyboard-symbolic',
        titleKey: 'HELP_SEARCH_KEY_MODE',
        titleDefault: 'Key Mode (keyboard icon)',
        descKey: 'HELP_SEARCH_KEY_MODE_DESC',
        descDefault: 'Captures modifier keys in realtime. Double Backspace removes last key.'
    },
    {
        icon: 'font-x-generic-symbolic',
        titleKey: 'HELP_SEARCH_TEXT_MODE',
        titleDefault: 'Text Mode (font icon)',
        descKey: 'HELP_SEARCH_TEXT_MODE_DESC',
        descDefault: 'Search by typing "super + shift + S" or command names like "alacritty".'
    },
    {
        label: 'G',
        titleKey: 'HELP_G_BUTTON',
        titleDefault: 'G Button',
        descKey: 'HELP_G_BUTTON_DESC',
        descDefault: 'Delegate hotkey to global settings. Blue = active. Global value applies across all themes.'
    },
    {
        label: 'DIG',
        titleKey: 'HELP_DIG_BUTTON',
        titleDefault: 'DIG Button (Duplicate In Global)',
        descKey: 'HELP_DIG_BUTTON_DESC',
        descDefault: 'Copy current value to global and activate G. Quick way to make hotkey global.'
    },
    {
        label: '\u2190',
        titleKey: 'HELP_ARROW_BUTTON',
        titleDefault: 'Arrow Button',
        descKey: 'HELP_ARROW_BUTTON_DESC',
        descDefault: 'Reset hotkey to its original theme value. Removes all overrides.'
    },
    {
        label: '\u00D7',
        titleKey: 'HELP_DELETE_BUTTON',
        titleDefault: 'Delete Button',
        descKey: 'HELP_DELETE_BUTTON_DESC',
        descDefault: 'Mark hotkey for deletion. Will add unbind rule when theme is applied.'
    }
];

const HOTKEY_HELP_COLOR_DEFINITIONS = [
    { color: '#3584e4', textKey: 'HELP_COLOR_GLOBAL', textDefault: 'Blue = Global override' },
    { color: '#33d17a', textKey: 'HELP_COLOR_PERRICE', textDefault: 'Green = Per-rice override' },
    { color: '#888888', textKey: 'HELP_COLOR_ORIGINAL', textDefault: 'Gray = Original theme value' }
];

export function applyHyprlandOverridePopupHotkeysDialogsHelp(targetPrototype) {
    targetPrototype.showHotkeysHelpPopup = function(relativeTo) {
        const t = (key, fallback) => this.t(key) || fallback;
        const helpItems = HOTKEY_HELP_ITEM_DEFINITIONS.map((item) => ({
            icon: item.icon,
            label: item.label,
            title: t(item.titleKey, item.titleDefault),
            desc: t(item.descKey, item.descDefault)
        }));
        const colorItems = HOTKEY_HELP_COLOR_DEFINITIONS.map((item) => ({
            color: item.color,
            text: t(item.textKey, item.textDefault)
        }));

        showHelpPopover({
            relativeTo,
            title: t('HOTKEYS_HELP_TITLE', 'Hotkeys Help'),
            helpItems,
            maxWidthChars: 40,
            leadingWidth: 24,
            colorLegendTitle: t('HELP_COLOR_LEGEND', 'Color Legend'),
            colorItems,
            parseColor: (hexColor) => this.hexToRgb(hexColor),
            colorBoxSize: 16
        });
    };
}
