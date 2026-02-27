import GLib from 'gi://GLib';
import { standardizeRuleLine } from './HyprlandRecommendationsUtils.js';
import { tryOrDefault, tryOrFalse, tryRun } from '../../../../infrastructure/utils/ErrorUtils.js';
import { patchConfigSourceCandidates } from '../../../../infrastructure/hyprland/HyprlandConfigPatcher.js';
import { fileExists, decodeBytes } from '../../../../infrastructure/utils/Utils.js';

export function applyHyprlandRecommendationsRules(prototype) {
    prototype.getRecommendationRulesPath = function() {
        let themePath = this.getCurrentThemePath?.() || this.getThemePath?.();
        return themePath ? `${themePath}/hyprland/.lastlayer-recommendations.conf` : null;
    };

    prototype.readRecommendationRules = function() {
        let filePath = this.getRecommendationRulesPath?.(),
            [ok, contents] = fileExists(filePath)
            ? tryOrDefault('readRecommendationRules', () => GLib.file_get_contents(filePath), [false, null])
            : [false, null];
        return (ok && contents)
            ? decodeBytes(contents)
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'))
            : [];
    };

    prototype.writeRecommendationRules = function(lines) {
        let themePath = this.getCurrentThemePath?.() || this.getThemePath?.(),
            hyprlandDir = `${themePath}/hyprland`,
            filePath = this.getRecommendationRulesPath?.(),
            canWrite = themePath && GLib.file_test(hyprlandDir, GLib.FileTest.IS_DIR) && filePath;
        return canWrite
            ? (() => {
                let unique = [],
                    seen = new Set();
                for (let line of lines ?? []) {
                    let normalized = standardizeRuleLine(line);
                    normalized && !seen.has(normalized) && (seen.add(normalized), unique.push(line.trim()));
                }

                let output = [
                    '# LastLayer recommendation rules - auto-generated',
                    '# This file is sourced after theme configs to apply recommendations',
                    ''
                ];

                unique.length === 0 ? output.push('# (no recommendation rules)') : output.push(...unique);

                return tryRun('writeRecommendationRules', () => GLib.file_set_contents(filePath, output.join('\n')))
                    ? (this.ensureRecommendationSource?.(), true)
                    : false;
            })()
            : false;
    };

    prototype.ensureRecommendationSource = function() {
        let themePath = this.getCurrentThemePath?.() || this.getThemePath?.();
        if (!themePath) return false;

        let sourceLine = `source=${themePath}/hyprland/.lastlayer-recommendations.conf`;
        return patchConfigSourceCandidates(
            [`${themePath}/hyprland.conf`, `${GLib.get_home_dir()}/.config/hypr/hyprland.conf`],
            sourceLine,
            {confMarker: '.lastlayer-recommendations.conf', comment: '# LastLayer recommendation rules (auto-generated)'}
        );
    };

    prototype.checkRuleExists = function(ruleLine) {
        let normalized = standardizeRuleLine(ruleLine),
            themePath = this.getCurrentThemePath?.() || this.getThemePath?.(),
            candidateFiles = themePath
            ? [
                `${themePath}/hyprland/.lastlayer-recommendations.conf`,
                `${themePath}/hyprland/rules.conf`,
                `${themePath}/hyprland/hyprland.conf`,
                `${themePath}/hyprland.conf`
            ]
            : [];
        let fromFile = (filePath) => {
            return fileExists(filePath) && tryOrFalse('checkRuleExists.readFile', () => {
                let [ok, contents] = GLib.file_get_contents(filePath),
                    text = ok ? decodeBytes(contents) : '';
                return ok && text.split('\n').some(line => standardizeRuleLine(line) === normalized);
            });
        };
        return normalized ? candidateFiles.some(fromFile) : false;
    };
}
