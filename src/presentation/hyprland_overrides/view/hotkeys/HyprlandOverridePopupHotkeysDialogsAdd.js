import { HotkeyAction } from '../../../../domain/valueObjects/HotkeyOverride.js';
import { showHotkeyAddDialog } from '../../../common/HotkeyAddDialogShared.js';

export function applyHyprlandOverridePopupHotkeysDialogsAdd(targetPrototype) {
    targetPrototype.showAddHotkeyDialogPerRice = function(options = {}) {
        const defaults = options.defaults ?? {};
        const themePath = this.getCurrentThemePath();
        const dispatchers = this.hotkeyService.getAvailableDispatchers(themePath);

        showHotkeyAddDialog({
            parentDialog: this.popup,
            title: '',
            t: this.t,
            dispatchers,
            defaults: {
                modifiers: defaults.modifiers ?? [],
                key: defaults.key ?? '',
                dispatcher: defaults.dispatcher ?? 'exec',
                args: defaults.args ?? ''
            },
            labels: {
                add: options.addLabel || (this.t('ADD') || 'Add')
            },
            modeTooltips: {
                text: 'Text mode. Click for key capture mode.',
                key: 'Key capture mode. Click for text mode.'
            },
            pointerCursorFn: (widget) => this.applyPointerCursor(widget),
            onSubmit: ({id, dispatcher, args, modifiers, key}) => {
                this.currentHotkeyOverrides[id] = {
                    dispatcher,
                    args,
                    action: HotkeyAction.ADD,
                    metadata: {
                        modifiers,
                        key,
                        bindType: 'bind'
                    },
                    timestamp: Date.now()
                };
                typeof options.onSave === 'function' && options.onSave({id, dispatcher, args, modifiers, key});
                return true;
            },
            onAfterSave: () => this.refreshHotkeysDeferred()
        });
    };
}
