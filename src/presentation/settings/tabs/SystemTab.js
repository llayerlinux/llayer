import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrDefault, tryOrNull, tryRun } from '../../../infrastructure/utils/ErrorUtils.js';

export class SystemTab {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.settings = deps.settings || {};
        this.widgets = deps.widgets || {};
        this.getSystemGtkThemes = deps.getSystemGtkThemes || (() => []);
        this.onSystemThemeChanged = deps.onSystemThemeChanged || null;
    }

    build() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 16,
            margin_bottom: 16,
            margin_start: 20,
            margin_end: 20
        });

        this.buildSystemThemeSection(box);
        this.buildIconThemeSection(box);
        this.buildCursorThemeSection(box);
        this.buildGitSettingsSection(box);
        this.buildXtermSection(box);

        const tabLabel = new Gtk.Label({ label: this.t('SYSTEM_TAB') || 'System' });
        tabLabel.set_margin_left(10);
        tabLabel.set_margin_right(10);

        return { box, tabLabel };
    }

    buildGitSettingsSection(box) {
        const separator = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        separator.set_margin_top(16);
        separator.set_margin_bottom(8);
        box.pack_start(separator, false, false, 0);

        const sectionLabel = new Gtk.Label({
            label: `<b>${this.t('GIT_SETTINGS_SECTION') || 'Git Settings'}</b>`,
            use_markup: true,
            halign: Gtk.Align.START
        });
        box.pack_start(sectionLabel, false, false, 0);

        const note = new Gtk.Label({
            label: this.t('GIT_SETTINGS_NOTE') || 'Configure how git clones repositories during rice installation',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        note.set_margin_bottom(8);
        note.get_style_context().add_class('dim-label');
        box.pack_start(note, false, false, 0);

        const systemHasSshRedirect = this.detectGitUrlMode() === 'ssh';

        const modeBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        const modeLabel = new Gtk.Label({
            label: this.t('GIT_URL_MODE_LABEL') || 'GitHub clone method',
            xalign: 0
        });
        modeLabel.set_size_request(150, -1);

        const modeCombo = new Gtk.ComboBoxText();
        modeCombo.append('https', this.t('GIT_MODE_HTTPS') || 'HTTPS (Recommended)');
        modeCombo.append('ssh', this.t('GIT_MODE_SSH') || 'SSH');
        modeCombo.append('system', this.t('GIT_MODE_SYSTEM') || 'System default');

        const currentMode = this.settings.gitUrlMode || 'https';
        modeCombo.set_active_id(currentMode);

        const warningLabel = new Gtk.Label({
            label: this.t('GIT_SSH_WARNING') || '⚠ SSH mode requires configured SSH keys. May cause installation failures if keys are not set up for GitHub.',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        warningLabel.set_margin_top(8);
        warningLabel.set_no_show_all(true);

        const cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_data('label { color: #e74c3c; }');
        warningLabel.get_style_context().add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

        const detectedLabel = new Gtk.Label({
            label: this.t('GIT_DETECTED_SSH') || '📍 Detected: Your git config rewrites HTTPS → SSH',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        detectedLabel.set_margin_top(4);
        detectedLabel.get_style_context().add_class('dim-label');
        detectedLabel.set_no_show_all(true);
        detectedLabel.set_visible(systemHasSshRedirect);

        const updateWarningVisibility = () => {
            const mode = modeCombo.get_active_id();
            const shouldWarn = mode === 'ssh' || (mode === 'system' && systemHasSshRedirect);
            warningLabel.set_visible(shouldWarn);
        };

        modeCombo.connect('changed', () => {
            const selected = modeCombo.get_active_id();
            this.settings.gitUrlMode = selected;
            updateWarningVisibility();
        });

        this.widgets.gitUrlModeCombo = modeCombo;

        modeBox.pack_start(modeLabel, false, false, 0);
        modeBox.pack_start(modeCombo, false, false, 0);
        box.pack_start(modeBox, false, false, 0);
        box.pack_start(warningLabel, false, false, 0);
        box.pack_start(detectedLabel, false, false, 0);

        updateWarningVisibility();
    }

    detectGitUrlMode() {
        const output = this.runSyncCommand('git config --get-regexp url.*insteadof', 'SystemTab.detectGitUrlMode') || '';
        return output.includes('ssh://git@github.com') || output.includes('git@github.com:')
            ? 'ssh'
            : 'https';
    }

    runSyncCommand(command, context) {
        return tryOrNull(context, () => {
            const [ok, stdout] = GLib.spawn_command_line_sync(command);
            return ok && stdout ? new TextDecoder().decode(stdout).trim() : null;
        });
    }

    readDesktopSetting(settingName) {
        return this.runSyncCommand(
            `gsettings get org.gnome.desktop.interface ${settingName}`,
            `SystemTab.readDesktopSetting.${settingName}`
        )?.replace(/^'|'$/g, '') || null;
    }

    readDconfSetting(settingName) {
        return this.runSyncCommand(
            `dconf read /org/gnome/desktop/interface/${settingName}`,
            `SystemTab.readDconfSetting.${settingName}`
        )?.replace(/^'|'$/g, '') || null;
    }

    runAsyncCommand(command, context, onSuccess = null) {
        return tryRun(context, () => {
            GLib.spawn_command_line_async(command);
            onSuccess?.();
        });
    }

    selectAvailableTheme(combo, currentTheme, themes) {
        const selectedTheme = currentTheme && themes.includes(currentTheme)
            ? currentTheme
            : themes[0] || null;
        selectedTheme && combo.set_active_id(selectedTheme);
    }

    connectThemeChange(combo, applyTheme) {
        combo.connect('changed', () => {
            const selectedTheme = combo.get_active_id();
            selectedTheme && applyTheme(selectedTheme);
        });
    }

    collectThemeNames(searchPaths, hasThemeAssets, context) {
        const themes = new Set();

        for (const path of searchPaths) {
            tryRun(`${context}.${path}`, () => {
                const dir = Gio.File.new_for_path(path);
                if (!dir.query_exists(null)) {
                    return;
                }

                const enumerator = dir.enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );

                let info;
                while ((info = enumerator.next_file(null))) {
                    if (info.get_file_type() !== Gio.FileType.DIRECTORY) {
                        continue;
                    }

                    const name = info.get_name();
                    hasThemeAssets(path, name) && themes.add(name);
                }
            });
        }

        return Array.from(themes).sort();
    }

    buildXtermSection(box) {
        const separator = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        separator.set_margin_top(16);
        separator.set_margin_bottom(8);
        box.pack_start(separator, false, false, 0);

        const sectionLabel = new Gtk.Label({
            label: `<b>xterm (for llayer)</b>`,
            use_markup: true,
            halign: Gtk.Align.START
        });
        box.pack_start(sectionLabel, false, false, 0);

        const note = new Gtk.Label({
            label: this.t('XTERM_SECTION_NOTE') || 'Terminal window appearance during theme installation',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        note.set_margin_bottom(8);
        note.get_style_context().add_class('dim-label');
        box.pack_start(note, false, false, 0);

        const dockCheck = new Gtk.CheckButton({label: this.t('XTERM_DOCK_TO_WINDOW') || 'Dock terminal to main window'});
        dockCheck.set_active(this.settings.xterm_dock_to_window !== false);
        dockCheck.connect('toggled', () => {
            this.settings.xterm_dock_to_window = dockCheck.get_active();
        });
        this.widgets.xtermDockToWindowCheck = dockCheck;
        box.pack_start(dockCheck, false, false, 0);

        const sizeBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        const sizeLabel = new Gtk.Label({label: this.t('XTERM_PIXEL_SIZE') || 'Window size', xalign: 0});
        sizeLabel.set_size_request(100, -1);

        const widthSpin = Gtk.SpinButton.new_with_range(300, 1200, 10);
        widthSpin.set_value(this.settings.xterm_pixel_width || 650);
        widthSpin.connect('value-changed', () => {
            this.settings.xterm_pixel_width = widthSpin.get_value_as_int();
        });
        this.widgets.xtermPixelWidthSpin = widthSpin;

        const xLabel = new Gtk.Label({label: '×'});

        const heightSpin = Gtk.SpinButton.new_with_range(200, 800, 10);
        heightSpin.set_value(this.settings.xterm_pixel_height || 450);
        heightSpin.connect('value-changed', () => {
            this.settings.xterm_pixel_height = heightSpin.get_value_as_int();
        });
        this.widgets.xtermPixelHeightSpin = heightSpin;

        const pxLabel = new Gtk.Label({label: 'px'});

        sizeBox.pack_start(sizeLabel, false, false, 0);
        sizeBox.pack_start(widthSpin, false, false, 0);
        sizeBox.pack_start(xLabel, false, false, 0);
        sizeBox.pack_start(heightSpin, false, false, 0);
        sizeBox.pack_start(pxLabel, false, false, 0);
        box.pack_start(sizeBox, false, false, 0);

        const colorPresets = {
            'llayer': {bg: '#343745', fg: '#ffffff', font: 'Cantarell', accent: '#3ba0ff'},
            'Nord': {bg: '#2e3440', fg: '#d8dee9', font: 'JetBrains Mono'},
            'Dracula': {bg: '#282a36', fg: '#f8f8f2', font: 'Fira Code'},
            'Gruvbox Dark': {bg: '#282828', fg: '#ebdbb2', font: 'Iosevka'},
            'Gruvbox Light': {bg: '#fbf1c7', fg: '#3c3836', font: 'Iosevka'},
            'Tokyo Night': {bg: '#1a1b26', fg: '#a9b1d6', font: 'JetBrains Mono'},
            'One Dark': {bg: '#282c34', fg: '#abb2bf', font: 'Source Code Pro'},
            'Solarized Dark': {bg: '#002b36', fg: '#839496', font: 'Inconsolata'},
            'Solarized Light': {bg: '#fdf6e3', fg: '#657b83', font: 'Inconsolata'},
            'Monokai': {bg: '#272822', fg: '#f8f8f2', font: 'Monaco'},
            'Rose Pine': {bg: '#191724', fg: '#e0def4', font: 'Victor Mono'},
            'Everforest': {bg: '#2d353b', fg: '#d3c6aa', font: 'IBM Plex Mono'},
            'Kanagawa': {bg: '#1f1f28', fg: '#dcd7ba', font: 'JetBrains Mono'},
            'Ayu Dark': {bg: '#0a0e14', fg: '#b3b1ad', font: 'Cascadia Code'},
            'Ayu Light': {bg: '#fafafa', fg: '#575f66', font: 'Cascadia Code'},
            'Palenight': {bg: '#292d3e', fg: '#a6accd', font: 'Fira Code'},
            'Horizon': {bg: '#1c1e26', fg: '#d5d8da', font: 'SF Mono'},
            'Material Dark': {bg: '#212121', fg: '#eeffff', font: 'Roboto Mono'},
            'Zenburn': {bg: '#3f3f3f', fg: '#dcdccc', font: 'DejaVu Sans Mono'},
            'Synthwave': {bg: '#2b213a', fg: '#ff7edb', font: 'Fira Code'},
            'Neon': {bg: '#000000', fg: '#ff00ff', font: 'Share Tech Mono'},
            'Spectrum': {bg: '#131418', fg: '#f0f0f0', font: 'Hack'},
            'Nightfly': {bg: '#011627', fg: '#c3ccdc', font: 'JetBrains Mono'},
            'Oxocarbon': {bg: '#161616', fg: '#f2f4f8', font: 'IBM Plex Mono'},
            'Matrix': {bg: '#000000', fg: '#00ff00', font: 'Terminus'},
            'Cyber': {bg: '#0d0d0d', fg: '#00ffff', font: 'Share Tech Mono'},
            'Retro Amber': {bg: '#1a1a1a', fg: '#ffb000', font: 'Terminus'},
            'Retro Green': {bg: '#0a0a0a', fg: '#33ff33', font: 'Terminus'},
            'Catppuccin Mocha': {bg: '#1e1e2e', fg: '#cdd6f4', font: 'JetBrains Mono'},
            'Catppuccin Latte': {bg: '#eff1f5', fg: '#4c4f69', font: 'JetBrains Mono'}
        };

        const riceOverrideCheck = new Gtk.CheckButton({
            label: this.t('XTERM_FROM_RICE') || 'Take from rice if available (priority)'
        });
        riceOverrideCheck.set_active(!!this.settings.xterm_from_rice);
        riceOverrideCheck.connect('toggled', () => {
            this.settings.xterm_from_rice = riceOverrideCheck.get_active();
        });
        this.widgets.xtermFromRiceCheck = riceOverrideCheck;
        box.pack_start(riceOverrideCheck, false, false, 0);

        const presetBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        const presetCheck = new Gtk.CheckButton({label: this.t('XTERM_USE_PRESET') || 'Use color preset'});
        const usePreset = !!this.settings.xterm_color_preset;
        presetCheck.set_active(usePreset);
        this.widgets.xtermPresetCheck = presetCheck;

        const presetCombo = new Gtk.ComboBoxText();
        Object.keys(colorPresets).forEach(name => presetCombo.append(name, name));
        presetCombo.set_active_id(this.settings.xterm_color_preset || 'Nord');
        presetCombo.set_sensitive(usePreset);
        this.widgets.xtermPresetCombo = presetCombo;

        presetBox.pack_start(presetCheck, false, false, 0);
        presetBox.pack_start(presetCombo, false, false, 0);
        box.pack_start(presetBox, false, false, 0);

        const colorsBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        const bgLabel = new Gtk.Label({label: this.t('XTERM_BG_COLOR') || 'Background', xalign: 0});
        bgLabel.set_size_request(100, -1);

        const bgColor = new Gdk.RGBA();
        bgColor.parse(this.settings.xterm_bg || '#2e3440');
        const bgButton = new Gtk.ColorButton({rgba: bgColor});
        bgButton.set_use_alpha(false);
        bgButton.set_sensitive(!usePreset);
        bgButton.connect('color-set', () => {
            const rgba = bgButton.get_rgba();
            this.settings.xterm_bg = this.rgbaToHex(rgba);
        });
        this.widgets.xtermBgButton = bgButton;

        const fgLabel = new Gtk.Label({label: this.t('XTERM_FG_COLOR') || 'Foreground'});

        const fgColor = new Gdk.RGBA();
        fgColor.parse(this.settings.xterm_fg || '#d8dee9');
        const fgButton = new Gtk.ColorButton({rgba: fgColor});
        fgButton.set_use_alpha(false);
        fgButton.set_sensitive(!usePreset);
        fgButton.connect('color-set', () => {
            const rgba = fgButton.get_rgba();
            this.settings.xterm_fg = this.rgbaToHex(rgba);
        });
        this.widgets.xtermFgButton = fgButton;

        colorsBox.pack_start(bgLabel, false, false, 0);
        colorsBox.pack_start(bgButton, false, false, 0);
        colorsBox.pack_start(fgLabel, false, false, 0);
        colorsBox.pack_start(fgButton, false, false, 0);
        box.pack_start(colorsBox, false, false, 0);

        const fontBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        const fontLabel = new Gtk.Label({label: this.t('XTERM_FONT') || 'Font', xalign: 0});
        fontLabel.set_size_request(100, -1);

        const fontCombo = new Gtk.ComboBoxText();
        const fonts = this.getMonospaceFonts();
        for (const font of fonts) {
            fontCombo.append(font, font);
        }

        const pickAvailableFont = (preferredFont) => {
            if (preferredFont && fonts.includes(preferredFont))
                return preferredFont;

            const fallbacks = ['JetBrains Mono', 'Fira Code', 'Monospace'];
            return fallbacks.find((fontName) => fonts.includes(fontName)) || null;
        };

        const applyXtermPreset = (presetName, setFont = true) => {
            const preset = colorPresets[presetName];
            if (!preset)
                return;

            this.settings.xterm_bg = preset.bg;
            this.settings.xterm_fg = preset.fg;
            this.settings.xterm_color_preset = presetName;

            const bg = new Gdk.RGBA();
            bg.parse(preset.bg);
            bgButton.set_rgba(bg);

            const fg = new Gdk.RGBA();
            fg.parse(preset.fg);
            fgButton.set_rgba(fg);

            if (!setFont)
                return;

            const resolvedFont = pickAvailableFont(preset.font);
            if (!resolvedFont)
                return;
            fontCombo.set_active_id(resolvedFont);
            this.settings.xterm_font = resolvedFont;
        };

        presetCheck.connect('toggled', () => {
            const active = presetCheck.get_active();
            presetCombo.set_sensitive(active);
            bgButton.set_sensitive(!active);
            fgButton.set_sensitive(!active);
            if (active) {
                applyXtermPreset(presetCombo.get_active_id(), true);
            } else {
                this.settings.xterm_color_preset = null;
            }
        });

        presetCombo.connect('changed', () => {
            presetCheck.get_active() && applyXtermPreset(presetCombo.get_active_id(), true);
        });
        const currentFont = this.settings.xterm_font || 'Monospace';
        if (fonts.includes(currentFont)) {
            fontCombo.set_active_id(currentFont);
        } else {
            fontCombo.append(currentFont, currentFont);
            fontCombo.set_active_id(currentFont);
        }
        fontCombo.connect('changed', () => {
            this.settings.xterm_font = fontCombo.get_active_id();
        });
        this.widgets.xtermFontCombo = fontCombo;

        const fontSizeSpin = Gtk.SpinButton.new_with_range(8, 24, 1);
        fontSizeSpin.set_value(this.settings.xterm_font_size || 11);
        fontSizeSpin.connect('value-changed', () => {
            this.settings.xterm_font_size = fontSizeSpin.get_value_as_int();
        });
        this.widgets.xtermFontSizeSpin = fontSizeSpin;

        const ptLabel = new Gtk.Label({label: 'pt'});

        fontBox.pack_start(fontLabel, false, false, 0);
        fontBox.pack_start(fontCombo, false, false, 0);
        fontBox.pack_start(fontSizeSpin, false, false, 0);
        fontBox.pack_start(ptLabel, false, false, 0);
        box.pack_start(fontBox, false, false, 0);
    }

    getMonospaceFonts() {
        const defaultFonts = [
            'Monospace', 'JetBrains Mono', 'Fira Code', 'Source Code Pro',
            'Hack', 'Cascadia Code', 'Ubuntu Mono', 'Inconsolata',
            'DejaVu Sans Mono', 'Liberation Mono', 'Noto Sans Mono',
            'IBM Plex Mono', 'Roboto Mono', 'Consolas', 'Monaco'
        ];
        const systemFonts = tryOrDefault('SystemTab.getMonospaceFonts', () => {
            const [ok, stdout] = GLib.spawn_command_line_sync('fc-list :spacing=100 family');
            if (!(ok && stdout))
                return [];

            return new TextDecoder().decode(stdout)
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
                .map((line) => line.split(',')[0].trim())
                .filter((value, index, all) => all.indexOf(value) === index)
                .sort();
        }, []);

        return systemFonts.length > 0 ? systemFonts : defaultFonts;
    }

    rgbaToHex(rgba) {
        const r = Math.round(rgba.red * 255).toString(16).padStart(2, '0');
        const g = Math.round(rgba.green * 255).toString(16).padStart(2, '0');
        const b = Math.round(rgba.blue * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    buildSystemThemeSection(box) {
        const label = new Gtk.Label({
            label: this.t('SYSTEM_GTK_THEME_LABEL') || 'System GTK Theme',
            halign: Gtk.Align.START
        });
        label.set_margin_bottom(4);
        box.pack_start(label, false, false, 0);

        const currentTheme = this.getCurrentSystemTheme();

        const systemThemes = this.getSystemGtkThemes()
            .filter((n) => typeof n === 'string' && n.trim().length > 0)
            .map((n) => n.trim())
            .sort();

        const combo = new Gtk.ComboBoxText();
        for (const theme of systemThemes) {
            combo.append(theme, theme);
        }

        this.selectAvailableTheme(combo, currentTheme, systemThemes);
        this.connectThemeChange(combo, (selectedTheme) => this.setSystemTheme(selectedTheme));

        this.widgets.systemGtkThemeCombo = combo;
        box.pack_start(combo, false, false, 0);

        const note = new Gtk.Label({
            label: this.t('SYSTEM_GTK_THEME_NOTE') ||
                'Changes the GTK theme for the entire system. Affects all GTK applications including file managers and system dialogs.',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        note.set_margin_top(4);
        note.set_margin_bottom(16);
        note.get_style_context().add_class('dim-label');
        box.pack_start(note, false, false, 0);
    }

    buildIconThemeSection(box) {
        const label = new Gtk.Label({
            label: this.t('SYSTEM_ICON_THEME_LABEL') || 'Icon Theme',
            halign: Gtk.Align.START
        });
        label.set_margin_bottom(4);
        box.pack_start(label, false, false, 0);

        const currentTheme = this.getCurrentIconTheme();
        const iconThemes = this.getIconThemes();

        const combo = new Gtk.ComboBoxText();
        for (const theme of iconThemes) {
            combo.append(theme, theme);
        }

        this.selectAvailableTheme(combo, currentTheme, iconThemes);
        this.connectThemeChange(combo, (selectedTheme) => this.setIconTheme(selectedTheme));

        this.widgets.systemIconThemeCombo = combo;
        box.pack_start(combo, false, false, 0);

        const note = new Gtk.Label({
            label: this.t('SYSTEM_ICON_THEME_NOTE') ||
                'Changes the icon theme for the entire system.',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        note.set_margin_top(4);
        note.set_margin_bottom(16);
        note.get_style_context().add_class('dim-label');
        box.pack_start(note, false, false, 0);
    }

    buildCursorThemeSection(box) {
        const label = new Gtk.Label({
            label: this.t('SYSTEM_CURSOR_THEME_LABEL') || 'Cursor Theme',
            halign: Gtk.Align.START
        });
        label.set_margin_bottom(4);
        box.pack_start(label, false, false, 0);

        const currentTheme = this.getCurrentCursorTheme();
        const cursorThemes = this.getCursorThemes();

        const combo = new Gtk.ComboBoxText();
        for (const theme of cursorThemes) {
            combo.append(theme, theme);
        }

        this.selectAvailableTheme(combo, currentTheme, cursorThemes);
        this.connectThemeChange(combo, (selectedTheme) => this.setCursorTheme(selectedTheme));

        this.widgets.systemCursorThemeCombo = combo;
        box.pack_start(combo, false, false, 0);

        const note = new Gtk.Label({
            label: this.t('SYSTEM_CURSOR_THEME_NOTE') ||
                'Changes the cursor theme for the entire system.',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        note.set_margin_top(4);
        note.get_style_context().add_class('dim-label');
        box.pack_start(note, false, false, 0);
    }

    getCurrentSystemTheme() {
        return this.readDesktopSetting('gtk-theme') || this.readDconfSetting('gtk-theme');
    }

    setSystemTheme(themeName) {
        this.runAsyncCommand(
            `gsettings set org.gnome.desktop.interface gtk-theme '${themeName}'`,
            'SystemTab.setSystemTheme',
            () => this.onSystemThemeChanged?.(themeName)
        );
    }

    getCurrentIconTheme() {
        return this.readDesktopSetting('icon-theme');
    }

    setIconTheme(themeName) {
        this.runAsyncCommand(
            `gsettings set org.gnome.desktop.interface icon-theme '${themeName}'`,
            'SystemTab.setIconTheme'
        );
    }

    getCurrentCursorTheme() {
        return this.readDesktopSetting('cursor-theme');
    }

    setCursorTheme(themeName) {
        this.runAsyncCommand(
            `gsettings set org.gnome.desktop.interface cursor-theme '${themeName}'`,
            'SystemTab.setCursorTheme'
        );
    }

    getIconThemes() {
        return this.collectThemeNames([
            GLib.build_filenamev([GLib.get_home_dir(), '.icons']),
            GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'icons']),
            '/usr/share/icons'
        ], (path, name) => Gio.File.new_for_path(`${path}/${name}/index.theme`).query_exists(null), 'SystemTab.getIconThemes');
    }

    getCursorThemes() {
        return this.collectThemeNames([
            GLib.build_filenamev([GLib.get_home_dir(), '.icons']),
            GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'icons']),
            '/usr/share/icons'
        ], (path, name) => Gio.File.new_for_path(`${path}/${name}/cursors`).query_exists(null), 'SystemTab.getCursorThemes');
    }
}
