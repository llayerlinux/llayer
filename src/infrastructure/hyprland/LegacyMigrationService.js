import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { HyprlandConfigParser } from './HyprlandConfigParser.js';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

const HYPRLAND_MIGRATIONS = {
    'gestures:workspace_swipe': {
        version: '0.51.0',
        action: 'removed',
        replacement: 'gesture = 3, horizontal, workspace',
        note: 'New gesture syntax: gesture = fingers, direction, action'
    },
    'gestures:workspace_swipe_fingers': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_min_fingers': { version: '0.51.0', action: 'removed' },

    'animations:first_launch_animation': {
        version: '0.51.0',
        action: 'removed',
        replacement: 'animation = monitorAdded, 1, 5, default',
        note: 'Use monitorAdded animation leaf instead'
    },

    'render:explicit_sync': { version: '0.50.0', action: 'removed', note: 'Always enabled now' },
    'render:explicit_sync_kms': { version: '0.50.0', action: 'removed' },
    'misc:render_ahead_of_time': { version: '0.50.0', action: 'removed' },
    'misc:render_ahead_safezone': { version: '0.50.0', action: 'removed' },

    'opengl:force_introspection': { version: '0.48.0', action: 'removed' },
    'render:allow_early_buffer_release': { version: '0.48.0', action: 'removed' },

    'decoration:drop_shadow': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:enabled'
    },
    'decoration:shadow_range': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:range'
    },
    'decoration:shadow_render_power': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:render_power'
    },
    'decoration:shadow_offset': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:offset'
    },
    'decoration:col.shadow': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:color'
    },
    'decoration:col.shadow_inactive': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:color_inactive'
    },
    'decoration:shadow_ignore_window': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:ignore_window'
    },
    'decoration:shadow_scale': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:scale'
    },

    'decoration:blur': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:enabled'
    },
    'decoration:blur_size': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:size'
    },
    'decoration:blur_passes': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:passes'
    },
    'decoration:blur_new_optimizations': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:new_optimizations'
    },
    'decoration:blur_ignore_opacity': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:ignore_opacity'
    },
    'decoration:blur_xray': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:xray'
    },
    'decoration:blur_noise': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:noise'
    },
    'decoration:blur_contrast': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:contrast'
    },
    'decoration:blur_brightness': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:brightness'
    },
    'decoration:blur_vibrancy': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:vibrancy'
    },
    'decoration:blur_vibrancy_darkness': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:vibrancy_darkness'
    },
    'decoration:blur_special': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:special'
    },
    'decoration:blur_popups': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:popups'
    },
    'decoration:blur_popups_ignorealpha': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:popups_ignorealpha'
    },

    'decoration:multisample_edges': {
        version: '0.31.0',
        action: 'removed',
        note: 'Better algorithm used by default'
    },

    'dwindle:no_gaps_when_only': {
        version: '0.45.0',
        action: 'removed',
        replacement: 'Use workspace rules for smart gaps',
        wikiUrl: 'https://wiki.hyprland.org/Configuring/Workspace-Rules/#smart-gaps'
    },
    'master:no_gaps_when_only': {
        version: '0.45.0',
        action: 'removed',
        replacement: 'Use workspace rules for smart gaps'
    },

    'misc:no_direct_scanout': {
        version: '0.42.0',
        action: 'renamed',
        newPath: 'render:direct_scanout',
        transform: 'invert',
        note: 'Logic inverted: no_direct_scanout=true в†’ direct_scanout=false'
    },

    'cursor:dumb_copy': {
        version: '0.46.0',
        action: 'renamed',
        newPath: 'cursor:use_cpu_buffer'
    },

    'master:new_is_master': { version: '0.44.0', action: 'removed' },
    'master:new_on_top': {
        version: '0.44.0',
        action: 'renamed',
        newPath: 'master:new_on_active'
    },
    'master:always_center_master': {
        version: '0.47.0',
        action: 'renamed',
        newPath: 'master:slave_count_for_center_master',
        transform: 'boolToInt',
        note: 'Now accepts integer'
    },
    'master:center_master_slaves_on_right': {
        version: '0.49.0',
        action: 'renamed',
        newPath: 'master:center_master_fallback'
    },

    'misc:new_window_takes_over_fullscreen': {
        version: '0.53.0',
        action: 'renamed',
        newPath: 'misc:on_focus_under_fullscreen'
    },
    'misc:disable_hyprland_qtutils_check': {
        version: '0.52.0',
        action: 'renamed',
        newPath: 'misc:disable_hyprland_guiutils_check'
    },

    'input:touchpad:workspace_swipe': {
        version: '0.40.0',
        action: 'moved',
        newPath: 'gestures:workspace_swipe',
        note: 'Then removed in 0.51.0'
    },
    'input:touchpad:workspace_swipe_fingers': {
        version: '0.40.0',
        action: 'moved',
        newPath: 'gestures:workspace_swipe_fingers'
    },
    'input:touchpad:workspace_swipe_min_fingers': {
        version: '0.40.0',
        action: 'removed'
    }
};

const HYPRLAND_FUTURE_PARAMS = {
    'gesture': {
        minVersion: '0.51.0',
        action: 'convert',
        oldPaths: ['gestures:workspace_swipe', 'gestures:workspace_swipe_fingers'],
        pattern: /^gesture\s*=\s*(\d+)\s*,\s*(horizontal|vertical|up|down|left|right)\s*,\s*(\w+)/,
        convertFn: (match) => {
            const [, fingers, direction, action] = match;
            if (action === 'workspace' && (direction === 'horizontal' || direction === 'left' || direction === 'right')) {
                return {
                    params: [
                        { path: 'gestures:workspace_swipe', value: 'true' },
                        { path: 'gestures:workspace_swipe_fingers', value: fingers }
                    ]
                };
            }
            return null; // Cannot convert other gestures
        },
        note: 'New gesture syntax introduced in 0.51.0'
    },

    'decoration:shadow:enabled': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:drop_shadow'
    },
    'decoration:shadow:range': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:shadow_range'
    },
    'decoration:shadow:render_power': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:shadow_render_power'
    },
    'decoration:shadow:offset': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:shadow_offset'
    },
    'decoration:shadow:color': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:col.shadow'
    },
    'decoration:shadow:color_inactive': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:col.shadow_inactive'
    },
    'decoration:shadow:ignore_window': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:shadow_ignore_window'
    },
    'decoration:shadow:scale': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:shadow_scale'
    },

    'decoration:blur:enabled': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur'
    },
    'decoration:blur:size': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_size'
    },
    'decoration:blur:passes': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_passes'
    },
    'decoration:blur:new_optimizations': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_new_optimizations'
    },
    'decoration:blur:ignore_opacity': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_ignore_opacity'
    },
    'decoration:blur:xray': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_xray'
    },
    'decoration:blur:noise': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_noise'
    },
    'decoration:blur:contrast': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_contrast'
    },
    'decoration:blur:brightness': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_brightness'
    },
    'decoration:blur:vibrancy': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_vibrancy'
    },
    'decoration:blur:vibrancy_darkness': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_vibrancy_darkness'
    },
    'decoration:blur:special': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_special'
    },
    'decoration:blur:popups': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_popups'
    },
    'decoration:blur:popups_ignorealpha': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_popups_ignorealpha'
    },

    'cursor:use_cpu_buffer': {
        minVersion: '0.46.0',
        action: 'rename',
        oldPath: 'cursor:dumb_copy'
    },

    'master:new_on_active': {
        minVersion: '0.44.0',
        action: 'rename',
        oldPath: 'master:new_on_top'
    },
    'master:slave_count_for_center_master': {
        minVersion: '0.47.0',
        action: 'rename',
        oldPath: 'master:always_center_master',
        transform: 'intToBool'
    },
    'master:center_master_fallback': {
        minVersion: '0.49.0',
        action: 'rename',
        oldPath: 'master:center_master_slaves_on_right'
    },

    'render:direct_scanout': {
        minVersion: '0.42.0',
        action: 'rename',
        oldPath: 'misc:no_direct_scanout',
        transform: 'invert'
    },

    'misc:on_focus_under_fullscreen': {
        minVersion: '0.53.0',
        action: 'rename',
        oldPath: 'misc:new_window_takes_over_fullscreen'
    },
    'misc:disable_hyprland_guiutils_check': {
        minVersion: '0.52.0',
        action: 'rename',
        oldPath: 'misc:disable_hyprland_qtutils_check'
    },

    'ecosystem:no_update_news': {
        minVersion: '0.45.0',
        action: 'disable',
        note: 'ecosystem section not available in older versions'
    },
    'ecosystem:no_donation_nag': {
        minVersion: '0.45.0',
        action: 'disable',
        note: 'ecosystem section not available in older versions'
    },

    'experimental:xx_color_management_v4': {
        minVersion: '0.48.0',
        action: 'disable',
        note: 'experimental color management not available in older versions'
    },

    'render:cm_enabled': {
        minVersion: '0.48.0',
        action: 'disable',
        note: 'Color management not available in older versions'
    },
    'render:cm_fs_passthrough': {
        minVersion: '0.48.0',
        action: 'disable',
        note: 'Color management not available in older versions'
    }
};

const MARKER_PREFIX = '[LL:LEGACY';
const MARKER_DISABLED = `${MARKER_PREFIX}:disabled`;
const MARKER_CONVERTED = `${MARKER_PREFIX}:converted`;
const MARKER_USER_ENABLED = '[LL:USER_ENABLED_LEGACY]';

const MARKER_FUTURE_PREFIX = '[LL:FUTURE';
const MARKER_FUTURE_DISABLED = `${MARKER_FUTURE_PREFIX}:disabled`;
const MARKER_FUTURE_CONVERTED = `${MARKER_FUTURE_PREFIX}:converted`;
const MARKER_USER_ENABLED_FUTURE = '[LL:USER_ENABLED_FUTURE]';

export class LegacyMigrationService {
    constructor(log = () => {}) {
        this.log = log;
        this.parser = new HyprlandConfigParser();
    }

    normalizeFutureConvertedGroups(groups) {
        const minVersion = groups?.[0] ?? '';
        const a = groups?.[1] ?? '';
        const b = groups?.[2] ?? '';

        const asFirstSplit = { minVersion, newPath: a, oldPathPrefix: b };

        const tail = `${a}:${b}`;
        const lastColon = tail.lastIndexOf(':');
        const asLastSplit = lastColon !== -1
            ? { minVersion, newPath: tail.slice(0, lastColon), oldPathPrefix: tail.slice(lastColon + 1) }
            : asFirstSplit;

        const hasFirst = !!HYPRLAND_FUTURE_PARAMS[asFirstSplit.newPath];
        const hasLast = !!HYPRLAND_FUTURE_PARAMS[asLastSplit.newPath];

        const normalized = hasLast && !hasFirst ? asLastSplit : asFirstSplit;
        const migration = HYPRLAND_FUTURE_PARAMS[normalized.newPath];
        if (migration?.oldPaths?.length) {
            return {
                ...normalized,
                oldPathPrefix: migration.oldPaths.join(',')
            };
        }

        return normalized;
    }

    stripUserEnabledFutureMarker(line) {
        return String(line || '')
            .replace(/\s+#\s*\[LL:USER_ENABLED_FUTURE\]\s*$/, '')
            .replace(/\s+\[LL:USER_ENABLED_FUTURE\]\s*$/, '');
    }

    detectSectionContext(lines, targetIndex) {
        const sectionStack = [];

        for (let i = 0; i <= targetIndex; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('#')) continue;

            const sectionMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_:-]*)\s*\{/);
            if (sectionMatch) {
                sectionStack.push(sectionMatch[1]);
            }

            if (trimmed.includes('}')) {
                const openCount = (trimmed.match(/\{/g) || []).length;
                const closeCount = (trimmed.match(/\}/g) || []).length;
                for (let j = 0; j < closeCount - openCount; j++) {
                    sectionStack.pop();
                }
            }
        }

        return sectionStack.join(':');
    }

    parseFutureConvertedOldPathSpec(oldPathPrefix) {
        if (!oldPathPrefix) return { list: null, prefix: '' };
        if (oldPathPrefix.includes(',')) {
            const list = oldPathPrefix.split(',').map(p => p.trim()).filter(Boolean);
            return { list, prefix: '' };
        }
        return { list: null, prefix: oldPathPrefix };
    }

    collectConvertedBlockParams(parseResult, markerIndex, oldPathPrefix) {
        const collected = [];
        const spec = this.parseFutureConvertedOldPathSpec(oldPathPrefix);
        const matchPath = (paramPath) => {
            if (!paramPath) return false;
            if (spec.list) return spec.list.includes(paramPath);
            return typeof paramPath === 'string' && paramPath.startsWith(spec.prefix);
        };

        for (let j = markerIndex + 1; j < parseResult.lines.length; j++) {
            const nextLine = parseResult.lines[j];
            if (!nextLine) break;

            if (nextLine.marker?.type === 'FUTURE_CONVERTED' || nextLine.marker?.type === 'LEGACY_CONVERTED') break;

            if (nextLine.type !== 'parameter') continue;

            if (matchPath(nextLine.paramPath)) collected.push(nextLine);
        }

        return collected;
    }

    getMigrations() {
        return HYPRLAND_MIGRATIONS;
    }

    scanForLegacyParams(content, userVersion = null) {
        const found = [];
        const parseResult = this.parser.parse(content);
        const futureConvertedPaths = new Set();
        const resolvedVersion = userVersion || this.getCachedHyprlandVersion();

        for (let i = 0; i < parseResult.lines.length; i++) {
            const line = parseResult.lines[i];
            if (line.marker?.type !== 'FUTURE_CONVERTED') continue;
            const { oldPathPrefix } = this.normalizeFutureConvertedGroups(line.marker.groups);
            const blockParams = this.collectConvertedBlockParams(parseResult, i, oldPathPrefix);
            for (const p of blockParams) {
                futureConvertedPaths.add(p.paramPath);
            }
        }

        for (const line of parseResult.lines) {
            if (line.type !== 'parameter') continue;
            if (futureConvertedPaths.has(line.paramPath)) continue;

            if (line.isDisabled && !line.isUserEnabled) continue;

            const migration = HYPRLAND_MIGRATIONS[line.paramPath];
            if (migration && this.isVersionSupported(resolvedVersion, migration.version)) {
                found.push({
                    path: line.paramPath,
                    value: line.paramValue,
                    lineNumber: line.lineNumber,
                    migration: migration,
                    isUserEnabled: line.isUserEnabled || false
                });
            }
        }

        return found;
    }

    scanForLegacyParamsWithState(content, userVersion = null) {
        const resolvedVersion = userVersion || this.getCachedHyprlandVersion();
        const base = this.scanForMigratedParams(content, resolvedVersion);
        const disabled = [...(base.disabled || [])];
        const converted = [...(base.converted || [])];
        const disabledPaths = new Set(disabled.map(d => d.path));
        const convertedOldPaths = new Set(converted.map(c => c.oldPath));

        const parseResult = this.parser.parse(content);
        const futureConvertedPaths = new Set();
        for (let i = 0; i < parseResult.lines.length; i++) {
            const line = parseResult.lines[i];
            if (line.marker?.type !== 'FUTURE_CONVERTED') continue;
            const { oldPathPrefix } = this.normalizeFutureConvertedGroups(line.marker.groups);
            const blockParams = this.collectConvertedBlockParams(parseResult, i, oldPathPrefix);
            for (const p of blockParams) {
                futureConvertedPaths.add(p.paramPath);
            }
        }

        const rawParams = this.scanForLegacyParams(content, resolvedVersion);
        for (const param of rawParams) {
            if (futureConvertedPaths.has(param.path)) continue;
            const migration = param.migration;
            if (!migration) continue;

            switch (migration.action) {
                case 'moved':
                case 'renamed': {
                    if (convertedOldPaths.has(param.path)) continue;
                    const newValue = this.transformValue(param.value, migration.transform);
                    converted.push({
                        oldPath: param.path,
                        newPath: migration.newPath,
                        oldValue: param.value,
                        newValue: newValue,
                        version: migration.version,
                        lineNumber: param.lineNumber,
                        userReverted: false
                    });
                    break;
                }

                default:
                    if (disabledPaths.has(param.path)) continue;
                    disabled.push({
                        path: param.path,
                        value: param.value,
                        version: migration.version,
                        reason: migration.action,
                        lineNumber: param.lineNumber,
                        userEnabled: false
                    });
                    break;
            }
        }

        return { disabled, converted };
    }

    scanForMigratedParams(content, userVersion = null) {
        const disabled = [];
        const converted = [];
        const parseResult = this.parser.parse(content);
        const resolvedVersion = userVersion || this.getCachedHyprlandVersion();

        const futureConvertedPaths = new Set();
        for (let i = 0; i < parseResult.lines.length; i++) {
            const line = parseResult.lines[i];
            if (line.marker?.type === 'FUTURE_CONVERTED') {
                const { oldPathPrefix } = this.normalizeFutureConvertedGroups(line.marker.groups);
                const blockParams = this.collectConvertedBlockParams(parseResult, i, oldPathPrefix);
                for (const p of blockParams) futureConvertedPaths.add(p.paramPath);
            }
        }

        for (const line of parseResult.lines) {
            if (line.type === 'parameter' && futureConvertedPaths.has(line.paramPath)) {
                continue;
            }

            if (line.type === 'parameter' && line.marker?.type === 'LEGACY_DISABLED') {
                const [version, reason] = line.marker.groups;
                if (!this.isVersionSupported(resolvedVersion, version)) continue;
                disabled.push({
                    path: line.paramPath,
                    value: line.paramValue,
                    version,
                    reason,
                    lineNumber: line.lineNumber,
                    userEnabled: false
                });
                continue;
            }

            if (line.type === 'parameter' && line.marker?.type === 'LEGACY_USER_ENABLED') {
                const migration = HYPRLAND_MIGRATIONS[line.paramPath];
                if (migration && this.isVersionSupported(resolvedVersion, migration.version)) {
                    disabled.push({
                        path: line.paramPath,
                        value: line.paramValue,
                        version: migration.version,
                        reason: migration.action,
                        lineNumber: line.lineNumber,
                        userEnabled: true
                    });
                }
                continue;
            }

            if (line.marker?.type === 'LEGACY_CONVERTED') {
                const [version, oldPath] = line.marker.groups;
                if (!this.isVersionSupported(resolvedVersion, version)) continue;
                const lineIndex = parseResult.lines.indexOf(line);
                for (let j = lineIndex + 1; j < parseResult.lines.length && j < lineIndex + 5; j++) {
                    const nextLine = parseResult.lines[j];
                    if (nextLine && nextLine.type === 'parameter' && !nextLine.isDisabled) {
                        converted.push({
                            oldPath: oldPath,
                            newPath: nextLine.paramPath,
                            newValue: nextLine.paramValue,
                            version,
                            lineNumber: line.lineNumber,
                            userReverted: false
                        });
                        break;
                    }
                }
            }
        }

        return { disabled, converted };
    }

    migrateConfig(content, options = {}) {
        const {
            autoMigrate = true,
            enabledLegacy = [],
            revertedConversions = [],
            targetVersion = null
        } = options;

        if (!autoMigrate) {
            return { content, migrations: { disabled: [], converted: [] } };
        }

        let result = content;
        const disabled = [];
        const converted = [];

        const legacyParams = this.scanForLegacyParams(result, targetVersion);

        for (const param of legacyParams) {
            const { path, value, lineNumber, migration, isUserEnabled } = param;

            if (isUserEnabled && !enabledLegacy.includes(path)) {
                result = this.disableLegacyParam(result, path);
                disabled.push({
                    path,
                    value,
                    version: migration.version,
                    reason: migration.action || 'removed',
                    lineNumber,
                    userEnabled: false
                });
                continue;
            }

            if (isUserEnabled && enabledLegacy.includes(path)) {
                continue;
            }

            if (enabledLegacy.includes(path)) {
                continue;
            }

            if (revertedConversions.includes(path)) {
                continue;
            }

            if (migration.action === 'removed') {
                result = this.commentLegacyParam(result, path, value, migration);
                disabled.push({
                    path,
                    value,
                    version: migration.version,
                    reason: 'removed',
                    lineNumber,
                    userEnabled: false
                });
            } else {
                switch (migration.action) {
                    case 'moved':
                    case 'renamed': {
                        const newValue = this.transformValue(value, migration.transform);
                        result = this.convertLegacyParam(result, path, migration.newPath, value, newValue, migration);
                        converted.push({
                            oldPath: path,
                            newPath: migration.newPath,
                            oldValue: value,
                            newValue: newValue,
                            version: migration.version,
                            lineNumber,
                            userReverted: false
                        });
                        break;
                    }
                }
            }
        }

        for (const paramPath of enabledLegacy) {
            result = this.enableLegacyParam(result, paramPath);
        }

        for (const oldPath of revertedConversions) {
            const migration = this.getMigrationForPath(oldPath);
            if (migration && migration.newPath) {
                result = this.revertConversion(result, oldPath, migration.newPath);
            }
        }

        return {
            content: result,
            migrations: { disabled, converted }
        };
    }

    commentLegacyParam(content, paramPath, value, migration) {
        const reason = migration.note ? 'removed' : 'removed';
        const marker = `# ${MARKER_DISABLED}:${migration.version}:${reason}]`;
        return this.parser.commentParameter(content, paramPath, marker);
    }

    convertLegacyParam(content, oldPath, newPath, oldValue, newValue, migration) {
        const marker = `# ${MARKER_CONVERTED}:${migration.version}:${oldPath}]`;
        const parseResult = this.parser.parse(content);
        const existing = parseResult.lines.find(l =>
            l.type === 'parameter' && l.paramPath === oldPath && !l.isDisabled
        );

        if (!existing) return content;

        const lines = content.split('\n');
        const lineIndex = existing.lineNumber - 1;
        const indent = existing.indent || '';

        const newPathParts = newPath.split(':');
        const newParamName = existing.sectionPath.length > 0 ? newPathParts.pop() : newPath;

        lines[lineIndex] = `${indent}${marker}\n${indent}${newParamName} = ${newValue}`;
        return lines.join('\n');
    }

    enableLegacyParam(content, paramPath) {
        return this.parser.uncommentParameter(content, paramPath, MARKER_USER_ENABLED);
    }

    disableLegacyParam(content, paramPath) {
        const migration = HYPRLAND_MIGRATIONS[paramPath];
        if (!migration) return content;

        const reason = migration.action || 'removed';
        const marker = `# ${MARKER_DISABLED}:${migration.version}:${reason}]`;

        const parseResult = this.parser.parse(content);
        const existing = parseResult.lines.find(l =>
            l.type === 'parameter' &&
            l.paramPath === paramPath &&
            l.isUserEnabled &&
            l.marker?.type === 'LEGACY_USER_ENABLED'
        );

        if (!existing) return content;

        const lines = content.split('\n');
        const lineIndex = existing.lineNumber - 1;
        const indent = existing.indent || '';

        const paramName = existing.sectionPath.length > 0 ? existing.paramName : existing.paramPath;
        lines[lineIndex] = `${indent}${marker} ${paramName} = ${existing.paramValue}`;

        return lines.join('\n');
    }

    revertConversion(content, oldPath, newPath) {
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = line.replace(/\r$/, '');
            const markerRegex = new RegExp(`^(\\s*)#\\s*\\[LL:LEGACY:converted:[^:]+:${this.escapeRegex(oldPath)}\\]$`);

            if (markerRegex.test(cleanLine)) {
                const indent = cleanLine.match(/^(\s*)/)[1];
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].replace(/\r$/, '');
                    const valueMatch = nextLine.match(new RegExp(`^\\s*${this.escapeRegex(newPath)}\\s*=\\s*(.+?)(?:\\s*#.*)?$`));
                    if (valueMatch) {
                        const value = valueMatch[1].trim();
                        lines[i] = `${indent}${oldPath} = ${value}  # ${MARKER_USER_ENABLED}`;
                        lines.splice(i + 1, 1); // Remove the new param line
                        break;
                    }
                }
            }
        }

        return lines.join('\n');
    }

    transformValue(value, transform) {
        if (!transform) return value;

        switch (transform) {
            case 'invert':
                if (value === 'true' || value === 'yes' || value === '1') return 'false';
                if (value === 'false' || value === 'no' || value === '0') return 'true';
                return value;

            case 'boolToInt':
                if (value === 'true' || value === 'yes') return '1';
                if (value === 'false' || value === 'no') return '0';
                return value;

            default:
                return value;
        }
    }

    readMigrations(themePath) {
        const metaPath = `${themePath}/.legacy-migrations.json`;
        return tryOrDefault('LegacyMigrationService.readMigrations', () => {
            const file = Gio.File.new_for_path(metaPath);
            if (!file.query_exists(null)) {
                return null;
            }
            const [ok, contents] = GLib.file_get_contents(metaPath);
            if (ok) {
                return JSON.parse(new TextDecoder().decode(contents));
            }
            return null;
        }, null);
    }

    writeMigrations(themePath, migrations) {
        const metaPath = `${themePath}/.legacy-migrations.json`;
        return tryRun('LegacyMigrationService.writeMigrations', () => {
            const data = {
                migrationVersion: new Date().toISOString().split('T')[0],
                hyprlandVersion: this.getHyprlandVersion(),
                ...migrations
            };
            GLib.file_set_contents(metaPath, JSON.stringify(data, null, 2));
        });
    }

    getHyprlandVersion() {
        const directVersion = this.extractHyprlandVersionFromJsonCommand(['hyprctl', 'version', '-j']);
        if (directVersion !== 'unknown') {
            return directVersion;
        }

        const instanceVersion = this.getHyprlandVersionFromInstances();
        if (instanceVersion !== 'unknown') {
            return instanceVersion;
        }

        for (const command of [['Hyprland', '--version'], ['Hyprland', '-v']]) {
            const version = this.extractHyprlandVersionFromBinary(command);
            if (version !== 'unknown') {
                return version;
            }
        }

        return 'unknown';
    }

    extractHyprlandVersionFromJsonCommand(argv, envv = null) {
        return tryOrDefault('LegacyMigrationService.extractHyprlandVersionFromJsonCommand', () => {
            const [ok, stdout] = GLib.spawn_sync(
                null,
                argv,
                envv || GLib.get_environ(),
                GLib.SpawnFlags.SEARCH_PATH,
                null
            );
            if (!ok || !stdout) return 'unknown';
            const data = JSON.parse(new TextDecoder().decode(stdout));
            return data?.version || 'unknown';
        }, 'unknown');
    }

    getHyprlandVersionFromInstances() {
        return tryOrDefault('LegacyMigrationService.getHyprlandVersionFromInstances', () => {
            const [instancesOk, instancesStdout] = GLib.spawn_command_line_sync('hyprctl instances -j');
            if (!instancesOk || !instancesStdout) {
                return 'unknown';
            }

            const instances = JSON.parse(new TextDecoder().decode(instancesStdout));
            if (!Array.isArray(instances) || instances.length === 0) {
                return 'unknown';
            }

            const [instance] = instances;
            const runtimeDir = GLib.getenv('XDG_RUNTIME_DIR')
                || GLib.get_user_runtime_dir?.()
                || '/run/user/1000';
            let envv = GLib.get_environ();
            envv = GLib.environ_setenv(envv, 'XDG_RUNTIME_DIR', runtimeDir, true);

            if (typeof instance?.instance === 'string' && instance.instance.length > 0) {
                envv = GLib.environ_setenv(envv, 'HYPRLAND_INSTANCE_SIGNATURE', instance.instance, true);
            }
            if (typeof instance?.wl_socket === 'string' && instance.wl_socket.length > 0) {
                envv = GLib.environ_setenv(envv, 'WAYLAND_DISPLAY', instance.wl_socket, true);
            }
            if (!GLib.getenv('DBUS_SESSION_BUS_ADDRESS')) {
                envv = GLib.environ_setenv(envv, 'DBUS_SESSION_BUS_ADDRESS', `unix:path=${runtimeDir}/bus`, true);
            }

            return this.extractHyprlandVersionFromJsonCommand(['hyprctl', 'version', '-j'], envv);
        }, 'unknown');
    }

    extractHyprlandVersionFromBinary(command) {
        return tryOrDefault('LegacyMigrationService.extractHyprlandVersionFromBinary', () => {
            const [ok, stdout] = GLib.spawn_sync(
                null,
                command,
                GLib.get_environ(),
                GLib.SpawnFlags.SEARCH_PATH,
                null
            );
            if (!ok || !stdout) {
                return 'unknown';
            }

            const text = new TextDecoder().decode(stdout);
            const match = text.match(/\b(\d+\.\d+\.\d+)\b/);
            return match?.[1] || 'unknown';
        }, 'unknown');
    }

    findHyprlandConfigs(themePath) {
        const configs = [];

        const mainConf = `${themePath}/hyprland.conf`;
        const mainFile = Gio.File.new_for_path(mainConf);
        if (mainFile.query_exists(null)) {
            configs.push(mainConf);
        }

        const hyprDir = `${themePath}/hyprland`;
        tryOrDefault('LegacyMigrationService.findHyprlandConfigs', () => {
            const dir = Gio.File.new_for_path(hyprDir);
            if (dir.query_exists(null)) {
                const enumerator = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
                let info;
                while ((info = enumerator.next_file(null))) {
                    if (info.get_file_type() === Gio.FileType.REGULAR) {
                        const name = info.get_name();
                        if (name.endsWith('.conf')) {
                            configs.push(`${hyprDir}/${name}`);
                        }
                    }
                }
            }
            return true;
        }, false);

        return configs;
    }

    addParamsWithFileInfo(result, params, configPath) {
        const fileName = configPath.split('/').pop();
        for (const group of ['disabled', 'converted']) {
            for (const param of params[group]) {
                param.file = fileName;
                result[group].push(param);
            }
        }
    }

    scanThemeConfigFiles(configFiles, context, scanFn) {
        const result = { disabled: [], converted: [] };
        for (const configPath of configFiles) {
            const params = tryOrDefault(context, () => {
                const [ok, contents] = GLib.file_get_contents(configPath);
                return ok ? scanFn.call(this, new TextDecoder().decode(contents)) : null;
            }, null);
            params && this.addParamsWithFileInfo(result, params, configPath);
        }
        return result;
    }

    listThemeEntries(themesDir, context) {
        return tryOrDefault(context, () => {
            const themes = [];
            const dir = Gio.File.new_for_path(themesDir);
            const enumerator = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);

            let info;
            while ((info = enumerator.next_file(null))) {
                if (info.get_file_type() !== Gio.FileType.DIRECTORY) continue;
                const themeName = info.get_name();
                themes.push({ themeName, themePath: `${themesDir}/${themeName}` });
            }

            return themes;
        }, null);
    }

    mergeThemeParams(resultMap, params, themeName, keySelector) {
        for (const param of params) {
            const key = keySelector(param);
            if (!resultMap.has(key)) {
                resultMap.set(key, { ...param, themes: [] });
            }
            resultMap.get(key).themes.push(themeName);
        }
    }

    getLegacyParamsForTheme(themePath) {
        const configFiles = this.findHyprlandConfigs(themePath);
        return this.scanThemeConfigFiles(
            configFiles,
            'LegacyMigrationService.getLegacyParamsForTheme',
            this.scanForLegacyParamsWithState
        );
    }

    getAllLegacyParams(themesDir) {
        const result = { disabled: new Map(), converted: new Map() };
        const themes = this.listThemeEntries(themesDir, 'LegacyMigrationService.getAllLegacyParams');
        if (!themes) {
            this.log('Error scanning themes');
        } else {
            for (const { themeName, themePath } of themes) {
                const themeParams = this.getLegacyParamsForTheme(themePath);
                this.mergeThemeParams(result.disabled, themeParams.disabled, themeName, param => param.path);
                this.mergeThemeParams(result.converted, themeParams.converted, themeName, param => param.oldPath);
            }
        }

        return {
            disabled: Array.from(result.disabled.values()),
            converted: Array.from(result.converted.values())
        };
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getMigrationForPath(paramPath) {
        return HYPRLAND_MIGRATIONS[paramPath] || null;
    }


    getFutureMigrations() {
        return HYPRLAND_FUTURE_PARAMS;
    }

    parseVersion(versionStr) {
        if (!versionStr || versionStr === 'unknown') return [0, 0, 0];
        const clean = versionStr.replace(/^v/, '').split('-')[0];
        const parts = clean.split('.').map(p => parseInt(p, 10) || 0);
        return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
    }

    compareVersions(a, b) {
        const va = this.parseVersion(a);
        const vb = this.parseVersion(b);
        for (let i = 0; i < 3; i++) {
            if (va[i] !== vb[i]) return va[i] - vb[i];
        }
        return 0;
    }

    isVersionSupported(userVersion, minVersion) {
        return this.compareVersions(userVersion, minVersion) >= 0;
    }

    getCachedHyprlandVersion() {
        if (!this._cachedVersion) {
            this._cachedVersion = this.getHyprlandVersion();
        }
        return this._cachedVersion;
    }

    scanForFutureParams(content, userVersion = null) {
        const version = userVersion || this.getCachedHyprlandVersion();
        const found = [];
        const parseResult = this.parser.parse(content);

        for (const line of parseResult.lines) {
            if (line.marker?.type === 'FUTURE_CONVERTED') continue;

            if (line.isDisabled && !line.isUserEnabled) continue;

            const lineText = typeof line.trimmed === 'string'
                ? line.trimmed
                : (typeof line.raw === 'string' ? line.raw.trim() : '');

            if (line.type === 'parameter' || line.type === 'other') {
                for (const [paramName, migration] of Object.entries(HYPRLAND_FUTURE_PARAMS)) {
                    if (migration.pattern) {
                        const match = lineText.match(migration.pattern);
                        if (match && !this.isVersionSupported(version, migration.minVersion)) {
                            found.push({
                                path: paramName,
                                value: lineText.split('=')[1]?.trim() || '',
                                fullLine: lineText,
                                lineNumber: line.lineNumber,
                                migration: migration,
                                patternMatch: match,
                                isUserEnabled: line.isUserEnabled || false
                            });
                        }
                    }
                }
            }

            if (line.type !== 'parameter') continue;

            const migration = HYPRLAND_FUTURE_PARAMS[line.paramPath];
            if (migration && !migration.pattern && !this.isVersionSupported(version, migration.minVersion)) {
                found.push({
                    path: line.paramPath,
                    value: line.paramValue,
                    lineNumber: line.lineNumber,
                    migration: migration,
                    isUserEnabled: line.isUserEnabled || false
                });
            }
        }

        return found;
    }

    scanForFutureParamsWithState(content, userVersion = null) {
        const resolvedVersion = userVersion || this.getCachedHyprlandVersion();
        const base = this.scanForMigratedFutureParams(content, resolvedVersion);
        const disabled = [...(base.disabled || [])];
        const converted = [...(base.converted || [])];
        const disabledPaths = new Set(disabled.map(d => d.path));
        const convertedNewPaths = new Set(converted.map(c => c.newPath).filter(Boolean));

        const rawParams = this.scanForFutureParams(content, resolvedVersion);
        for (const param of rawParams) {
            const migration = param.migration;
            if (!migration) continue;

            switch (migration.action) {
                case 'disable':
                    if (disabledPaths.has(param.path)) continue;
                    disabled.push({
                        path: param.path,
                        value: param.value,
                        minVersion: migration.minVersion,
                        reason: migration.note || migration.action,
                        lineNumber: param.lineNumber,
                        userEnabled: false
                    });
                    continue;

                case 'rename':
                    if (convertedNewPaths.has(param.path)) continue;
                    converted.push({
                        newPath: param.path,
                        oldPath: migration.oldPath,
                        oldValue: this.transformValueReverse(param.value, migration.transform),
                        newValue: param.value,
                        minVersion: migration.minVersion,
                        lineNumber: param.lineNumber,
                        userReverted: false,
                        isReverted: false
                    });
                    continue;

                case 'convert': {
                    if (convertedNewPaths.has(param.path)) continue;
                    const convertResult = param.patternMatch ? migration.convertFn?.(param.patternMatch) : null;
                    if (convertResult && Array.isArray(convertResult.params)) {
                        for (const p of convertResult.params) {
                            converted.push({
                                newPath: param.path,
                                oldPath: p.path,
                                oldValue: p.value,
                                newValue: param.value,
                                minVersion: migration.minVersion,
                                lineNumber: param.lineNumber,
                                userReverted: false,
                                isReverted: false
                            });
                        }
                        continue;
                    }

                    if (disabledPaths.has(param.path)) continue;
                    disabled.push({
                        path: param.path,
                        value: param.value,
                        minVersion: migration.minVersion,
                        reason: 'cannot convert',
                        lineNumber: param.lineNumber,
                        userEnabled: false
                    });
                    continue;
                }
            }
        }

        return { disabled, converted };
    }

    scanForMigratedFutureParams(content, _userVersion = null) {
        const disabled = [];
        const converted = [];
        const parseResult = this.parser.parse(content);
        const forcedEnabled = new Set();

        for (const line of parseResult.lines) {
            if (line.type === 'parameter' && line.marker?.type === 'FUTURE_DISABLED') {
                const [minVersion, reason] = line.marker.groups;
                disabled.push({
                    path: line.paramPath,
                    value: line.paramValue,
                    minVersion,
                    reason,
                    lineNumber: line.lineNumber,
                    userEnabled: false
                });
                continue;
            }

            if (line.type === 'parameter' && line.marker?.type === 'FUTURE_USER_ENABLED') {
                const migration = HYPRLAND_FUTURE_PARAMS[line.paramPath];
                switch (migration?.action) {
                    case 'disable':
                        disabled.push({
                            path: line.paramPath,
                            value: line.paramValue,
                            minVersion: migration.minVersion,
                            reason: migration.note || migration.action,
                            lineNumber: line.lineNumber,
                            userEnabled: true
                        });
                        break;

                    case undefined:
                        break;

                    default:
                        forcedEnabled.add(line.paramPath);
                        break;
                }
            }
        }

        for (const line of parseResult.lines) {
            if (line.marker?.type !== 'FUTURE_CONVERTED') continue;
            const { minVersion, newPath, oldPathPrefix } = this.normalizeFutureConvertedGroups(line.marker.groups);
            const markerIndex = parseResult.lines.indexOf(line);
            const blockParams = this.collectConvertedBlockParams(parseResult, markerIndex, oldPathPrefix);
            const isForced = forcedEnabled.has(newPath);
            for (const p of blockParams) {
                const hasDisabledMarker = p.marker?.type === 'LEGACY_DISABLED' || p.marker?.type === 'FUTURE_DISABLED';
                converted.push({
                    newPath,
                    oldPath: p.paramPath,
                    oldValue: p.paramValue,
                    newValue: null,
                    minVersion,
                    lineNumber: p.lineNumber,
                    userReverted: isForced,
                    isReverted: false,
                    legacyDisabled: hasDisabledMarker
                });
            }
        }

        return { disabled, converted };
    }

    migrateConfigFuture(content, options = {}) {
        const {
            autoMigrate = true,
            enabledFuture = [],
            revertedFutureConversions = [],
            targetVersion = null
        } = options;

        if (!autoMigrate) {
            return { content, futureMigrations: { disabled: [], converted: [] } };
        }

        let result = content;
        const disabled = [];
        const converted = [];
        const userVersion = targetVersion || this.getCachedHyprlandVersion();

        const futureParams = this.scanForFutureParams(result, userVersion);

        for (const param of futureParams) {
            const { path, value, migration, isUserEnabled, patternMatch, fullLine } = param;

            if (isUserEnabled && enabledFuture.includes(path)) {
                continue;
            }

            if (enabledFuture.includes(path)) {
                continue;
            }

            switch (migration.action) {
                case 'disable':
                    result = this.commentFutureParam(result, path, fullLine || `${path} = ${value}`, migration);
                    disabled.push({
                        path,
                        value,
                        minVersion: migration.minVersion,
                        reason: migration.note || 'not available',
                        userEnabled: false
                    });
                    break;

                case 'rename': {
                    const oldValue = this.transformValueReverse(value, migration.transform);
                    result = this.convertFutureParam(result, path, migration.oldPath, value, oldValue, migration);
                    converted.push({
                        newPath: path,
                        oldPath: migration.oldPath,
                        newValue: value,
                        oldValue: oldValue,
                        minVersion: migration.minVersion,
                        userReverted: false
                    });
                    break;
                }

                case 'convert': {
                    const convertResult = patternMatch ? migration.convertFn?.(patternMatch) : null;
                    if (convertResult) {
                        result = this.convertFutureParamSpecial(result, fullLine, convertResult.params, migration);
                        converted.push({
                            newPath: path,
                            oldPath: convertResult.params.map(p => p.path).join(', '),
                            newValue: value,
                            oldValue: convertResult.params.map(p => `${p.path}=${p.value}`).join('; '),
                            minVersion: migration.minVersion,
                            userReverted: false
                        });
                        break;
                    }

                    result = this.commentFutureParam(result, path, fullLine, migration);
                    disabled.push({
                        path,
                        value,
                        minVersion: migration.minVersion,
                        reason: 'cannot convert',
                        userEnabled: false
                    });
                    break;
                }
            }
        }

        for (const paramPath of enabledFuture) {
            result = this.enableFutureParam(result, paramPath);
        }

        for (const newPath of revertedFutureConversions) {
            result = this.revertFutureConversion(result, newPath);
        }

        result = this.reconcileFutureUserEnabledLines(result, enabledFuture, revertedFutureConversions);

        result = this.cleanupFutureConvertedDuplicates(result);
        result = this.enforceFutureConvertedState(result, revertedFutureConversions, userVersion);

        return {
            content: result,
            futureMigrations: { disabled, converted }
        };
    }

    commentFutureParam(content, paramPath, fullLine, migration) {
        const reason = migration.note || 'not available';
        const marker = `# ${MARKER_FUTURE_DISABLED}:${migration.minVersion}:${reason}]`;

        if (migration.pattern && fullLine) {
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() === fullLine.trim()) {
                    const indent = lines[i].match(/^(\s*)/)[1];
                    lines[i] = `${indent}${marker} ${lines[i].trim()}`;
                    return lines.join('\n');
                }
            }
            return content;
        }

        return this.parser.commentParameter(content, paramPath, marker);
    }

    convertFutureParam(content, newPath, oldPath, newValue, oldValue, migration) {
        const marker = `# ${MARKER_FUTURE_CONVERTED}:${migration.minVersion}:${newPath}=>${oldPath}]`;
        const parseResult = this.parser.parse(content);
        const markerIndexes = [];

        for (let i = 0; i < parseResult.lines.length; i++) {
            const line = parseResult.lines[i];
            if (line.marker?.type !== 'FUTURE_CONVERTED') continue;
            const normalized = this.normalizeFutureConvertedGroups(line.marker.groups);
            if (normalized.newPath === newPath) {
                markerIndexes.push(i);
            }
        }

        if (markerIndexes.length > 0) {
            let updated = content;
            const cleaned = this.cleanupFutureConvertedDuplicates(updated, newPath);
            if (cleaned !== updated) {
                updated = cleaned;
            }

            const cleanedParse = this.parser.parse(updated);
            const markerLine = cleanedParse.lines.find(l =>
                l.marker?.type === 'FUTURE_CONVERTED' &&
                this.normalizeFutureConvertedGroups(l.marker.groups).newPath === newPath
            );
            if (!markerLine) return updated;

            const contentLines = updated.split('\n');
            const removeIndexes = new Set();

            for (const line of cleanedParse.lines) {
                if (line.type === 'parameter' && line.paramPath === oldPath) {
                    removeIndexes.add(line.lineNumber - 1);
                }
                if (line.type === 'parameter' && line.paramPath === newPath) {
                    removeIndexes.add(line.lineNumber - 1);
                }
            }

            const filtered = contentLines.filter((_, idx) => !removeIndexes.has(idx));
            const filteredParse = this.parser.parse(filtered.join('\n'));
            const refreshedMarker = filteredParse.lines.find(l =>
                l.marker?.type === 'FUTURE_CONVERTED' &&
                this.normalizeFutureConvertedGroups(l.marker.groups).newPath === newPath
            );
            if (!refreshedMarker) return filtered.join('\n');

            const markerLineIndex = refreshedMarker.lineNumber - 1;
            const indent = refreshedMarker.indent || '';
            const markerRaw = filtered[markerLineIndex] || '';
            const afterBracket = markerRaw.includes(']') ? markerRaw.split(']').slice(1).join(']').trim() : '';
            const markerParamName = afterBracket.includes('=') ? afterBracket.split('=')[0].trim() : newPath;

            filtered[markerLineIndex] = `${indent}${marker} ${markerParamName} = ${newValue}`;
            filtered.splice(markerLineIndex + 1, 0, `${indent}${oldPath} = ${oldValue}`);

            return this.enableFutureConvertedParams(filtered.join('\n'), newPath);
        }

        const existing = parseResult.lines.find(l =>
            l.type === 'parameter' && l.paramPath === newPath && !l.isDisabled
        );

        if (!existing) return content;

        const lines = content.split('\n');
        const lineIndex = existing.lineNumber - 1;
        const indent = existing.indent || '';

        let oldParamToWrite = oldPath;
        if (existing.sectionPath.length > 0) {
            const oldPathParts = oldPath.split(':');
            const existingSectionStr = existing.sectionPath.join(':');
            if (oldPath.startsWith(existingSectionStr + ':')) {
                oldParamToWrite = oldPathParts.pop();
            } else {
                oldParamToWrite = oldPath;
            }
        }

        const newParamToWrite = existing.sectionPath.length > 0 ? existing.paramName : existing.paramPath;
        const cleanedLines = lines.filter((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return true;
            const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_:.-]*)\s*=/);
            return !(match && match[1] === oldPath);
        });

        cleanedLines[lineIndex] = `${indent}${marker} ${newParamToWrite} = ${newValue}\n${indent}${oldParamToWrite} = ${oldValue}`;
        return cleanedLines.join('\n');
    }

    convertFutureParamSpecial(content, fullLine, newParams, migration) {
        const oldPathsSpec = Array.isArray(migration.oldPaths) && migration.oldPaths.length
            ? migration.oldPaths.join(',')
            : 'gestures';
        const marker = `# ${MARKER_FUTURE_CONVERTED}:${migration.minVersion}:gesture=>${oldPathsSpec}]`;

        let updated = content;
        const parseResult = this.parser.parse(updated);
        const markerLine = parseResult.lines.find(l =>
            l.marker?.type === 'FUTURE_CONVERTED' &&
            this.normalizeFutureConvertedGroups(l.marker.groups).newPath === 'gesture'
        );
        if (markerLine) {
            updated = this.cleanupFutureConvertedDuplicates(updated, 'gesture');
            const refreshed = this.parser.parse(updated);
            const refreshedMarker = refreshed.lines.find(l =>
                l.marker?.type === 'FUTURE_CONVERTED' &&
                this.normalizeFutureConvertedGroups(l.marker.groups).newPath === 'gesture'
            );
            if (!refreshedMarker) return updated;

            const contentLines = updated.split('\n');
            const removeIndexes = new Set();
            const oldPaths = new Set(newParams.map(p => p.path));

            for (const line of refreshed.lines) {
                if (line.type === 'parameter' && oldPaths.has(line.paramPath)) {
                    removeIndexes.add(line.lineNumber - 1);
                }
                if (line.type === 'parameter' && line.paramPath === 'gesture') {
                    removeIndexes.add(line.lineNumber - 1);
                }
            }

            const filtered = contentLines.filter((_, idx) => !removeIndexes.has(idx));
            const filteredParse = this.parser.parse(filtered.join('\n'));
            const markerLine = filteredParse.lines.find(l =>
                l.marker?.type === 'FUTURE_CONVERTED' &&
                this.normalizeFutureConvertedGroups(l.marker.groups).newPath === 'gesture'
            );
            if (!markerLine) return filtered.join('\n');

            const markerIndex = markerLine.lineNumber - 1;
            const indent = markerLine.indent || '';
            const currentSection = markerLine.sectionPath || '';
            const newLines = newParams.map(p => {
                let paramName = p.path;
                if (currentSection && paramName.startsWith(currentSection + ':')) {
                    paramName = paramName.substring(currentSection.length + 1);
                }
                return `${indent}${paramName} = ${p.value}`;
            });
            const markerRaw = filtered[markerIndex] || '';
            const afterBracket = markerRaw.includes(']') ? markerRaw.split(']').slice(1).join(']').trim() : '';
            const preservedLineRaw = (String(fullLine || '').trim()) || (afterBracket || 'gesture =');
            const preservedLine = this.stripUserEnabledFutureMarker(preservedLineRaw).trim() || 'gesture =';
            filtered[markerIndex] = `${indent}${marker} ${preservedLine}`;
            filtered.splice(markerIndex + 1, 0, ...newLines);

            return this.enableFutureConvertedParams(filtered.join('\n'), 'gesture');
        }

        const lines = updated.split('\n');
        const normalizedFullLine = String(fullLine || '').trim();

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            const stripped = trimmed.replace(/\s+#\s*\[LL:USER_ENABLED_FUTURE\]\s*$/, '');
            const matchesLine = normalizedFullLine && (trimmed === normalizedFullLine || stripped === normalizedFullLine);
            const matchesPattern = migration.pattern ? migration.pattern.test(stripped) : false;

            if (matchesLine || matchesPattern) {
                const indent = lines[i].match(/^(\s*)/)[1];
                const currentSection = this.detectSectionContext(lines, i);
                const newLines = newParams.map(p => {
                    let paramName = p.path;
                    if (currentSection && paramName.startsWith(currentSection + ':')) {
                        paramName = paramName.substring(currentSection.length + 1);
                    }
                    return `${indent}${paramName} = ${p.value}`;
                });
                const preservedLineRaw = normalizedFullLine || trimmed;
                const preservedLine = this.stripUserEnabledFutureMarker(preservedLineRaw).trim() || 'gesture =';
                const oldPaths = new Set(newParams.map(p => p.path));
                const cleaned = lines.filter((line) => {
                    const t = line.trim();
                    if (!t || t.startsWith('#')) return true;
                    const match = t.match(/^([a-zA-Z_][a-zA-Z0-9_:.-]*)\s*=/);
                    return !(match && oldPaths.has(match[1]));
                });
                cleaned[i] = `${indent}${marker} ${preservedLine}\n${newLines.join('\n')}`;
                return cleaned.join('\n');
                break;
            }
        }

        return lines.join('\n');
    }

    transformValueReverse(value, transform) {
        if (!transform) return value;

        switch (transform) {
            case 'invert':
                if (value === 'true' || value === 'yes' || value === '1') return 'false';
                if (value === 'false' || value === 'no' || value === '0') return 'true';
                return value;

            case 'intToBool':
                if (value === '0') return 'false';
                if (parseInt(value, 10) > 0) return 'true';
                return value;

            default:
                return value;
        }
    }

    enableFutureParam(content, paramPath) {
        return this.parser.uncommentParameter(content, paramPath, MARKER_USER_ENABLED_FUTURE);
    }

    disableFutureParam(content, paramPath) {
        const migration = HYPRLAND_FUTURE_PARAMS[paramPath];
        if (!migration) return content;

        const reason = migration.note || migration.action || 'not available';
        const marker = `# ${MARKER_FUTURE_DISABLED}:${migration.minVersion}:${reason}]`;

        const parseResult = this.parser.parse(content);
        const existing = parseResult.lines.find(l =>
            l.type === 'parameter' &&
            l.paramPath === paramPath &&
            l.isUserEnabled &&
            l.marker?.type === 'FUTURE_USER_ENABLED'
        );

        if (!existing) return content;

        const lines = content.split('\n');
        const lineIndex = existing.lineNumber - 1;
        const indent = existing.indent || '';

        const paramName = existing.sectionPath.length > 0 ? existing.paramName : existing.paramPath;
        lines[lineIndex] = `${indent}${marker} ${paramName} = ${existing.paramValue}`;

        return lines.join('\n');
    }

    revertFutureConversion(content, newPath, oldPath) {
        let normalizedContent = this.cleanupFutureConvertedDuplicates(content, newPath);
        const parseResult = this.parser.parse(normalizedContent);
        const markerLineIndex = parseResult.lines.findIndex((l) => {
            if (l.marker?.type !== 'FUTURE_CONVERTED') return false;
            const normalized = this.normalizeFutureConvertedGroups(l.marker.groups);
            return normalized.newPath === newPath;
        });
        if (markerLineIndex === -1) return normalizedContent;

        const markerLine = parseResult.lines[markerLineIndex];
        const normalized = this.normalizeFutureConvertedGroups(markerLine.marker.groups);
        const { minVersion, oldPathPrefix } = normalized;
        const oldPathSpec = this.parseFutureConvertedOldPathSpec(oldPathPrefix);

        const contentLines = normalizedContent.split('\n');
        const markerContentIndex = markerLine.lineNumber - 1;
        const indent = markerLine.indent || '';

        const blockParams = this.collectConvertedBlockParams(parseResult, markerLineIndex, oldPathPrefix);
        if (blockParams.length === 0) return content;

        const markerRaw = contentLines[markerContentIndex] || '';
        const afterBracket = markerRaw.includes(']') ? markerRaw.split(']').slice(1).join(']').trim() : '';
        let newValue = null;
        if (afterBracket) {
            const m = afterBracket.match(/^[^=]+=\s*(.+?)\s*$/);
            if (m) newValue = m[1].trim();
        }

        if (!newValue) {
            if (newPath === 'gesture') {
                const fingersPath = oldPathSpec.list
                    ? oldPathSpec.list.find(p => p.endsWith(':workspace_swipe_fingers'))
                    : `${oldPathPrefix}:workspace_swipe_fingers`;
                const fingersLine = blockParams.find(p => p.paramPath === fingersPath);
                const parsedFingers = fingersLine ? parseInt(String(fingersLine.paramValue || '').trim(), 10) : NaN;
                const fingers = Number.isFinite(parsedFingers) && parsedFingers > 0 ? parsedFingers : 3;
                newValue = `${fingers}, horizontal, workspace`;
            } else {
                newValue = String(blockParams[0].paramValue ?? '').trim();
            }
        }

        const marker = `# ${MARKER_FUTURE_CONVERTED}:${minVersion}:${normalized.newPath}=>${oldPathPrefix}]`;
        contentLines[markerContentIndex] = `${indent}${marker} ${newPath} = ${newValue}`;
        const markerSectionPrefix = Array.isArray(markerLine.sectionPath) ? markerLine.sectionPath.join(':') : '';
        const newPathParts = newPath.split(':');
        const newPathPrefix = newPathParts.slice(0, -1).join(':');
        const newParamToWrite = markerSectionPrefix && markerSectionPrefix === newPathPrefix
            ? newPathParts[newPathParts.length - 1]
            : newPath;

        const existingUserLine = parseResult.lines.find(l =>
            l.type === 'parameter' &&
            l.paramPath === newPath &&
            l.marker?.type === 'FUTURE_USER_ENABLED'
        );

        if (existingUserLine) {
            const lineIndex = existingUserLine.lineNumber - 1;
            const lineIndent = existingUserLine.indent || '';
            const paramName = existingUserLine.sectionPath.length > 0 ? existingUserLine.paramName : existingUserLine.paramPath;
            contentLines[lineIndex] = `${lineIndent}${paramName} = ${newValue}  # ${MARKER_USER_ENABLED_FUTURE}`;
        } else {
            contentLines.splice(markerContentIndex + 1, 0, `${indent}${newParamToWrite} = ${newValue}  # ${MARKER_USER_ENABLED_FUTURE}`);
        }

        const withUserEnabled = contentLines.join('\n');
        return this.disableFutureConvertedParams(withUserEnabled, newPath);
    }

    cleanupFutureConvertedDuplicates(content, targetNewPath = null) {
        const parseResult = this.parser.parse(content);
        const lines = content.split('\n');
        const removeIndexes = new Set();
        const blocksByPath = new Map();
        let markerSanitized = false;

        for (let i = 0; i < parseResult.lines.length; i++) {
            const line = parseResult.lines[i];
            if (line.marker?.type !== 'FUTURE_CONVERTED') continue;
            const normalized = this.normalizeFutureConvertedGroups(line.marker.groups);
            if (targetNewPath && normalized.newPath !== targetNewPath) continue;

            const blockParams = this.collectConvertedBlockParams(parseResult, i, normalized.oldPathPrefix);
            if (!blocksByPath.has(normalized.newPath)) {
                blocksByPath.set(normalized.newPath, []);
            }
            blocksByPath.get(normalized.newPath).push({ markerLine: line, blockParams, normalized });
        }

        const keptBlocks = new Map();
        for (const [newPath, blocks] of blocksByPath.entries()) {
            if (blocks.length === 1) {
                keptBlocks.set(newPath, blocks[0]);
                continue;
            }

            let best = blocks[0];
            for (const block of blocks.slice(1)) {
                const bestScore = best.blockParams.length;
                const blockScore = block.blockParams.length;
                if (blockScore > bestScore ||
                    (blockScore === bestScore && block.markerLine.lineNumber > best.markerLine.lineNumber)) {
                    best = block;
                }
            }

            keptBlocks.set(newPath, best);

            for (const block of blocks) {
                if (block === best) continue;
                removeIndexes.add(block.markerLine.lineNumber - 1);
                for (const p of block.blockParams) {
                    removeIndexes.add(p.lineNumber - 1);
                }
            }
        }

        for (const { markerLine, blockParams } of keptBlocks.values()) {
            const lastByPath = new Map();
            for (const p of blockParams) {
                lastByPath.set(p.paramPath, p.lineNumber);
            }

            for (const p of blockParams) {
                if (p.lineNumber !== lastByPath.get(p.paramPath)) {
                    removeIndexes.add(p.lineNumber - 1);
                }
            }

            const markerIndex = markerLine.lineNumber - 1;
            const cleanedMarker = this.stripUserEnabledFutureMarker(lines[markerIndex]);
            if (cleanedMarker !== lines[markerIndex]) {
                lines[markerIndex] = cleanedMarker;
                markerSanitized = true;
            }
        }

        const lastUserEnabled = new Map();
        for (const line of parseResult.lines) {
            if (line.type !== 'parameter' || line.marker?.type !== 'FUTURE_USER_ENABLED') continue;
            lastUserEnabled.set(line.paramPath, line.lineNumber);
        }
        for (const line of parseResult.lines) {
            if (line.type !== 'parameter' || line.marker?.type !== 'FUTURE_USER_ENABLED') continue;
            if (line.lineNumber !== lastUserEnabled.get(line.paramPath)) {
                removeIndexes.add(line.lineNumber - 1);
            }
        }

        if (removeIndexes.size === 0 && !markerSanitized) return content;

        const cleaned = lines.filter((_, idx) => !removeIndexes.has(idx));
        return cleaned.join('\n');
    }

    removeFutureUserEnabledLines(content, paramPath) {
        const parseResult = this.parser.parse(content);
        const lines = content.split('\n');
        const removeIndexes = new Set();

        for (const line of parseResult.lines) {
            if (line.type !== 'parameter') continue;
            if (line.paramPath !== paramPath) continue;
            if (line.marker?.type !== 'FUTURE_USER_ENABLED') continue;
            removeIndexes.add(line.lineNumber - 1);
        }

        if (removeIndexes.size === 0) return content;
        return lines.filter((_, idx) => !removeIndexes.has(idx)).join('\n');
    }

    reconcileFutureUserEnabledLines(content, enabledFuture, revertedFutureConversions) {
        const parseResult = this.parser.parse(content);
        const lines = content.split('\n');
        let modified = false;

        for (const line of parseResult.lines) {
            if (line.type !== 'parameter') continue;
            if (line.marker?.type !== 'FUTURE_USER_ENABLED') continue;

            const migration = HYPRLAND_FUTURE_PARAMS[line.paramPath];
            if (!migration) continue;

            const lineIndex = line.lineNumber - 1;
            const indent = line.indent || '';
            const paramName = line.sectionPath.length > 0 ? line.paramName : line.paramPath;

            switch (migration.action) {
                case 'disable':
                    if (enabledFuture.includes(line.paramPath)) continue;
                    lines[lineIndex] = `${indent}# ${MARKER_FUTURE_DISABLED}:${migration.minVersion}:${migration.note || migration.action || 'not available'}] ${paramName} = ${line.paramValue}`;
                    modified = true;
                    continue;

                default:
                    if (revertedFutureConversions.includes(line.paramPath)) continue;
                    lines[lineIndex] = null;
                    modified = true;
                    break;
            }
        }

        if (!modified) return content;
        return lines.filter(line => line !== null).join('\n');
    }

    enforceFutureConvertedState(content, forcedNewPaths = null, targetVersion = null) {
        const parseResult = this.parser.parse(content);
        const forced = new Set(Array.isArray(forcedNewPaths) ? forcedNewPaths : []);
        const converted = new Set();
        const resolvedVersion = targetVersion || this.getCachedHyprlandVersion();

        for (const line of parseResult.lines) {
            if (line.type === 'parameter' && line.marker?.type === 'FUTURE_USER_ENABLED') {
                forced.add(line.paramPath);
            }
            if (line.marker?.type === 'FUTURE_CONVERTED') {
                const normalized = this.normalizeFutureConvertedGroups(line.marker.groups);
                if (normalized.newPath) {
                    converted.add(normalized.newPath);
                }
            }
        }

        let result = content;
        for (const newPath of converted) {
            const migration = HYPRLAND_FUTURE_PARAMS[newPath];
            if (migration && this.isVersionSupported(resolvedVersion, migration.minVersion)) {
                result = this.revertFutureConversion(result, newPath);
                continue;
            }

            if (forced.has(newPath)) {
                result = this.disableFutureConvertedParams(result, newPath);
                continue;
            }

            result = this.removeFutureUserEnabledLines(result, newPath);
            result = this.enableFutureConvertedParams(result, newPath);
        }

        return result;
    }

    enableFutureConvertedParams(content, newPath) {
        const parseResult = this.parser.parse(content);
        const lines = content.split('\n');
        let modified = false;

        for (let i = 0; i < parseResult.lines.length; i++) {
            const line = parseResult.lines[i];
            if (line.marker?.type !== 'FUTURE_CONVERTED') continue;

            const normalized = this.normalizeFutureConvertedGroups(line.marker.groups);
            if (normalized.newPath !== newPath) continue;
            const oldPathPrefix = normalized.oldPathPrefix;

            const blockParams = this.collectConvertedBlockParams(parseResult, i, oldPathPrefix);
            for (const p of blockParams) {
                if (p.marker?.type !== 'LEGACY_DISABLED') continue;
                const lineIndex = p.lineNumber - 1;
                const indent = p.indent;
                lines[lineIndex] = `${indent}${p.paramPath} = ${p.paramValue}`;
                modified = true;
            }
            break;
        }

        return modified ? lines.join('\n') : content;
    }

    disableFutureConvertedParams(content, newPath) {
        const parseResult = this.parser.parse(content);
        const lines = content.split('\n');
        let modified = false;

        for (let i = 0; i < parseResult.lines.length; i++) {
            const line = parseResult.lines[i];
            if (line.marker?.type !== 'FUTURE_CONVERTED') continue;

            const normalized = this.normalizeFutureConvertedGroups(line.marker.groups);
            if (normalized.newPath !== newPath) continue;
            const minVersion = normalized.minVersion;
            const oldPathPrefix = normalized.oldPathPrefix;

            const blockParams = this.collectConvertedBlockParams(parseResult, i, oldPathPrefix);
            for (const p of blockParams) {
                if (p.isDisabled) continue;
                const lineIndex = p.lineNumber - 1;
                const indent = p.indent;
                const marker = `# [LL:LEGACY:disabled:${minVersion}:removed]`;
                lines[lineIndex] = `${indent}${marker} ${p.paramPath} = ${p.paramValue}`;
                modified = true;
            }
            break;
        }

        return modified ? lines.join('\n') : content;
    }

    getFutureParamsForTheme(themePath) {
        const configFiles = this.findHyprlandConfigs(themePath);
        return this.scanThemeConfigFiles(
            configFiles,
            'LegacyMigrationService.getFutureParamsForTheme',
            this.scanForFutureParamsWithState
        );
    }

    getAllFutureParams(themesDir) {
        const result = { disabled: new Map(), converted: new Map() };
        const themes = this.listThemeEntries(themesDir, 'LegacyMigrationService.getAllFutureParams');
        if (!themes) {
            this.log('Error scanning themes for future params');
        } else {
            for (const { themeName, themePath } of themes) {
                const themeParams = this.getFutureParamsForTheme(themePath);
                this.mergeThemeParams(result.disabled, themeParams.disabled, themeName, param => param.path);
                this.mergeThemeParams(result.converted, themeParams.converted, themeName, param => param.newPath || param.oldPath);
            }
        }

        return {
            disabled: Array.from(result.disabled.values()),
            converted: Array.from(result.converted.values())
        };
    }

    migrateConfigBidirectional(content, options = {}) {
        const legacyResult = this.migrateConfig(content, options);

        const futureResult = this.migrateConfigFuture(legacyResult.content, {
            autoMigrate: options.autoMigrate,
            enabledFuture: options.enabledFuture || [],
            revertedFutureConversions: options.revertedFutureConversions || [],
            targetVersion: options.targetVersion || null
        });

        return {
            content: futureResult.content,
            migrations: legacyResult.migrations,
            futureMigrations: futureResult.futureMigrations
        };
    }
}

export { HYPRLAND_MIGRATIONS, HYPRLAND_FUTURE_PARAMS };
