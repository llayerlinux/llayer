import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import { addPointerCursor, setupPointerCursors } from '../../../common/ViewUtils.js';

class AdvancedTabDependencyIsolationOpsHelp {

    showIsolationHelpDialog() {
        const t = (key) => {
            const val = this.t?.(key);
            return (val && val !== key) ? val : null;
        };

        const texts = {
            title: t('DEPENDENCY_ISOLATION_HELP_TITLE') || 'Dependency Isolation Help',
            overview: t('DEPENDENCY_ISOLATION_HELP_OVERVIEW') ||
                'Dependency Isolation intercepts package installations (pacman, yay, paru, pip, cargo, npm, etc.) and redirects them to a separate directory instead of installing system-wide. This prevents conflicts between rices that need different versions of the same program and keeps your system clean.',
            disabledTitle: t('DEPENDENCY_ISOLATION_HELP_DISABLED_TITLE') || 'Disabled',
            disabledDesc: t('DEPENDENCY_ISOLATION_HELP_DISABLED_DESC') ||
                'All programs are installed system-wide via pacman/yay/paru as usual.\n\n' +
                '• Programs go to /usr/bin/, /usr/lib/, /usr/share/\n' +
                '• Managed by your system package manager\n' +
                '• Easy to update with pacman -Syu\n\n' +
                '✅ Standard Arch Linux behavior\n' +
                '✅ Simple package management\n' +
                '✅ No extra disk space used\n\n' +
                '❌ Rice conflicts (e.g., two rices need different AGS versions)\n' +
                '❌ System pollution with rice-specific packages\n' +
                '❌ Hard to clean up after removing a rice',
            hybridTitle: 'Hybrid',
            hybridDesc: t('DEPENDENCY_ISOLATION_HELP_HYBRID_DESC') ||
                'All rices share a single isolated prefix. Programs are copied from system or built into:\n~/.local/share/lastlayer/programs/shared/\n\n' +
                '• bin/ - executables (waybar, rofi, ags, etc.)\n' +
                '• lib/ - libraries and dependencies\n' +
                '• share/ - data files, themes, icons\n\n' +
                '✅ Saves disk space (one copy per program)\n' +
                '✅ System stays clean\n' +
                '✅ Easy to manage - all in one place\n' +
                '✅ Best for most users\n\n' +
                '❌ Cannot have different versions for different rices\n' +
                '❌ If rice A needs AGS 1.8 and rice B needs AGS 2.0, conflict occurs',
            perRiceTitle: t('DEPENDENCY_ISOLATION_MODE_PER_RICE') || 'Per-Rice',
            perRiceDesc: t('DEPENDENCY_ISOLATION_HELP_PER_RICE_DESC') ||
                'Each rice gets its own complete isolated prefix:\n~/.local/share/lastlayer/programs/rices/{rice-name}/\n\n' +
                'Example structure:\n' +
                '• rices/cyberpunk/bin/ags (AGS 1.8.2)\n' +
                '• rices/minimal/bin/ags (AGS 2.0.0)\n' +
                '• rices/anime/bin/waybar, rofi, etc.\n\n' +
                '✅ Full isolation between rices\n' +
                '✅ Each rice can have different program versions\n' +
                '✅ Deleting a rice removes all its dependencies\n' +
                '✅ No version conflicts possible\n\n' +
                '❌ Uses more disk space (programs duplicated per rice)\n' +
                '❌ Same program downloaded/built multiple times',
            perProgramTitle: t('DEPENDENCY_ISOLATION_MODE_PER_PROGRAM') || 'Per-Program',
            perProgramDesc: t('DEPENDENCY_ISOLATION_HELP_PER_PROGRAM_DESC') ||
                'Programs stored by name and version, rices reference specific versions:\n~/.local/share/lastlayer/programs/{program}/{version}/\n\n' +
                'Example structure:\n' +
                '• ags/1.8.2/bin/ags\n' +
                '• ags/2.0.0/bin/ags\n' +
                '• waybar/0.10.0/bin/waybar\n\n' +
                '✅ Multiple versions of same program can coexist\n' +
                '✅ Efficient storage (shared versions)\n' +
                '✅ Fine-grained version control\n\n' +
                '❌ More complex version management\n' +
                '❌ Requires manual version selection\n' +
                '❌ Experimental feature',
            recommended: t('RECOMMENDED') || 'Recommended',
            close: t('CLOSE') || 'Close'
        };

        const dialog = new Gtk.Dialog({
            title: texts.title,
            modal: true,
            resizable: true,
            default_width: 700,
            default_height: 600,
            type_hint: Gdk.WindowTypeHint.DIALOG,
            transient_for: this.dialog
        });
        dialog.set_position(Gtk.WindowPosition.CENTER_ON_PARENT);
        dialog.set_keep_above(true);

        const mainBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 8, margin: 12});

        const overviewLabel = new Gtk.Label({
            label: texts.overview,
            wrap: true,
            xalign: 0,
            margin_bottom: 4
        });
        mainBox.pack_start(overviewLabel, false, false, 0);

        const scrolledWindow = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vexpand: true,
            min_content_height: 380
        });

        const contentBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 12, margin: 4});

        const disabledFrame = new Gtk.Frame({label: `❌ ${texts.disabledTitle}`});
        const disabledBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin: 8});
        const disabledDesc = new Gtk.Label({label: texts.disabledDesc, wrap: true, xalign: 0});
        disabledBox.pack_start(disabledDesc, false, false, 0);
        disabledFrame.add(disabledBox);
        contentBox.pack_start(disabledFrame, false, false, 0);

        const hybridFrame = new Gtk.Frame({label: `📦 ${texts.hybridTitle} (${texts.recommended})`});
        const hybridBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin: 8});
        const hybridDesc = new Gtk.Label({label: texts.hybridDesc, wrap: true, xalign: 0});
        hybridBox.pack_start(hybridDesc, false, false, 0);
        hybridFrame.add(hybridBox);
        contentBox.pack_start(hybridFrame, false, false, 0);

        const perRiceFrame = new Gtk.Frame({label: `🍚 ${texts.perRiceTitle}`});
        const perRiceBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin: 8});
        const perRiceDesc = new Gtk.Label({label: texts.perRiceDesc, wrap: true, xalign: 0});
        perRiceBox.pack_start(perRiceDesc, false, false, 0);
        perRiceFrame.add(perRiceBox);
        contentBox.pack_start(perRiceFrame, false, false, 0);

        const perProgramFrame = new Gtk.Frame({label: `🔧 ${texts.perProgramTitle}`});
        const perProgramBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin: 8});
        const perProgramDesc = new Gtk.Label({label: texts.perProgramDesc, wrap: true, xalign: 0});
        perProgramBox.pack_start(perProgramDesc, false, false, 0);
        perProgramFrame.add(perProgramBox);
        contentBox.pack_start(perProgramFrame, false, false, 0);

        scrolledWindow.add(contentBox);
        mainBox.pack_start(scrolledWindow, true, true, 0);

        const closeButton = new Gtk.Button({label: texts.close, halign: Gtk.Align.END, margin_top: 6});
        addPointerCursor(closeButton);
        closeButton.connect('clicked', () => dialog.destroy());
        mainBox.pack_end(closeButton, false, false, 0);

        dialog.get_content_area().add(mainBox);
        dialog.show_all();
        setupPointerCursors(dialog);
    }

}

export function applyAdvancedTabDependencyIsolationOpsHelp(prototype) {
    copyPrototypeDescriptors(prototype, AdvancedTabDependencyIsolationOpsHelp.prototype);
}
