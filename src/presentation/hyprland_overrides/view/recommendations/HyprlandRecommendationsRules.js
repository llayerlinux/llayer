import GLib from 'gi://GLib';
import { standardizeRuleLine } from './HyprlandRecommendationsUtils.js';
import { tryOrDefault, tryOrFalse, tryRun } from '../../../../infrastructure/utils/ErrorUtils.js';
import { patchConfigSourceCandidates } from '../../../../infrastructure/hyprland/HyprlandConfigPatcher.js';
import { convertRuleSyntax, rewriteVersionSpecificSyntax } from '../../../../infrastructure/hyprland/HyprlandRuleSyntaxTransformer.js';
import { fileExists, decodeBytes } from '../../../../infrastructure/utils/Utils.js';

export function applyHyprlandRecommendationsRules(prototype) {
    prototype.getRecommendationRulesPath = function() {
        let themePath = this.getCurrentThemePath?.() || this.getThemePath?.();
        return themePath ? `${themePath}/hyprland/.lastlayer-recommendations.conf` : null;
    };

    prototype.getRecommendationTargetVersion = function() {
        return this.hyprlandConfigGenerator?.detectHyprlandVersion?.() || null;
    };

    prototype.canonicalizeRecommendationRuleLine = function(line) {
        const text = String(line || '').trim();
        if (!text)
            return '';

        const targetVersion = this.getRecommendationTargetVersion?.();
        if (!targetVersion)
            return standardizeRuleLine(text);

        const rewrittenForVersion = rewriteVersionSpecificSyntax(text, targetVersion).content;
        const converted = convertRuleSyntax(rewrittenForVersion, targetVersion).content;
        return standardizeRuleLine(converted);
    };

    prototype.collectCanonicalRecommendationRules = function(lines = []) {
        const unique = [];
        const seen = new Set();

        for (const line of lines ?? []) {
            const canonicalRule = this.canonicalizeRecommendationRuleLine?.(line);
            if (!canonicalRule || seen.has(canonicalRule))
                continue;
            seen.add(canonicalRule);
            unique.push(canonicalRule);
        }

        return unique;
    };

    prototype.readRecommendationRules = function() {
        let filePath = this.getRecommendationRulesPath?.(),
            [ok, contents] = fileExists(filePath)
            ? tryOrDefault('readRecommendationRules', () => GLib.file_get_contents(filePath), [false, null])
            : [false, null];
        if (!(ok && contents))
            return [];

        const rawRules = decodeBytes(contents)
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));
        const canonicalRules = this.collectCanonicalRecommendationRules?.(rawRules) ?? [];
        const changed = rawRules.length !== canonicalRules.length
            || rawRules.some((line, index) => canonicalRules[index] !== this.canonicalizeRecommendationRuleLine?.(line));

        changed && this.writeRecommendationRules?.(canonicalRules);
        return canonicalRules;
    };

    prototype.writeRecommendationRules = function(lines) {
        const themePath = this.getCurrentThemePath?.() || this.getThemePath?.();
        const hyprlandDir = `${themePath}/hyprland`;
        const filePath = this.getRecommendationRulesPath?.();
        const canWrite = themePath && GLib.file_test(hyprlandDir, GLib.FileTest.IS_DIR) && filePath;
        if (!canWrite) {
            return false;
        }

        const unique = this.collectCanonicalRecommendationRules?.(lines) ?? [];
        const output = [
            '# LastLayer recommendation rules - auto-generated',
            '# This file is sourced after theme configs to apply recommendations',
            '',
            ...(unique.length === 0 ? ['# (no recommendation rules)'] : unique)
        ];
        const written = tryRun(
            'writeRecommendationRules',
            () => GLib.file_set_contents(filePath, output.join('\n'))
        );
        if (!written) {
            return false;
        }

        this.ensureRecommendationSource?.();
        return true;
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
        let normalized = this.canonicalizeRecommendationRuleLine?.(ruleLine) || standardizeRuleLine(ruleLine),
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
                return ok && text.split('\n').some((line) => {
                    const candidate = this.canonicalizeRecommendationRuleLine?.(line) || standardizeRuleLine(line);
                    return candidate === normalized;
                });
            });
        };
        return normalized ? candidateFiles.some(fromFile) : false;
    };
}
