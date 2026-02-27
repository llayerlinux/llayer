import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor } from '../../common/ViewUtils.js';
import { dispatchNotification } from '../../common/NotificationUtils.js';
import { TweaksPluginsUIBase } from './TweaksPluginsUIBase.js';

export const TweaksPluginsTabCore = {
    createLabel: TweaksPluginsUIBase.createLabel,

    createActionButton(text, classNames = []) {
        const button = new Gtk.Button({label: text});
        classNames.forEach((className) => button.get_style_context().add_class(className));
        addPointerCursor(button);
        return button;
    },

    notify(message, details = '') {
        return dispatchNotification({
            notifier: this.controller?.notifier,
            source: 'TweaksPluginsTabCore',
            message,
            details
        });
    }
};
