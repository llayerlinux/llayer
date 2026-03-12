import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import { LegacyMigrationService } from './LegacyMigrationService.js';
import {
    getHyprlandDocumentationSeries,
    getHyprlandVersionProfile
} from './HyprlandVersionMatrix.js';
import {
    buildLastLayerConfForVersion,
    convertLegacyGestures,
    convertRuleSyntax,
    rewriteVersionSpecificSyntax
} from './HyprlandRuleSyntaxTransformer.js';
import { tryOrDefault, tryOrNull } from '../utils/ErrorUtils.js';

export class HyprlandConfigGenerator {
    constructor(options = {}) {
        this.logger = options.logger || null;
        this.legacyMigrationService = options.legacyMigrationService
            || new LegacyMigrationService((message) => this.log(message));
    }

    log(message, data = null) {
        if (this.logger?.info) {
            this.logger.info(`[HyprlandConfigGenerator] ${message}`, data);
            return;
        }
        if (data !== null) {
            print(`[HyprlandConfigGenerator] ${message} ${JSON.stringify(data)}`);
            return;
        }
        print(`[HyprlandConfigGenerator] ${message}`);
    }

    detectHyprlandVersion() {
        return this.legacyMigrationService.getHyprlandVersion();
    }

    findHyprlandConfigs(themePath) {
        return this.legacyMigrationService.findHyprlandConfigs(themePath);
    }

    getMetadataPath(themePath) {
        return `${themePath}/.hyprland-generated.json`;
    }

    readGenerationMetadata(themePath) {
        const metadataPath = this.getMetadataPath(themePath);
        if (!GLib.file_test(metadataPath, GLib.FileTest.EXISTS))
            return null;
        const metadataText = tryOrNull('HyprlandConfigGenerator.readGenerationMetadata.read', () => {
            const [ok, bytes] = GLib.file_get_contents(metadataPath);
            return ok && bytes ? new TextDecoder('utf-8').decode(bytes) : null;
        });
        return metadataText
            ? tryOrDefault('HyprlandConfigGenerator.readGenerationMetadata.parse', () => JSON.parse(metadataText), null)
            : null;
    }

    getFileMtimeSeconds(path) {
        return tryOrDefault('HyprlandConfigGenerator.getFileMtimeSeconds', () =>
            Gio.File.new_for_path(path)
                .query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null)
                .get_attribute_uint64('time::modified')
        , 0);
    }

    isThemeGenerationFresh(themePath, targetVersion) {
        const metadata = this.readGenerationMetadata(themePath);
        if (!metadata)
            return false;
        if (metadata.targetVersion !== targetVersion)
            return false;

        const metadataPath = this.getMetadataPath(themePath);
        const metadataMtime = this.getFileMtimeSeconds(metadataPath);
        if (!metadataMtime)
            return false;

        const configFiles = this.findHyprlandConfigs(themePath);
        return configFiles.every((filePath) => this.getFileMtimeSeconds(filePath) <= metadataMtime);
    }

    ensureLastLayerConf(themePath, targetVersion) {
        const hyprlandDir = `${themePath}/hyprland`;
        const lastlayerConfPath = `${hyprlandDir}/lastlayer.conf`;
        if (!GLib.file_test(hyprlandDir, GLib.FileTest.IS_DIR))
            return false;
        if (GLib.file_test(lastlayerConfPath, GLib.FileTest.EXISTS))
            return false;
        GLib.file_set_contents(lastlayerConfPath, buildLastLayerConfForVersion(targetVersion));
        return true;
    }

    collectConfigVariables(content) {
        const variables = {};
        for (const rawLine of String(content || '').split(/\r?\n/)) {
            const line = rawLine.replace(/\s+#.*$/, '').trim();
            const match = line.match(/^\$([A-Za-z0-9_]+)\s*=\s*(.+)$/);
            if (!match)
                continue;
            variables[match[1]] = match[2].trim();
        }
        return variables;
    }

    expandConfigVariables(value, variables = {}) {
        let output = String(value || '').trim();
        for (let pass = 0; pass < 8; pass++) {
            const previous = output;
            for (const [name, replacement] of Object.entries(variables)) {
                output = output.replace(new RegExp(`\\$${name}(?=[^A-Za-z0-9_]|$)`, 'g'), String(replacement));
            }
            if (output === previous)
                break;
        }
        return output;
    }

    shouldDisableScreenShader(shaderPath) {
        if (!shaderPath || !GLib.file_test(shaderPath, GLib.FileTest.EXISTS))
            return false;
        const shaderSource = tryOrDefault('HyprlandConfigGenerator.shouldDisableScreenShader', () => {
            const [ok, bytes] = GLib.file_get_contents(shaderPath);
            return ok && bytes ? new TextDecoder('utf-8').decode(bytes) : '';
        }, '');
        if (!shaderSource)
            return false;

        const normalizedSource = shaderSource.toLowerCase();
        const hasVersion = /^\s*#version\b/m.test(shaderSource);
        const usesLegacyGlsl = /\bvarying\b|\bgl_fragcolor\b|\btexture2d\b/.test(normalizedSource);
        return !hasVersion || usesLegacyGlsl;
    }

    sanitizeScreenShaders(content) {
        const variables = this.collectConfigVariables(content);
        let disabledCount = 0;
        const lines = String(content || '').split(/\r?\n/).map((rawLine) => {
            const stripped = rawLine.replace(/\s+#.*$/, '').trim();
            const match = stripped.match(/^screen_shader\s*=\s*(.+)$/);
            if (!match)
                return rawLine;

            const expandedPath = this.expandConfigVariables(match[1], variables);
            if (!this.shouldDisableScreenShader(expandedPath))
                return rawLine;

            disabledCount++;
            return '';
        });

        return {
            changed: disabledCount > 0,
            disabledCount,
            content: lines.join('\n').replace(/\n{3,}/g, '\n\n')
        };
    }

    generateContentForVersion(content, options = {}) {
        const targetVersion = options.targetVersion || this.detectHyprlandVersion();
        const stats = {
            gesturesConverted: 0,
            ruleLinesConverted: 0,
            unresolvedRules: 0,
            screenShadersDisabled: 0,
            legacyMigrations: {
                disabled: 0,
                converted: 0,
                futureDisabled: 0,
                futureConverted: 0
            }
        };

        let result = String(content ?? '');
        let migrationDetails = {
            disabled: [],
            converted: [],
            futureDisabled: [],
            futureConverted: []
        };

        const rewrittenBeforeMigration = rewriteVersionSpecificSyntax(result, targetVersion);
        if (rewrittenBeforeMigration.changed)
            result = rewrittenBeforeMigration.content;

        const gesturesResult = convertLegacyGestures(result, targetVersion);
        if (gesturesResult.changed) {
            stats.gesturesConverted++;
            result = gesturesResult.content;
        }

        if (options.runLegacyMigration !== false) {
            const migrationResult = this.legacyMigrationService.migrateConfigBidirectional(result, {
                ...options.legacyOptions,
                autoMigrate: options.autoMigrate !== false,
                targetVersion
            });
            if (typeof migrationResult?.content === 'string')
                result = migrationResult.content;
            migrationDetails = {
                disabled: migrationResult?.migrations?.disabled || [],
                converted: migrationResult?.migrations?.converted || [],
                futureDisabled: migrationResult?.futureMigrations?.disabled || [],
                futureConverted: migrationResult?.futureMigrations?.converted || []
            };
            stats.legacyMigrations.disabled = migrationDetails.disabled.length;
            stats.legacyMigrations.converted = migrationDetails.converted.length;
            stats.legacyMigrations.futureDisabled = migrationDetails.futureDisabled.length;
            stats.legacyMigrations.futureConverted = migrationDetails.futureConverted.length;
        }

        const gesturesAfterMigration = convertLegacyGestures(result, targetVersion);
        if (gesturesAfterMigration.changed) {
            stats.gesturesConverted++;
            result = gesturesAfterMigration.content;
        }

        const rulesResult = convertRuleSyntax(result, targetVersion);
        if (rulesResult.changed) {
            result = rulesResult.content;
            stats.ruleLinesConverted += rulesResult.convertedCount || 0;
        }
        stats.unresolvedRules = rulesResult.unresolvedCount || 0;

        const rewrittenAfterRules = rewriteVersionSpecificSyntax(result, targetVersion);
        if (rewrittenAfterRules.changed)
            result = rewrittenAfterRules.content;

        const sanitizedShaders = this.sanitizeScreenShaders(result);
        if (sanitizedShaders.changed) {
            result = sanitizedShaders.content;
            stats.screenShadersDisabled = sanitizedShaders.disabledCount;
        }

        return {
            content: result,
            targetVersion,
            profile: getHyprlandVersionProfile(targetVersion),
            documentation: getHyprlandDocumentationSeries(targetVersion),
            stats,
            migrations: migrationDetails
        };
    }

    writeGenerationMetadata(themePath, generationResult, modifiedFiles, files = []) {
        const metadataPath = `${themePath}/.hyprland-generated.json`;
        const payload = {
            generatedAt: new Date().toISOString(),
            targetVersion: generationResult.targetVersion,
            profile: generationResult.profile?.profile || 'unknown',
            documentationSeries: generationResult.documentation?.series || null,
            docs: generationResult.documentation?.docs || generationResult.profile?.docs || {},
            capabilities: generationResult.profile?.capabilities || {},
            modifiedFiles,
            files
        };
        GLib.file_set_contents(metadataPath, JSON.stringify(payload, null, 2));
    }

    generateThemeForCurrentVersion(themePath, options = {}) {
        const targetVersion = options.targetVersion || this.detectHyprlandVersion();
        const profile = getHyprlandVersionProfile(targetVersion);
        const documentation = getHyprlandDocumentationSeries(targetVersion);
        if (options.skipIfFresh !== false && this.isThemeGenerationFresh(themePath, targetVersion)) {
            return {
                success: true,
                skipped: true,
                targetVersion,
                profile,
                documentation,
                createdLastLayerConf: false,
                modifiedFiles: [],
                files: []
            };
        }
        const createdLastLayerConf = this.ensureLastLayerConf(themePath, targetVersion);
        const files = this.findHyprlandConfigs(themePath);
        const modifiedFiles = [];
        const perFile = [];

        for (const filePath of files) {
            const [ok, bytes] = GLib.file_get_contents(filePath);
            if (!ok)
                continue;

            const currentContent = new TextDecoder('utf-8').decode(bytes);
            const generated = this.generateContentForVersion(currentContent, {
                ...options,
                targetVersion
            });

            if (generated.content !== currentContent) {
                GLib.file_set_contents(filePath, generated.content);
                modifiedFiles.push(filePath);
            }

            perFile.push({
                filePath,
                changed: generated.content !== currentContent,
                stats: generated.stats
            });
        }

        if (options.writeMetadata !== false) {
            this.writeGenerationMetadata(
                themePath,
                {
                    targetVersion,
                    profile,
                    documentation
                },
                modifiedFiles,
                perFile
            );
        }

        return {
            success: true,
            targetVersion,
            profile,
            documentation,
            createdLastLayerConf,
            modifiedFiles,
            files: perFile
        };
    }
}
