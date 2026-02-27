import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export class ThemePath {
    constructor(themeName, basePath = null) {
        const normalizedName = (typeof themeName === 'string' && themeName.trim().length) ? themeName.trim() : 'default';

        this.themeName = normalizedName;
        this.basePath = basePath || `${GLib.get_home_dir()}/.config/themes`;
        this.themePath = `${this.basePath}/${normalizedName}`;

        this.paths = this.buildPaths();
    }

    resolveFirstExistingPath(candidates = [], fallback = null) {
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.length > 0 && GLib.file_test(candidate, GLib.FileTest.EXISTS)) {
                return candidate;
            }
        }
        return fallback;
    }

    buildScriptCandidates(fileNames = []) {
        const dirs = ['start-scripts', 'scripts'];
        const candidates = [];
        for (const dir of dirs) {
            for (const fileName of fileNames) {
                candidates.push(`${this.themePath}/${dir}/${fileName}`);
            }
        }
        return candidates;
    }

    buildPaths() {
        const cacheIconName = this.themeName;
        const installCandidates = this.buildScriptCandidates([
            'installThemeApps.sh',
            'install_theme_apps.sh'
        ]);
        const postInstallCandidates = this.buildScriptCandidates([
            'setAfterInstallActions.sh',
            'set_after_install_actions.sh'
        ]);
        return {
            root: this.themePath,

            preview: `${this.themePath}/preview.png`,
            wallpaper: `${this.themePath}/wallpaper.png`,
            hyprlandConf: `${this.themePath}/hyprland.conf`,
            metadata: `${this.themePath}/lastlayer-metadata.json`,
            hyprlandDir: `${this.themePath}/hyprland`,
            startScriptsDir: `${this.themePath}/start-scripts`,
            configDir: `${this.themePath}/config`,
            lastlayerConf: `${this.themePath}/hyprland/lastlayer.conf`,
            envConf: `${this.themePath}/hyprland/env.conf`,
            execsConf: `${this.themePath}/hyprland/execs.conf`,
            generalConf: `${this.themePath}/hyprland/general.conf`,
            rulesConf: `${this.themePath}/hyprland/rules.conf`,
            colorsConf: `${this.themePath}/hyprland/colors.conf`,
            keybindsConf: `${this.themePath}/hyprland/keybinds.conf`,
            installScript: this.resolveFirstExistingPath(installCandidates, installCandidates[0]),
            postInstallScript: this.resolveFirstExistingPath(postInstallCandidates, postInstallCandidates[0]),
            installScriptCandidates: installCandidates,
            postInstallScriptCandidates: postInstallCandidates,
            cacheIcon: `${GLib.get_home_dir()}/.config/ags/assets/icons/${cacheIconName}.png`,
            tempDir: `${GLib.get_tmp_dir()}/lastlayer_${cacheIconName}`,
            backupDir: `${this.basePath}/.backups/${cacheIconName}_${Date.now()}`,

            originalDir: `${this.themePath}/.original`,
            originalHyprlandDir: `${this.themePath}/.original/hyprland`,
            perRiceHyprlandFile: `${this.themePath}/per_rice_hyprland.json`,
            perRiceHotkeysFile: `${this.themePath}/per_rice_hotkeys.json`,
            effectiveHyprlandFile: `${this.themePath}/.effective_hyprland.json`,
            effectiveHotkeysFile: `${this.themePath}/.effective_hotkeys.json`,
            legacyOverridesFile: `${this.themePath}/.overrides.json`,
            legacyHotkeyOverridesFile: `${this.themePath}/.hotkey-overrides.json`
        };
    }

    exists() {
        const dir = Gio.File.new_for_path(this.paths.root);
        return dir.query_exists(null);
    }

    remove() {
        if (!this.exists()) {
            return false;
        }

        function removeRecursively(dirPath) {
            let dir = Gio.File.new_for_path(dirPath);
            if (!dir.query_exists(null)) return;
            let enumerator = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null),
                info;
            while ((info = enumerator.next_file(null))) {
                info.get_file_type() === Gio.FileType.DIRECTORY
                    ? removeRecursively(`${dirPath}/${info.get_name()}`)
                    : Gio.File.new_for_path(`${dirPath}/${info.get_name()}`).delete(null);
            }
            enumerator.close(null);
            dir.delete(null);
        }

        removeRecursively(this.paths.root);

        let cachedIcon = Gio.File.new_for_path(this.paths.cacheIcon);
        cachedIcon.query_exists(null) && cachedIcon.delete(null);

        return true;
    }

    toString() {
        return this.paths.root;
    }
}
