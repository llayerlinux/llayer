import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { addPointerCursor, applyLabelAttributes, applyOptionalSetters } from '../../common/ViewUtils.js';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';

function buildTreeLines(dirPath, prefix, lines, depth, maxDepth) {
    let dir = Gio.File.new_for_path(dirPath);
    if (depth >= maxDepth || !dir.query_exists(null)) return;

    let enumerator = tryOrNull('buildTreeLines.enumerate', () =>
        dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null)
    );
    if (!enumerator) return;

    let items = [];
    let fileInfo;
    while ((fileInfo = enumerator.next_file(null)) !== null) {
        const name = fileInfo.get_name();
        !name.startsWith('.git') && items.push({
            name,
            isDir: fileInfo.get_file_type() === Gio.FileType.DIRECTORY
        });
    }
    enumerator.close(null);

    items.sort((a, b) => a.isDir !== b.isDir ? b.isDir - a.isDir : a.name.localeCompare(b.name));

    let maxItems = 15,
        displayItems = items.slice(0, maxItems),
        hasMore = items.length > maxItems;

    displayItems.forEach((item, index) => {
        const isLast = index === displayItems.length - 1 && !hasMore,
              suffix = item.isDir ? '/' : '';
        lines.push(`${prefix}${isLast ? '└── ' : '├── '}${item.name}${suffix}${isKnownAppFolder(item.name) ? ' *' : ''}`);

        item.isDir && buildTreeLines(
            GLib.build_filenamev([dirPath, item.name]),
            prefix + (isLast ? '    ' : '│   '),
            lines,
            depth + 1,
            maxDepth
        );
    });

    hasMore && lines.push(prefix + '└── ... (' + (items.length - maxItems) + ' more)');
}

function generateTreeText(themePath, maxDepth = 3) {
    if (!themePath) return 'Theme path not available';
    if (!Gio.File.new_for_path(themePath).query_exists(null)) return `Path not found: ${themePath}`;

    const lines = [`${GLib.path_get_basename(themePath)}/`];
    buildTreeLines(themePath, '', lines, 0, maxDepth);
    return lines.join('\n');
}

function isKnownAppFolder(name) {
    return [
        'hyprland', 'waybar', 'kitty', 'alacritty', 'rofi', 'wofi',
        'dunst', 'mako', 'swaync', 'hyprlock', 'swaylock', 'eww',
        'ags', 'nvim', 'neovim', 'yazi', 'ranger', 'foot', 'wezterm',
        'gtk-3.0', 'gtk-4.0', 'qt5ct', 'qt6ct', 'kvantum', 'starship',
        'fish', 'zsh', 'fastfetch', 'neofetch', 'cava', 'mpv', 'btop',
        'polybar', 'fuzzel', 'tofi', 'ghostty', 'helix', 'spicetify'
    ].includes(name.toLowerCase());
}

function getLevelEntry(levelData, lvl) {
    const source = (levelData && typeof levelData === 'object') ? levelData : null;
    const entry = source ? source[lvl] : null;
    return (entry && typeof entry === 'object') ? entry : null;
}

export function showRiceDepthDetailsDialog({ level, levelData, themeName, themePath, parent = null }) {
    const dialog = new Gtk.Dialog({
        title: `Rice Depth: ${themeName || 'Theme'}`,
        modal: true,
        destroy_with_parent: true,
        default_width: 700,
        default_height: 500
    });

    applyOptionalSetters([[parent, (window) => dialog.set_transient_for(window), (value) => value instanceof Gtk.Window]]);

    dialog.set_keep_above(true);
    dialog.set_skip_taskbar_hint(true);
    dialog.set_skip_pager_hint(true);
    dialog.set_position(Gtk.WindowPosition.CENTER_ALWAYS);
    dialog.set_type_hint(Gdk.WindowTypeHint.DIALOG);

    addPointerCursor(dialog.add_button('Close', Gtk.ResponseType.CLOSE));

    const contentArea = dialog.get_content_area();
    contentArea.set_spacing(0);

    const mainBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 0,
        margin_start: 16,
        margin_end: 16,
        margin_top: 12,
        margin_bottom: 12
    });

    const leftBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
    leftBox.set_hexpand(true);

    const treeTitle = new Gtk.Label({
        label: 'File Structure',
        halign: Gtk.Align.START,
        margin_bottom: 8
    });
    applyLabelAttributes(treeTitle, { bold: true });
    leftBox.pack_start(treeTitle, false, false, 0);

    const treeScroll = new Gtk.ScrolledWindow({
        hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
    });
    treeScroll.set_hexpand(true);
    treeScroll.set_vexpand(true);

    const treeLabel = new Gtk.Label({
        label: generateTreeText(themePath),
        halign: Gtk.Align.START,
        valign: Gtk.Align.START,
        selectable: true,
        wrap: false
    });
    treeLabel.set_xalign(0);
    treeLabel.get_style_context().add_class('theme-context-tree-label');

    treeScroll.add(treeLabel);
    leftBox.pack_start(treeScroll, true, true, 0);

    const separator = new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL });
    separator.set_margin_start(16);
    separator.set_margin_end(16);

    const rightBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
    rightBox.set_size_request(280, -1);

    const levelTitle = new Gtk.Label({
        label: 'Rice Depth Classification',
        halign: Gtk.Align.START,
        margin_bottom: 8
    });
    applyLabelAttributes(levelTitle, { bold: true });
    rightBox.pack_start(levelTitle, false, false, 0);

    const safeLevel = Math.max(0, Math.min(6, Number(level) || 0));
    const levelIndicator = new Gtk.Label({
        label: `L${safeLevel} [${'█'.repeat(safeLevel)}${'░'.repeat(6 - safeLevel)}]`,
        halign: Gtk.Align.START,
        margin_bottom: 12
    });
    applyLabelAttributes(levelIndicator, { family: 'monospace' });
    rightBox.pack_start(levelIndicator, false, false, 0);

    const breakdownTitle = new Gtk.Label({
        label: 'Level Breakdown:',
        halign: Gtk.Align.START,
        margin_bottom: 4
    });
    applyLabelAttributes(breakdownTitle, { bold: true });
    rightBox.pack_start(breakdownTitle, false, false, 0);

    for (let lvl = 6; lvl >= 1; lvl--) {
        const data = getLevelEntry(levelData, lvl);
        data?.filled && (() => {
            const levelRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });

            const iconLabel = new Gtk.Label({
                label: '✓',
                halign: Gtk.Align.START
            });
            applyLabelAttributes(iconLabel, { color: '#4a9f4a' });
            iconLabel.set_size_request(20, -1);

            const codeLabel = new Gtk.Label({
                label: `L${lvl}`,
                halign: Gtk.Align.START
            });
            applyLabelAttributes(codeLabel, { bold: true });
            codeLabel.set_size_request(30, -1);

            const catLabel = new Gtk.Label({
                label: typeof data.code === 'string' ? data.code : '',
                halign: Gtk.Align.START
            });
            catLabel.set_size_request(60, -1);

            levelRow.pack_start(iconLabel, false, false, 0);
            levelRow.pack_start(codeLabel, false, false, 0);
            levelRow.pack_start(catLabel, false, false, 0);
            levelRow.pack_start(
                new Gtk.Label({
                    label: typeof data.name === 'string' ? data.name : '',
                    halign: Gtk.Align.START,
                    hexpand: true
                }),
                true,
                true,
                0
            );

            rightBox.pack_start(levelRow, false, false, 2);
        })();
    }

    const componentsTitle = new Gtk.Label({
        label: 'Detected Components:',
        halign: Gtk.Align.START,
        margin_top: 16,
        margin_bottom: 4
    });
    applyLabelAttributes(componentsTitle, { bold: true });
    rightBox.pack_start(componentsTitle, false, false, 0);

    const detectedApps = [];
    for (let lvl = 1; lvl <= 6; lvl++) {
        const data = getLevelEntry(levelData, lvl);
        data?.filled && data.name && detectedApps.push(data.name);
    }

    const appsLabel = new Gtk.Label({
        label: detectedApps.length > 0 ? detectedApps.join(', ') : 'None detected',
        halign: Gtk.Align.START,
        wrap: true,
        max_width_chars: 35
    });
    appsLabel.set_xalign(0);
    rightBox.pack_start(appsLabel, false, false, 0);

    mainBox.pack_start(leftBox, true, true, 0);
    mainBox.pack_start(separator, false, false, 0);
    mainBox.pack_start(rightBox, false, false, 0);

    contentArea.pack_start(mainBox, true, true, 0);

    dialog.show_all();
    dialog.present();

    dialog.run();
    dialog.destroy();
}
