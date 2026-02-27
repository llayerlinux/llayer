import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import { CSS_FILES, getScssFilesForTheme } from './StyleFiles.js';
import { tryOrDefault, tryRun } from '../../infrastructure/utils/ErrorUtils.js';

export class AppSettingsService {
    constructor(options = {}) {
        this.logger = options.logger || null;
        this.currentDir = options.currentDir || GLib.get_current_dir();
        this.homeDir = options.homeDir || GLib.get_home_dir();
    }

    log(level, message, data = null) {
        this.logger?.[level]?.('AppSettingsService', message, data);
    }

    applyGtkTheme(themeName, settings = {}) {
        const target = (themeName || settings?.gtkTheme || '').trim();
        const gtkSettings = this.getGtkSettings();
        if (!(target && gtkSettings)) {
            return;
        }
        settings.gtkTheme = target;

        const applyThemeProperties = (theme, iconTheme = null) => {
            gtkSettings.set_property('gtk-theme-name', theme);
            iconTheme && gtkSettings.set_property('gtk-icon-theme-name', iconTheme);
            gtkSettings.set_property('gtk-application-prefer-dark-theme', true);
            Gtk.IconTheme.get_default()?.rescan_if_needed?.();
        };

        const finalizeTheme = (styleName, useLastLayerOpacity) => {
            this.ensureLastLayerOpacity(useLastLayerOpacity);
            this.loadExternalStyles(styleName, settings);
            this.refreshGtkWidgets();
        };

        const normalized = target.toLowerCase();
        if (normalized.startsWith('lastlayer')) {
            applyThemeProperties('Adwaita-dark');
            finalizeTheme(target, true);
            return;
        }
        if (target === 'System') {
            const gs = new Gio.Settings({schema: 'org.gnome.desktop.interface'});
            const sysTheme = gs.get_string('gtk-theme');
            const iconTheme = gs.get_string('icon-theme');
            [
                ['gtk-theme-name', sysTheme],
                ['gtk-icon-theme-name', iconTheme]
            ].forEach(([prop, value]) => value && gtkSettings.set_property(prop, value));
            finalizeTheme(null, false);
            return;
        }

        const darkVariant = normalized.includes('dark') ? target : `${target}-dark`;
        applyThemeProperties(darkVariant, 'Adwaita');
        finalizeTheme(null, false);
    }

    getGtkSettings() {
        this.gtkSettingsInstance ||= Gtk.Settings.get_default();
        return this.gtkSettingsInstance;
    }

    ensureLastLayerOpacity(enable) {
        let hyprConf = `${this.homeDir}/.config/hypr/hyprland.conf`;
        let hyprConfFile = Gio.File.new_for_path(hyprConf);
        if (!hyprConfFile.query_exists(null)) return;

        let [ok, data] = tryOrDefault('ensureLastLayerOpacity.readHyprConf', () => GLib.file_get_contents(hyprConf), [false, null]);
        if (!ok || !data) return;

        let content = new TextDecoder('utf-8').decode(data);
        let rulePath = `${this.homeDir}/.config/hypr/lastlayer.conf`;
        let wroteSourcePath = content.match(/^\s*source\s*=\s*(.*lastlayer\.conf)\s*$/m) || tryRun('ensureLastLayerOpacity.writeHyprConf', () => {
            content += `\nsource=${rulePath}\n`;
            hyprConfFile.replace_contents(content, null, false, Gio.FileCreateFlags.NONE, null);
        });
        if (!wroteSourcePath) {
            this.log?.('warn', `Could not write ${hyprConf}`);
            return;
        }

        let ruleFile = Gio.File.new_for_path(rulePath);
        let ruleReadResult = ruleFile.query_exists(null)
            ? tryOrDefault('ensureLastLayerOpacity.readRuleFile', () => GLib.file_get_contents(rulePath), [false, null])
            : [false, null];
        let [okRules, rulesData] = ruleReadResult;
        let rulesText = okRules && rulesData ? new TextDecoder('utf-8').decode(rulesData) : '';
        !okRules && ruleFile.query_exists(null) && this.log?.('warn', `Could not read ${rulePath}`);

        let lines = rulesText.split(/\r?\n/).filter(Boolean);
        let rule = 'windowrulev2 = opacity 0.6,class:^(lastlayer)$';
        let idx = lines.findIndex((line) => /opacity\s+0\.6/.test(line) && /lastlayer/.test(line));

        enable
            ? (idx >= 0 ? (lines[idx] = rule) : lines.push(rule))
            : (idx >= 0 && lines.splice(idx, 1));

        let newText = `${lines.join('\n')}\n`;
        let writeFailed = newText !== rulesText && !tryRun('ensureLastLayerOpacity.writeRuleFile', () => {
            ruleFile.replace_contents(newText, null, false, Gio.FileCreateFlags.NONE, null);
        });
        writeFailed && this.log?.('warn', `Could not write ${rulePath}`);
    }

    loadExternalStyles(theme, settings = {}) {
        const stylesDir = GLib.build_filenamev([this.currentDir, 'styles']);
        const screen = Gdk.Screen.get_default();
        screen && (() => {
            const scssFiles = getScssFilesForTheme(theme || settings.gtkTheme);
            CSS_FILES.forEach((fname) => this.loadCssFile(screen, GLib.build_filenamev([stylesDir, fname])));
            scssFiles.forEach((fname) => this.loadScssFile(screen, GLib.build_filenamev([stylesDir, fname])));
        })();
    }

    loadCssFile(screen, path) {
        Gio.File.new_for_path(path).query_exists(null) && (() => {
            const [, rawData] = GLib.file_get_contents(path);
            const cssText = new TextDecoder('utf-8').decode(rawData);
            this.loadCssText(screen, cssText, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION + 2);
        })();
    }

    loadScssFile(screen, path) {
        Gio.File.new_for_path(path).query_exists(null) && (() => {
            const [, rawData] = GLib.file_get_contents(path);
            let cssText = new TextDecoder('utf-8').decode(rawData);
            cssText = cssText.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
            this.loadCssText(screen, cssText, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION + 1);
        })();
    }

    loadCssText(screen, cssText, priority) {
        const provider = new Gtk.CssProvider();
        provider.load_from_data(cssText);
        Gtk.StyleContext.add_provider_for_screen(screen, provider, priority);
    }

    refreshGtkWidgets() {
        const screen = Gdk.Screen.get_default();
        screen && Gtk.StyleContext.reset_widgets?.(screen);
        Gtk.Window.list_toplevels?.().forEach((win) => {
            const canRenameWindow = typeof win?.set_name === 'function' && typeof win?.get_name === 'function',
                currentName = canRenameWindow ? win.get_name() : '';
            canRenameWindow && (!currentName || !currentName.toLowerCase().includes('lastlayershell'))
                && win.set_name('LastLayerShellWindow');

            win?.reset_style?.();
            win?.queue_draw?.();
        });
    }
}
