import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrDefault } from '../utils/ErrorUtils.js';

export class WaybarStyleNormalizer {
    constructor(options = {}) {
        this.logger = options.logger || null;
        this.minModuleSpacing = 4;
        this.fixes = [];
    }

    log(msg, ...args) {
        if (this.logger?.info) {
            this.logger.info(`[WaybarStyleNormalizer] ${msg}`, ...args);
        }
    }

    rewriteThemeStyles(themePath) {
        const stylePaths = [
            `${themePath}/config/waybar/style.css`,
            `${themePath}/.config/waybar/style.css`,
        ];

        for (const stylePath of stylePaths) {
            if (GLib.file_test(stylePath, GLib.FileTest.EXISTS))
                return this.rewriteStyleFile(stylePath);
        }

        return { success: true, fixesApplied: 0, fixes: [], message: 'No waybar style.css found' };
    }

    rewriteStyleFile(stylePath) {
        return tryOrDefault('WaybarStyleNormalizer.rewriteStyleFile', () => {
            const [ok, contents] = GLib.file_get_contents(stylePath);
            if (!ok)
                return { success: false, error: 'Could not read waybar style.css' };

            const originalCss = new TextDecoder().decode(contents);
            const { css: rewrittenCss, fixes } = this.rewriteCssSpacing(originalCss);

            if (fixes.length === 0) {
                this.log(`No spacing issues detected in ${stylePath}`);
                return { success: true, fixesApplied: 0, fixes: [] };
            }

            GLib.file_set_contents(stylePath, rewrittenCss);

            this.log(`Applied ${fixes.length} spacing fixes to ${stylePath}`);
            for (const fix of fixes)
                this.log(`  - ${fix}`);

            return { success: true, fixesApplied: fixes.length, fixes };
        }, { success: false, error: 'Could not rewrite waybar style.css' });
    }

    rewriteCssSpacing(css) {
        const fixes = [];
        let result = css;

        const modulesRightZeroMargin = /\.modules-right\s*>\s*widget\s*>\s*\*\s*\{([^}]*margin-left:\s*0[^}]*margin-right:\s*0[^}]*)\}/gi;

        if (modulesRightZeroMargin.test(css)) {
            result = result.replace(
                /\.modules-right\s*>\s*widget\s*>\s*\*\s*\{([^}]*)margin-left:\s*0;([^}]*)margin-right:\s*0;([^}]*)\}/gi,
                (match, before, middle, after) => {
                    fixes.push('Added 4px margin-right to .modules-right widgets for better icon spacing');
                    return `.modules-right > widget > * {${before}margin-left: 0;${middle}margin-right: 4px;${after}}`;
                }
            );
        }

        result = result.replace(
            /padding:\s*(\d+)(?:px)?\s+([0-3])px\s*;/gi,
            (match, vertical, horizontal) => {
                if (parseInt(horizontal) < this.minModuleSpacing) {
                    fixes.push(`Increased horizontal padding from ${horizontal}px to ${this.minModuleSpacing}px`);
                    return `padding: ${vertical}px ${this.minModuleSpacing}px;`;
                }
                return match;
            }
        );

        if (!result.includes('.modules-right > widget:not(:first-child)') &&
            !result.includes('.modules-right > widget + widget') &&
            modulesRightZeroMargin.test(css)) {

            const insertPosition = result.lastIndexOf('}');
            if (insertPosition > 0) {
                const spacingRule = `

.modules-right > widget:not(:first-child) > * {
    margin-left: 2px;
}
`;
                if (!fixes.some(f => f.includes('margin-right'))) {
                    result = result.slice(0, insertPosition + 1) + spacingRule;
                    fixes.push('Added 2px spacing rule between .modules-right widgets');
                }
            }
        }

        const iconModules = ['#battery', '#pulseaudio', '#backlight', '#network', '#bluetooth', '#cpu', '#memory', '#temperature'];
        for (const module of iconModules) {
            const moduleRegex = new RegExp(`${module.replace('#', '\\#')}\\s*\\{([^}]*)\\}`, 'gi');
            const moduleMatch = css.match(moduleRegex);

            if (moduleMatch) {
                const moduleContent = moduleMatch[0];
                if (!moduleContent.includes('padding') || /padding:\s*0[^0-9]|padding:\s*[0-3]px/i.test(moduleContent)) {
                    this.log(`Note: ${module} may have tight padding`);
                }
            }
        }

        return { css: result, fixes };
    }

    analyze(themePath) {
        const stylePaths = [
            `${themePath}/config/waybar/style.css`,
            `${themePath}/.config/waybar/style.css`,
        ];

        for (const stylePath of stylePaths) {
            if (GLib.file_test(stylePath, GLib.FileTest.EXISTS)) {
                const analysis = tryOrDefault('WaybarStyleNormalizer.analyze', () => {
                    const [ok, contents] = GLib.file_get_contents(stylePath);
                    if (!ok)
                        return null;

                    const css = new TextDecoder().decode(contents);
                    const { fixes } = this.rewriteCssSpacing(css);

                    return {
                        found: true,
                        path: stylePath,
                        issuesDetected: fixes.length,
                        issues: fixes.map((fix) => fix.replace(/Added|Increased/, 'Needs'))
                    };
                }, null);
                if (analysis)
                    return analysis;
            }
        }

        return { found: false };
    }

    rewriteThemeConfigs(themePath, options = {}) {
        const changes = [];

        const waybarConfigPaths = [
            `${themePath}/config/waybar/config`,
            `${themePath}/config/waybar/config.jsonc`,
            `${themePath}/config/waybar/config.json`,
            `${themePath}/.config/waybar/config`,
            `${themePath}/.config/waybar/config.jsonc`,
            `${themePath}/.config/waybar/config.json`,
        ];

        for (const configPath of waybarConfigPaths) {
            if (GLib.file_test(configPath, GLib.FileTest.EXISTS)) {
                const result = this.rewriteWaybarConfigFile(configPath, options);
                if (result.changes.length > 0) {
                    changes.push(...result.changes);
                }
                if (result.error) {
                    return { success: false, changes, error: result.error };
                }
            }
        }

        const hyprpanelConfigPaths = [
            `${themePath}/config/hyprpanel/config.json`,
            `${themePath}/config/HyprPanel/config.json`,
            `${themePath}/.config/hyprpanel/config.json`,
            `${themePath}/.config/HyprPanel/config.json`,
        ];

        for (const configPath of hyprpanelConfigPaths) {
            if (GLib.file_test(configPath, GLib.FileTest.EXISTS)) {
                const result = this.rewriteHyprPanelConfigFile(configPath, options);
                if (result.changes.length > 0) {
                    changes.push(...result.changes);
                }
                if (result.error) {
                    return { success: false, changes, error: result.error };
                }
            }
        }

        return { success: true, changes };
    }

    rewriteWaybarConfigFile(configPath, options = {}) {
        const changes = [];
        return tryOrDefault('WaybarStyleNormalizer.rewriteWaybarConfigFile', () => {
            const [ok, contents] = GLib.file_get_contents(configPath);
            if (!ok)
                return { changes: [], error: 'Could not read waybar config' };

            let content = new TextDecoder().decode(contents);
            let modified = false;

            if (options.hideWifiName) {
                const result = this.hideWifiNameInConfig(content);
                if (result.modified) {
                    content = result.content;
                    modified = true;
                    changes.push(...result.changes);
                }
            }

            if (modified) {
                GLib.file_set_contents(configPath, content);
                this.log(`Applied ${changes.length} config changes to ${configPath}`);
            }

            return { changes };
        }, { changes, error: 'Could not rewrite waybar config' });
    }

    rewriteHyprPanelConfigFile(configPath, options = {}) {
        const changes = [];
        return tryOrDefault('WaybarStyleNormalizer.rewriteHyprPanelConfigFile', () => {
            const [ok, contents] = GLib.file_get_contents(configPath);
            if (!ok)
                return { changes: [], error: 'Could not read HyprPanel config' };

            let content = new TextDecoder().decode(contents);
            let modified = false;

            if (options.hideWifiName) {
                const result = this.hideWifiNameInHyprPanel(content);
                if (result.modified) {
                    content = result.content;
                    modified = true;
                    changes.push(...result.changes);
                }
            }

            if (modified) {
                GLib.file_set_contents(configPath, content);
                this.log(`Applied ${changes.length} HyprPanel config changes to ${configPath}`);
                const [verifyOk, verifyContents] = GLib.file_get_contents(configPath);
                if (verifyOk) {
                    const verifyText = new TextDecoder().decode(verifyContents);
                    if (verifyText.includes('"bar.network.label": false')) {
                        this.log(`Verified: bar.network.label is false in ${configPath}`);
                    } else {
                        this.log(`WARNING: bar.network.label may not be set correctly in ${configPath}`);
                    }
                }
            }

            return { changes };
        }, { changes, error: 'Could not rewrite HyprPanel config' });
    }

    hideWifiNameInHyprPanel(content) {
        const changes = [];
        const config = tryOrDefault('WaybarStyleNormalizer.hideWifiNameInHyprPanel.parse', () => JSON.parse(content), null);
        if (config && typeof config === 'object') {
            let modified = false;
            const labelKey = 'bar.network.label';
            if (config[labelKey] === true || config[labelKey] === undefined) {
                config[labelKey] = false;
                changes.push(`HyprPanel: Set ${labelKey} to false (hide WiFi name in bar)`);
                modified = true;
            }

            const infoKey = 'bar.network.showWifiInfo';
            if (config[infoKey] === true || config[infoKey] === undefined) {
                config[infoKey] = false;
                changes.push(`HyprPanel: Set ${infoKey} to false (hide WiFi tooltip info)`);
                modified = true;
            }

            if (modified) {
                return {
                    content: JSON.stringify(config, null, 2),
                    modified: true,
                    changes
                };
            }
        } else {
            this.log('Failed to parse HyprPanel config as JSON, using regex fallback');
        }

        let newContent = content;
        let fallbackModified = false;

        const labelRegex = /"bar\.network\.label"\s*:\s*true/g;
        if (labelRegex.test(newContent)) {
            newContent = newContent.replace(labelRegex, '"bar.network.label": false');
            changes.push('HyprPanel: Set bar.network.label to false (regex fallback)');
            fallbackModified = true;
        }

        const showWifiRegex = /"bar\.network\.showWifiInfo"\s*:\s*true/g;
        if (showWifiRegex.test(newContent)) {
            newContent = newContent.replace(showWifiRegex, '"bar.network.showWifiInfo": false');
            changes.push('HyprPanel: Set bar.network.showWifiInfo to false (regex fallback)');
            fallbackModified = true;
        }

        if (fallbackModified)
            return { content: newContent, modified: true, changes };

        return { content, modified: false, changes: [] };
    }

    hideWifiNameInConfig(content) {
        const changes = [];
        let modified = false;

        const formatWifiRegex = /"format-wifi"\s*:\s*"([^"]*)"/g;

        const newContent = content.replace(formatWifiRegex, (match, format) => {
            let newFormat = format
                .replace(/\{essid\}\s*/gi, '')
                .replace(/\s*\{essid\}/gi, '')
                .replace(/^\s+/, '')
                .replace(/\s+$/, ' ')
                .trim();

            if (!newFormat || newFormat.trim() === '') {
                newFormat = '{signalStrength}% ';
            }

            if (newFormat !== format) {
                changes.push(`Removed WiFi ESSID from format-wifi: "${format}" → "${newFormat}"`);
                modified = true;
                return `"format-wifi": "${newFormat}"`;
            }

            return match;
        });

        return {
            content: newContent,
            modified,
            changes
        };
    }
}

export default WaybarStyleNormalizer;
