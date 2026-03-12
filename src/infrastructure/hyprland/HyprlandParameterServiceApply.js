import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull, tryRun } from '../utils/ErrorUtils.js';

class HyprlandParameterServiceApply {
    applyOverridesToConfig(themePath, settings, options = {}) {
        const {
            runLegacyMigration = true,
            legacyOptions = {},
            useObservedState = true,
            ignoreGlobalMigrations = false,
            forceAutoMigrate = false
        } = options;
        const result = {
            success: true,
            migratedFiles: [],
            migrations: { disabled: [], converted: [], futureDisabled: [], futureConverted: [] },
            overridesApplied: 0,
            errors: []
        };

        const configFiles = this.findHyprlandConfigs(themePath);
        if (configFiles.length === 0) {
            this.log(`No hyprland configs found in ${themePath}`);
            return result;
        }

        const collection = this.getMergedParameters(themePath, settings);
        const overrides = collection.getApplicableOverrides();
        const migrationService = this.legacyMigrationService;
        const configGenerator = this.configGenerator;
        const targetVersion = this.getUserHyprlandVersion?.() || null;

        const globalLegacy = ignoreGlobalMigrations ? {} : (settings?.legacySettings || {});
        const savedMigrations = migrationService?.readMigrations?.(themePath) || {};

        const hasEnabledLegacyOverride = Object.prototype.hasOwnProperty.call(legacyOptions, 'enabledLegacy');
        const hasRevertedLegacyOverride = Object.prototype.hasOwnProperty.call(legacyOptions, 'revertedConversions');
        const hasEnabledFutureOverride = Object.prototype.hasOwnProperty.call(legacyOptions, 'enabledFuture');
        const hasRevertedFutureOverride = Object.prototype.hasOwnProperty.call(legacyOptions, 'revertedFutureConversions');
        const hasExplicitMetadata =
            hasEnabledLegacyOverride ||
            hasRevertedLegacyOverride ||
            hasEnabledFutureOverride ||
            hasRevertedFutureOverride ||
            Object.prototype.hasOwnProperty.call(savedMigrations, 'explicitEnabledLegacy') ||
            Object.prototype.hasOwnProperty.call(savedMigrations, 'explicitRevertedLegacy') ||
            Object.prototype.hasOwnProperty.call(savedMigrations, 'explicitEnabledFuture') ||
            Object.prototype.hasOwnProperty.call(savedMigrations, 'explicitRevertedFuture') ||
            Object.prototype.hasOwnProperty.call(savedMigrations, 'explicitRevertedFutureOldPaths');

        const dedupe = (list) => Array.from(new Set((list || []).filter(Boolean)));
        const resolveExplicitList = (overrideList, savedKey, fallbackList) => {
            if (overrideList) return dedupe(overrideList);
            if (hasExplicitMetadata) return dedupe(savedMigrations[savedKey] || []);
            return dedupe(fallbackList || []);
        };

        const explicitEnabledLegacy = resolveExplicitList(
            hasEnabledLegacyOverride ? legacyOptions.enabledLegacy : null,
            'explicitEnabledLegacy',
            (savedMigrations.disabled || []).filter(d => d.userEnabled).map(d => d.path)
        );
        const explicitRevertedLegacy = resolveExplicitList(
            hasRevertedLegacyOverride ? legacyOptions.revertedConversions : null,
            'explicitRevertedLegacy',
            (savedMigrations.converted || []).filter(c => c.userReverted).map(c => c.oldPath)
        );
        const explicitEnabledFuture = resolveExplicitList(
            hasEnabledFutureOverride ? legacyOptions.enabledFuture : null,
            'explicitEnabledFuture',
            (savedMigrations.futureDisabled || []).filter(d => d.userEnabled).map(d => d.path)
        );
        const explicitRevertedFuture = resolveExplicitList(
            hasRevertedFutureOverride ? legacyOptions.revertedFutureConversions : null,
            'explicitRevertedFuture',
            (savedMigrations.futureConverted || []).filter(c => c.userReverted).map(c => c.newPath)
        );
        const explicitRevertedFutureOldPaths = dedupe(savedMigrations.explicitRevertedFutureOldPaths || []);

        const explicitEnabledLegacySet = new Set(explicitEnabledLegacy);
        const explicitRevertedLegacySet = new Set(explicitRevertedLegacy);
        const explicitEnabledFutureSet = new Set(explicitEnabledFuture);
        const explicitRevertedFutureSet = new Set(explicitRevertedFuture);

        const enabledLegacy = dedupe([
            ...explicitEnabledLegacy,
            ...(globalLegacy.globalEnabledLegacy || []).filter(p => !explicitEnabledLegacySet.has(p))
        ]);
        const revertedConversions = dedupe([
            ...explicitRevertedLegacy,
            ...(globalLegacy.globalRevertedConversions || []).filter(p => !explicitRevertedLegacySet.has(p))
        ]);
        const enabledFuture = dedupe([
            ...explicitEnabledFuture,
            ...(globalLegacy.globalEnabledFuture || []).filter(p => !explicitEnabledFutureSet.has(p))
        ]);
        const revertedFutureConversions = dedupe([
            ...explicitRevertedFuture,
            ...(globalLegacy.globalRevertedFutureConversions || []).filter(p => !explicitRevertedFutureSet.has(p))
        ]);

        const migrationOptions = {
            autoMigrate: forceAutoMigrate
                ? true
                : (settings?.autoConvertLegacyParams !== false && globalLegacy.autoMigrate !== false),
            enabledLegacy,
            revertedConversions,
            enabledFuture,
            revertedFutureConversions
        };

        for (const configPath of configFiles) {
            const processed = this.processConfigFile(configPath, overrides, {
                configGenerator,
                migrationOptions,
                migrationService,
                runLegacyMigration,
                targetVersion,
                useObservedState
            });
            if (!processed) {
                continue;
            }

            if (processed.error) {
                this.log(`Error processing ${configPath}: ${processed.error}`);
                result.errors.push({ file: configPath, error: processed.error });
                continue;
            }

            result.overridesApplied += processed.overrideCount;
            result.migrations.disabled.push(...processed.migrations.disabled);
            result.migrations.converted.push(...processed.migrations.converted);
            result.migrations.futureDisabled.push(...processed.migrations.futureDisabled);
            result.migrations.futureConverted.push(...processed.migrations.futureConverted);
            if (processed.modified) {
                result.migratedFiles.push(configPath);
            }
        }

        if (migrationService?.writeMigrations) {
            const scanResults = configFiles.map((filePath) =>
                this.scanConfigMigrations(filePath, migrationService)
            );

            const migrationsPayload = {
                disabled: scanResults.flatMap(r => r.legacy.disabled),
                converted: scanResults.flatMap(r => r.legacy.converted),
                futureDisabled: scanResults.flatMap(r => r.future.disabled),
                futureConverted: scanResults.flatMap(r => r.future.converted)
            };

            if (hasExplicitMetadata) {
                migrationsPayload.explicitEnabledLegacy = explicitEnabledLegacy;
                migrationsPayload.explicitRevertedLegacy = explicitRevertedLegacy;
                migrationsPayload.explicitEnabledFuture = explicitEnabledFuture;
                migrationsPayload.explicitRevertedFuture = explicitRevertedFuture;
                migrationsPayload.explicitRevertedFutureOldPaths = explicitRevertedFutureOldPaths;
            }

            migrationService.writeMigrations(themePath, migrationsPayload);
        }

        this.writeEffectiveOverrides(themePath, settings);
        result.success = result.errors.length === 0;
        return result;
    }

    processConfigFile(configPath, overrides, context) {
        const fileResult = this.readConfigFileContent(configPath);
        if (!fileResult?.ok) {
            return fileResult?.error ? { error: fileResult.error } : null;
        }

        let content = fileResult.content;
        let modified = false;
        const overrideResult = this.applyOverridesToContent(content, overrides);
        if (overrideResult.modified) {
            content = overrideResult.content;
            modified = true;
        }

        const generationResult = this.generateVersionAwareConfigContent(content, context);
        if (generationResult.error) {
            return { error: generationResult.error };
        }
        if (generationResult.modified) {
            content = generationResult.content;
            modified = true;
        }

        const normalizeResult = this.normalizeScopedFlatPaths(content);
        if (normalizeResult.modified) {
            content = normalizeResult.content;
            modified = true;
        }

        if (modified) {
            const written = tryRun(
                `HyprlandParameterServiceApply.writeConfig.${configPath}`,
                () => GLib.file_set_contents(configPath, content)
            );
            if (!written) {
                return { error: 'failed to write config' };
            }
        }

        return {
            modified,
            overrideCount: overrideResult.count,
            migrations: generationResult.migrations
        };
    }

    readConfigFileContent(configPath) {
        const fileResult = tryOrNull(
            `HyprlandParameterServiceApply.readConfig.${configPath}`,
            () => GLib.file_get_contents(configPath)
        );
        if (!fileResult) {
            return { ok: false, error: 'failed to read config' };
        }

        const [success, contents] = fileResult;
        if (!success) {
            return { ok: false };
        }

        return {
            ok: true,
            content: new TextDecoder().decode(contents)
        };
    }

    generateVersionAwareConfigContent(content, {
        configGenerator,
        migrationOptions,
        migrationService,
        runLegacyMigration,
        targetVersion,
        useObservedState
    }) {
        const emptyMigrations = {
            disabled: [],
            converted: [],
            futureDisabled: [],
            futureConverted: []
        };
        if (!configGenerator?.generateContentForVersion) {
            return { content, modified: false, migrations: emptyMigrations };
        }

        let migrationOptionsForFile = migrationOptions;
        if (runLegacyMigration && useObservedState && migrationService?.scanForLegacyParamsWithState && migrationService?.scanForFutureParamsWithState) {
            const observedOptions = this.buildObservedMigrationOptions(content, migrationService, migrationOptions, targetVersion);
            if (observedOptions.error) {
                return { error: observedOptions.error };
            }
            migrationOptionsForFile = observedOptions.value;
        }

        let generatedResult = { content, migrations: emptyMigrations };
        const generated = tryRun(
            'HyprlandParameterServiceApply.generateVersionAwareConfigContent',
            () => {
                generatedResult = configGenerator.generateContentForVersion(content, {
                    targetVersion,
                    runLegacyMigration,
                    legacyOptions: migrationOptionsForFile,
                    autoMigrate: migrationOptionsForFile.autoMigrate
                }) || generatedResult;
            }
        );
        if (!generated) {
            return { error: 'failed to generate version-aware config' };
        }

        const generatedContent = typeof generatedResult?.content === 'string' ? generatedResult.content : content;
        return {
            content: generatedContent,
            modified: generatedContent !== content,
            migrations: {
                disabled: generatedResult.migrations?.disabled || [],
                converted: generatedResult.migrations?.converted || [],
                futureDisabled: generatedResult.migrations?.futureDisabled || [],
                futureConverted: generatedResult.migrations?.futureConverted || []
            }
        };
    }

    buildObservedMigrationOptions(content, migrationService, migrationOptions, targetVersion) {
        let observedLegacy;
        let observedFuture;
        const scanned = tryRun(
            'HyprlandParameterServiceApply.buildObservedMigrationOptions',
            () => {
                observedLegacy = migrationService.scanForLegacyParamsWithState(content, targetVersion);
                observedFuture = migrationService.scanForFutureParamsWithState(content, targetVersion);
            }
        );
        if (!scanned) {
            return { error: 'failed to scan observed migration state' };
        }

        return {
            value: {
                ...migrationOptions,
                enabledLegacy: this.mergeUnique(
                    migrationOptions.enabledLegacy,
                    (observedLegacy.disabled || []).filter(d => d.userEnabled && d.path).map(d => d.path)
                ),
                revertedConversions: this.mergeUnique(
                    migrationOptions.revertedConversions,
                    (observedLegacy.converted || []).filter(c => c.userReverted && c.oldPath).map(c => c.oldPath)
                ),
                enabledFuture: this.mergeUnique(
                    migrationOptions.enabledFuture,
                    (observedFuture.disabled || []).filter(d => d.userEnabled && d.path).map(d => d.path)
                ),
                revertedFutureConversions: this.mergeUnique(
                    migrationOptions.revertedFutureConversions,
                    (observedFuture.converted || []).filter(c => c.userReverted && c.newPath).map(c => c.newPath)
                )
            }
        };
    }

    mergeUnique(base, extra) {
        return Array.from(new Set([...(base || []), ...(extra || [])]));
    }

    scanConfigMigrations(filePath, migrationService) {
        const fileResult = this.readConfigFileContent(filePath);
        if (!fileResult?.ok) {
            return { legacy: { disabled: [], converted: [] }, future: { disabled: [], converted: [] } };
        }

        let scanResult = null;
        const scanned = tryRun(
            `HyprlandParameterServiceApply.scanConfigMigrations.${filePath}`,
            () => {
                scanResult = {
                    legacy: migrationService.scanForLegacyParamsWithState(fileResult.content),
                    future: migrationService.scanForFutureParamsWithState(fileResult.content)
                };
            }
        );
        return scanned && scanResult
            ? scanResult
            : { legacy: { disabled: [], converted: [] }, future: { disabled: [], converted: [] } };
    }

    findHyprlandConfigs(themePath) {
        let configs = [],
            mainConf = `${themePath}/hyprland.conf`;
        GLib.file_test(mainConf, GLib.FileTest.EXISTS) && configs.push(mainConf);

        let hyprlandDir = `${themePath}/hyprland`;
        if (!GLib.file_test(hyprlandDir, GLib.FileTest.IS_DIR)) return configs;

        let enumerator = tryOrNull(
            'HyprlandParameterServiceApply.findHyprlandConfigs',
            () => Gio.File.new_for_path(hyprlandDir).enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            )
        );
        if (!enumerator) {
            this.log('Error scanning hyprland dir');
            return configs;
        }

        let info;
        while ((info = enumerator.next_file(null))) {
            let name = info.get_name(),
                isConfFile = info.get_file_type() === Gio.FileType.REGULAR && name.endsWith('.conf');
            isConfFile && configs.push(`${hyprlandDir}/${name}`);
        }
        enumerator.close(null);

        return configs;
    }

    applyOverridesToContent(content, overrides) {
        const parseResult = this.configParser.parse(content);
        const lines = content.split('\n');
        let count = 0;

        Object.entries(overrides)
            .filter(([path]) => this.parameters.has(path))
            .forEach(([path, value]) => {
                const paramInfo = parseResult.parameters.get(path);
                if (!paramInfo?.lineNumber) return;

                const lineIndex = paramInfo.lineNumber - 1;
                const rawLine = lines[lineIndex];
                if (typeof rawLine !== 'string') return;

                const newLine = rawLine.replace(
                    /^(\s*[a-zA-Z_][a-zA-Z0-9_:.-]*\s*=\s*)(.*?)(\s*(?:#.*)?)$/,
                    `$1${value}$3`
                );

                if (newLine !== rawLine) {
                    lines[lineIndex] = newLine;
                    count++;
                }
            });

        const result = lines.join('\n');
        return {
            content: result,
            modified: count > 0,
            count
        };
    }

    normalizeScopedFlatPaths(content) {
        const parseResult = this.configParser.parse(content);
        const lines = content.split('\n');
        let count = 0;

        for (const parsed of parseResult.lines || []) {
            if (parsed?.type !== 'parameter' || !parsed?.lineNumber) continue;
            if (!Array.isArray(parsed.sectionPath) || parsed.sectionPath.length === 0) continue;

            const lineIndex = parsed.lineNumber - 1;
            const rawLine = lines[lineIndex];
            if (typeof rawLine !== 'string') continue;

            const match = rawLine.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_:.-]*)(\s*=\s*.*)$/);
            if (!match) continue;

            const [, indent, key, suffix] = match;
            if (!key.includes(':')) continue;

            const sectionPrefix = `${parsed.sectionPath.join(':')}:`;
            if (!key.startsWith(sectionPrefix)) continue;

            const normalizedKey = key.slice(sectionPrefix.length);
            if (!normalizedKey || normalizedKey === key) continue;

            lines[lineIndex] = `${indent}${normalizedKey}${suffix}`;
            count++;
        }

        return {
            content: lines.join('\n'),
            modified: count > 0,
            count
        };
    }

    sanitizeActiveThemeConfigErrors(themePath, options = {}) {
        const {
            maxPasses = 3,
            markerVersion = '999.0.0',
            markerReason = 'runtime_config_error'
        } = options;

        const result = {
            success: true,
            passes: 0,
            fixedLines: 0,
            touchedFiles: [],
            errors: []
        };

        if (!themePath || typeof themePath !== 'string') {
            result.success = false;
            result.errors.push('invalid_theme_path');
            return result;
        }

        const marker = `[LL:FUTURE:disabled:${markerVersion}:${markerReason}]`;
        const touchedFiles = new Set();
        let totalFixed = 0;

        for (let pass = 0; pass < Math.max(1, maxPasses); pass++) {
            result.passes = pass + 1;
            const failingRefs = this.collectThemeConfigErrorRefs(themePath);
            if (failingRefs.size === 0) break;

            let passFixed = 0;
            for (const [filePath, lineNumbers] of failingRefs.entries()) {
                const fileResult = this.sanitizeConfigErrorLines(filePath, lineNumbers, marker);
                if (fileResult?.error) {
                    result.success = false;
                    result.errors.push(`${filePath}: ${fileResult.error}`);
                    continue;
                }

                passFixed += fileResult?.fixedCount || 0;
                if (fileResult?.fileChanged) {
                    touchedFiles.add(filePath);
                }
            }

            totalFixed += passFixed;
            if (passFixed === 0) break;

            tryRun('HyprlandParameterServiceApply.reloadHyprland', () => {
                GLib.spawn_command_line_sync('hyprctl reload');
            });
        }

        result.fixedLines = totalFixed;
        result.touchedFiles = Array.from(touchedFiles);
        return result;
    }

    collectThemeConfigErrorRefs(themePath) {
        const refs = new Map();
        const commandResult = tryOrNull(
            'HyprlandParameterServiceApply.collectThemeConfigErrorRefs.command',
            () => GLib.spawn_command_line_sync('hyprctl -j configerrors')
        );
        const [ok, stdout] = commandResult ?? [];
        if (!ok || !stdout) {
            return refs;
        }

        const parsed = tryOrNull(
            'HyprlandParameterServiceApply.collectThemeConfigErrorRefs.parse',
            () => JSON.parse(new TextDecoder().decode(stdout))
        );
        if (!Array.isArray(parsed)) {
            return refs;
        }

        const normalizePath = (value) => {
            if (typeof value !== 'string' || !value.trim()) return '';
            const raw = value.trim().replace(/^\/{2,}/, '/');
            return (tryOrNull(
                'HyprlandParameterServiceApply.collectThemeConfigErrorRefs.normalizePath',
                () => GLib.canonicalize_filename(raw, null)
            ) || raw).replace(/^\/{2,}/, '/');
        };
        const ensureNoTrailingSlash = (value) => value.replace(/\/+$/, '');

        const normalizedThemeRoot = ensureNoTrailingSlash(normalizePath(themePath));
        const hyprRoots = [
            `${normalizedThemeRoot}/hyprland`,
            `${normalizedThemeRoot}/hypr`
        ].map(normalizePath).map(ensureNoTrailingSlash);
        const hyprlandRootConf = normalizePath(`${normalizedThemeRoot}/hyprland.conf`);

        const isEligibleHyprlandConfigPath = (filePath) => {
            const normalizedFilePath = normalizePath(filePath);
            if (!normalizedFilePath) return false;
            if (normalizedFilePath === hyprlandRootConf) return true;
            if (!normalizedFilePath.endsWith('.conf')) return false;
            return hyprRoots.some((root) =>
                normalizedFilePath === root || normalizedFilePath.startsWith(`${root}/`)
            );
        };

        for (const item of parsed) {
            const text = typeof item === 'string'
                ? item
                : (item && typeof item === 'object' ? JSON.stringify(item) : '');
            if (!text) continue;

            const regex = /Config error in file (.+?) at line (\d+):/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const filePath = (match[1] || '').trim();
                const lineNumber = parseInt(match[2], 10);
                if (!filePath || !Number.isFinite(lineNumber) || lineNumber <= 0) continue;

                if (!isEligibleHyprlandConfigPath(filePath)) continue;

                if (!refs.has(filePath)) refs.set(filePath, new Set());
                refs.get(filePath).add(lineNumber);
            }
        }

        return refs;
    }

    sanitizeConfigErrorLines(filePath, lineNumbers, marker) {
        const fileResult = this.readConfigFileContent(filePath);
        if (!fileResult?.ok) {
            return fileResult?.error ? { error: fileResult.error } : { fixedCount: 0, fileChanged: false };
        }

        const lines = fileResult.content.split('\n');
        const sortedLines = Array.from(lineNumbers).sort((a, b) => a - b);
        let fixedCount = 0;
        let fileChanged = false;

        for (const oneBased of sortedLines) {
            const idx = oneBased - 1;
            if (idx < 0 || idx >= lines.length) {
                continue;
            }

            const trimmed = (lines[idx] ?? '').trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed === '}') {
                continue;
            }

            const lineIndexes = this.isLineOpeningUnsupportedBlock(trimmed)
                ? this.collectBlockIndexes(lines, idx)
                : [idx];

            for (const lineIndex of lineIndexes) {
                const changed = this.commentLineWithMarker(lines, lineIndex, marker);
                if (!changed) {
                    continue;
                }

                fileChanged = true;
                fixedCount++;
            }
        }

        if (fileChanged) {
            const written = tryRun(
                `HyprlandParameterServiceApply.sanitizeConfigErrorLines.${filePath}`,
                () => GLib.file_set_contents(filePath, lines.join('\n'))
            );
            if (!written) {
                return { error: 'failed to write sanitized config' };
            }
        }

        return { fixedCount, fileChanged };
    }

    isLineOpeningUnsupportedBlock(trimmedLine) {
        if (!trimmedLine.endsWith('{')) return false;
        const sectionMatch = trimmedLine.match(/^([a-zA-Z_][a-zA-Z0-9_:-]*)\s*\{$/);
        if (!sectionMatch) return false;
        const sectionName = sectionMatch[1];
        return sectionName === 'layerrule';
    }

    collectBlockIndexes(lines, startIndex) {
        const indexes = [startIndex];
        let depth = 0;
        let started = false;

        for (let i = startIndex; i < lines.length; i++) {
            const text = lines[i] ?? '';
            const trimmed = text.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('#')) continue;

            const openCount = (text.match(/{/g) || []).length;
            const closeCount = (text.match(/}/g) || []).length;

            if (!started) {
                started = true;
                depth = Math.max(1, openCount - closeCount);
                continue;
            }

            indexes.push(i);
            depth += openCount;
            depth -= closeCount;

            if (depth <= 0) break;
        }

        return indexes;
    }

    commentLineWithMarker(lines, index, marker) {
        if (index < 0 || index >= lines.length) return false;
        const current = lines[index] ?? '';
        const trimmed = current.trim();
        if (!trimmed || trimmed.startsWith('#')) return false;
        if (trimmed.includes(marker)) return false;

        const indent = current.match(/^(\s*)/)?.[1] || '';
        lines[index] = `${indent}# ${marker} ${trimmed}`;
        return true;
    }

    processThemeAfterInstall(themePath, settings) {
        this.log(`Processing theme after install: ${themePath}`);
        return this.applyOverridesToConfig(themePath, settings, {
            ignoreGlobalMigrations: true,
            forceAutoMigrate: true,
            useObservedState: false
        });
    }

    async reapplyOverridesToAllThemes(settings) {
        let results = { processed: 0, errors: [] };
        let themes = this.themeRepository ? await this.themeRepository.getLocalThemes() : [];

        for (let theme of themes) {
            let applyResult = this.applyOverridesToConfig(this.getThemeRootPath(theme.name), settings, {
                runLegacyMigration: true
            });
            applyResult?.success
                ? results.processed++
                : results.errors.push({ theme: theme.name, error: applyResult?.errors?.[0]?.error || 'failed to apply overrides' });
        }

        return results;
    }
}

export function applyHyprlandParameterServiceApply(prototype) {
    copyPrototypeDescriptors(prototype, HyprlandParameterServiceApply.prototype);
}
