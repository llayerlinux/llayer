import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import { HotkeyService } from '../../../../infrastructure/hyprland/HotkeyService.js';
import { getThemePath } from '../../../../infrastructure/utils/Utils.js';
import { addPointerCursor } from '../../../common/ViewUtils.js';

class HyprlandOverridePopupHotkeysCore {
    initHotkeyService() {
        this.hotkeyService ||= new HotkeyService({
            logger: this.logger,
            themeRepository: this.themeRepository,
            settingsManager: this.settingsManager
        });
        this._hotkeyCssLoaded ||= true;
    }

    applyPointerCursor(widget) {
        addPointerCursor(widget);
    }

    applyRoundButton(button) {
        button && (
            button.get_style_context().add_class('hotkey-round-btn'),
            button.set_size_request(26, 26),
            [
                ['set_relief', Gtk.ReliefStyle.NONE],
                ['set_hexpand', false],
                ['set_vexpand', false],
                ['set_halign', Gtk.Align.CENTER],
                ['set_valign', Gtk.Align.CENTER]
            ].forEach(([methodName, arg]) => {
                typeof button[methodName] === 'function' && button[methodName](arg);
            })
        );
    }

    getCurrentThemePath() {
        const theme = this.currentTheme ?? {};
        return theme.path
            || theme.localPath
            || getThemePath(theme.name || '', { basePath: this.themeRepository?.basePath });
    }
}

export function applyHyprlandOverridePopupHotkeysCore(prototype) {
    copyPrototypeDescriptors(prototype, HyprlandOverridePopupHotkeysCore.prototype);
}
