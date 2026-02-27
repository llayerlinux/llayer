import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import { HotkeyAction } from '../../../../domain/valueObjects/HotkeyOverride.js';
import { HOTKEY_DISPATCHERS } from './HyprlandTabHotkeysDialogsConstants.js';
import { showHotkeyAddDialog } from '../../../common/HotkeyAddDialogShared.js';
import { addPointerCursor } from '../../../common/ViewUtils.js';

class HyprlandTabHotkeysDialogsAdd {
    showAddHotkeyDialog(parentDialog) {
        showHotkeyAddDialog({
            parentDialog,
            title: this.t('ADD_HOTKEY_TITLE') || 'Add Hotkey Override',
            t: this.t,
            dispatchers: HOTKEY_DISPATCHERS,
            pointerCursorFn: addPointerCursor,
            modeTooltips: {
                text: 'Text mode: type key combo. Click for key capture mode.',
                key: 'Key capture mode: press keys. Click for text mode.'
            },
            onSubmit: ({id, dispatcher, args, modifiers, key}) => {
                this.currentHotkeyOverrides[id] = {
                    dispatcher,
                    args,
                    action: HotkeyAction.ADD,
                    metadata: {modifiers, key, bindType: 'bind'},
                    timestamp: Date.now()
                };
                return true;
            },
            onAfterSave: () => this.refreshHotkeyListUI()
        });
    }
}

export function applyHyprlandTabHotkeysDialogsAdd(prototype) {
    copyPrototypeDescriptors(prototype, HyprlandTabHotkeysDialogsAdd.prototype);
}
