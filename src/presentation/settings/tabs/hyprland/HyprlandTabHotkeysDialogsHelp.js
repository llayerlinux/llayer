import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import { showHelpPopover } from '../../../common/HelpPopoverShared.js';

class HyprlandTabHotkeysDialogsHelp {
    showGlobalHotkeysHelpPopup(relativeTo) {
        const helpItems = [
            {
                title: 'What are global hotkey overrides?',
                desc: 'Hotkeys defined here will be applied to ALL themes when switching. They override theme-specific keybindings.'
            },
            {
                title: 'Add Hotkey button',
                desc: 'Create a new global hotkey override. Choose modifiers, key, dispatcher and arguments.'
            },
            {
                title: 'Edit button',
                desc: 'Modify the dispatcher and arguments of an existing override.'
            },
            {
                title: 'Delete button (\u00d7)',
                desc: 'Remove a global override. Theme\'s original keybinding will be used.'
            }
        ];

        showHelpPopover({
            relativeTo,
            title: this.t('GLOBAL_HOTKEYS_HELP_TITLE') || 'Global Hotkey Overrides Help',
            helpItems,
            maxWidthChars: 45
        });
    }
}

export function applyHyprlandTabHotkeysDialogsHelp(prototype) {
    copyPrototypeDescriptors(prototype, HyprlandTabHotkeysDialogsHelp.prototype);
}
