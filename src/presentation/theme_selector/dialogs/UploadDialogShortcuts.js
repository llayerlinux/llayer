import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';

class UploadDialogShortcuts {
    setupKeyboardShortcuts() {
        this.dialog && (() => {
            let accelGroup = new Gtk.AccelGroup();
            this.dialog.add_accel_group(accelGroup);

            let bind = (accel) => {
                const [key, mods] = Gtk.accelerator_parse(accel);
                key && accelGroup.connect(key, mods, Gtk.AccelFlags.VISIBLE, () => {
                    this.applyTestData();
                    return true;
                });
            };

            bind('<Control>d');
            bind('<Control><Shift>d');
            bind('F9');

            const fields = this.fields && typeof this.fields === 'object' ? this.fields : {};
            const entries = Object.values(fields).filter(w => w && typeof w.connect === 'function' && typeof w.get_text === 'function');
            entries.forEach((entry) => {
                entry.connect('key-press-event', (_self, event) => {
                    let keyval = event?.get_keyval?.();
                    let state = event?.get_state?.();
                    keyval = Array.isArray(keyval) ? keyval[1] : keyval;
                    state = Array.isArray(state) ? state[1] : state;
                    const hasCtrl = (state & Gdk.ModifierType.CONTROL_MASK) !== 0;
                    const hasShift = (state & Gdk.ModifierType.SHIFT_MASK) !== 0;
                    return (hasCtrl && !hasShift && (keyval === Gdk.KEY_d || keyval === Gdk.KEY_D))
                        ? (this.applyTestData(), true)
                        : false;
                });
            });
        })();
    }

    applyTestData() {
        const setIfEmpty = (entry, value) => {
            const canSetEntryText = entry && typeof entry.get_text === 'function' && typeof entry.set_text === 'function';
            canSetEntryText
                && !String(entry.get_text() || '').trim()
                && entry.set_text(String(value ?? ''));
        };

        setIfEmpty(this.fields.nameEntry, 'Test theme');
        setIfEmpty(this.fields.repoEntry, 'https://github.com/example/test-theme');
        setIfEmpty(this.fields.publishedEntry, 'https://example.com');
        setIfEmpty(this.fields.youtubeLinkEntry, 'https://youtube.com');
        setIfEmpty(this.fields.authorEntry, 'Author | https://example.com');
        setIfEmpty(this.fields.adaptedEntry, 'Adapter | https://example.com');
        setIfEmpty(this.fields.tagsEntry, 'test, demo');
        setIfEmpty(this.fields.packagesEntry, 'swww, waybar');
        setIfEmpty(this.fields.passEntry, 'test');

        const archivePath = GLib.getenv('LLAYER_TEST_UPLOAD_ARCHIVE');
        const previewPath = GLib.getenv('LLAYER_TEST_UPLOAD_PREVIEW');

        archivePath && GLib.file_test(archivePath, GLib.FileTest.EXISTS)
            && this.applyArchivePath(archivePath, {suggestName: true});
        previewPath && GLib.file_test(previewPath, GLib.FileTest.EXISTS)
            && this.applyPreviewPath(previewPath);
    }
}

export function applyUploadDialogShortcuts(prototype) {
    copyPrototypeDescriptors(prototype, UploadDialogShortcuts.prototype);
}
