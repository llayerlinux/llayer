import {
    compareHyprlandVersions,
    hasModernGestures,
    hasModernRules
} from './HyprlandVersionMatrix.js';

const LEGACY_ACTION_TO_MODERN = Object.freeze({
    float: 'float on',
    tile: 'tile on',
    pin: 'pin on',
    fullscreen: 'fullscreen on',
    maximize: 'maximize on',
    blur: 'blur on',
    nofocus: 'no_focus on',
    noinitialfocus: 'no_initial_focus on',
    noanim: 'no_anim on',
    noblur: 'no_blur on',
    noshadow: 'no_shadow on',
    noborder: 'no_border on',
    dimaround: 'dim_around on',
    stayfocused: 'stay_focused on',
    focusonactivate: 'focus_on_activate on',
    keepshadow: 'keep_shadow on',
    keepaspectratio: 'keep_aspect_ratio on',
    rendersync: 'render_unfocused on',
    renderunfocused: 'render_unfocused on',
    forceshadow: 'force_shadow on',
    forcergbx: 'force_rgbx on',
    immediate: 'immediate on',
    opaque: 'opaque on',
    nearestneighbor: 'nearest_neighbor on',
    syncfullscreen: 'sync_fullscreen on',
    bordersize: 'border_size',
    bordercolor: 'border_color',
    minsize: 'min_size',
    maxsize: 'max_size',
    blurpopups: 'blur_popups on',
    ignorealpha: 'ignore_alpha',
    ignorezero: 'ignore_alpha 0',
    xray: 'xray on',
    abovelock: 'above_lock',
    order: 'order',
    noscreenshare: 'no_screen_share on',
    idleinhibit: 'idle_inhibit',
    animation: 'animation',
    opacity: 'opacity',
    workspace: 'workspace',
    move: 'move',
    size: 'size',
    center: 'center on',
    tag: 'tag',
    pseudo: 'pseudo on',
    suppressevent: 'suppress_event'
});

const MODERN_ACTION_TO_LEGACY = Object.freeze({
    float: 'float',
    tile: 'tile',
    pin: 'pin',
    fullscreen: 'fullscreen',
    maximize: 'maximize',
    blur: 'blur',
    no_focus: 'nofocus',
    no_initial_focus: 'noinitialfocus',
    no_anim: 'noanim',
    no_blur: 'noblur',
    no_shadow: 'noshadow',
    no_border: 'noborder',
    dim_around: 'dimaround',
    stay_focused: 'stayfocused',
    focus_on_activate: 'focusonactivate',
    keep_shadow: 'keepshadow',
    keep_aspect_ratio: 'keepaspectratio',
    render_unfocused: 'renderunfocused',
    force_shadow: 'forceshadow',
    force_rgbx: 'forcergbx',
    immediate: 'immediate',
    opaque: 'opaque',
    nearest_neighbor: 'nearestneighbor',
    sync_fullscreen: 'syncfullscreen',
    border_size: 'bordersize',
    border_color: 'bordercolor',
    min_size: 'minsize',
    max_size: 'maxsize',
    blur_popups: 'blurpopups',
    ignore_alpha: 'ignorealpha',
    xray: 'xray',
    above_lock: 'abovelock',
    order: 'order',
    no_screen_share: 'noscreenshare',
    idle_inhibit: 'idleinhibit',
    animation: 'animation',
    opacity: 'opacity',
    workspace: 'workspace',
    move: 'move',
    size: 'size',
    center: 'center',
    tag: 'tag',
    pseudo: 'pseudo',
    suppress_event: 'suppressevent'
});

const LEGACY_MATCH_FIELDS = Object.freeze(new Set([
    'class',
    'title',
    'initialclass',
    'initialtitle',
    'xwayland',
    'floating',
    'fullscreen',
    'pinned',
    'workspace',
    'onworkspace',
    'content'
]));

function splitComment(line) {
    const hashIndex = line.indexOf('#');
    if (hashIndex === -1)
        return { body: line, comment: '' };
    return {
        body: line.slice(0, hashIndex).trimEnd(),
        comment: line.slice(hashIndex)
    };
}

function splitRuleTokens(body) {
    return body
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);
}

function parseBoolean(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === '1'
        || normalized === 'true'
        || normalized === 'yes'
        || normalized === 'on';
}

function rewriteLegacyAction(actionText) {
    const trimmed = actionText.trim().replace(/\s+/g, ' ');
    if (!trimmed)
        return trimmed;
    const [rawName, ...rawArgs] = trimmed.split(' ');
    const actionName = rawName.toLowerCase();
    const mapped = LEGACY_ACTION_TO_MODERN[actionName] || rawName;
    const args = rawArgs.join(' ').trim();
    const modernName = mapped.replace(/\s+on$/, '');

    switch (modernName) {
        case 'above_lock':
            return rewriteLegacyAboveLock(rawArgs);
        case 'ignore_alpha':
            return args ? `ignore_alpha ${args}` : 'ignore_alpha 0';
        case 'move':
            return rawArgs.length >= 2 ? `move ${args}` : null;
        case 'size':
        case 'min_size':
        case 'max_size':
        case 'opacity':
        case 'animation':
        case 'workspace':
        case 'border_color':
        case 'border_size':
        case 'idle_inhibit':
        case 'tag':
        case 'suppress_event':
            return args ? `${modernName} ${args}` : modernName;
        case 'pseudo':
            return args ? `${modernName} ${args}` : 'pseudo on';
        default:
            if (mapped.endsWith(' on'))
                return mapped;
            return args ? `${mapped} ${args}` : mapped;
    }
}

function rewriteModernAction(actionText) {
    const trimmed = actionText.trim().replace(/\s+/g, ' ');
    if (!trimmed)
        return trimmed;
    const [rawName, ...rawArgs] = trimmed.split(' ');
    const actionName = rawName.toLowerCase();
    const mapped = MODERN_ACTION_TO_LEGACY[actionName] || rawName;
    const args = rawArgs.join(' ').trim();

    if (actionName === 'above_lock')
        return rewriteModernAboveLock(rawArgs);
    if (args.toLowerCase() === 'on')
        return mapped;
    return args ? `${mapped} ${args}` : mapped;
}

function rewriteLegacyAboveLock(rawArgs) {
    const normalized = rawArgs.join(' ').trim().toLowerCase();
    switch (normalized) {
        case '':
        case 'false':
        case '0':
        case 'off':
        case 'no':
            return 'above_lock 1';
        case 'true':
        case '1':
        case 'on':
        case 'yes':
        case 'interactable':
            return 'above_lock 2';
        default:
            return `above_lock ${normalized}`;
    }
}

function rewriteModernAboveLock(rawArgs) {
    const normalized = rawArgs.join(' ').trim().toLowerCase();
    switch (normalized) {
        case '':
        case '1':
            return 'abovelock';
        case '2':
            return 'abovelock true';
        case '0':
            return 'abovelock false';
        default:
            return normalized ? `abovelock ${normalized}` : 'abovelock';
    }
}

function canonicalizeMatchField(field) {
    const normalized = field.trim();
    switch (normalized.toLowerCase()) {
        case 'floating':
            return 'float';
        case 'initialclass':
            return 'initialClass';
        case 'initialtitle':
            return 'initialTitle';
        case 'pinned':
            return 'pin';
        default:
            return normalized.toLowerCase();
    }
}

function canonicalizeDecimalToken(token) {
    const trimmed = token.trim();
    if (!trimmed)
        return trimmed;
    return trimmed.replace(/^([+-]?)\./, '$10.');
}

function rewriteBezierLine(line) {
    const match = line.match(/^(\s*bezier\s*=\s*)(.+)$/);
    if (!match)
        return { line, changed: false };

    const [, prefix, remainderWithComment] = match;
    const { body, comment } = splitComment(remainderWithComment);
    const parts = body
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);

    if (parts.length !== 5)
        return { line, changed: false };

    const [name, ...points] = parts;
    const rewrittenLine = `${prefix}${name}, ${points.map(canonicalizeDecimalToken).join(', ')}${comment ? ` ${comment}` : ''}`.trimEnd();
    return {
        line: rewrittenLine,
        changed: rewrittenLine !== line.trimEnd()
    };
}

function repairKnownMigrationArtifacts(content) {
    const lines = content.split('\n');
    const repaired = [];
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        const nextLine = lines[i + 1] || '';
        const markerMatch = currentLine.match(
            /^(\s*)undefined#\s*\[LL:LEGACY:converted:[^:]+:misc:allow_session_lock_restore\]\s*$/
        );
        const valueMatch = nextLine.match(/^\s*undefinedlockdead_screen_delay\s*=\s*(.+?)\s*$/);

        if (markerMatch && valueMatch) {
            repaired.push(`${markerMatch[1]}allow_session_lock_restore = ${valueMatch[1]}`);
            changed = true;
            i++;
            continue;
        }

        const sanitizedLine = currentLine
            .replace(/^(\s*)undefined(#\s*\[LL:(?:LEGACY|FUTURE):converted:[^\]]+\])\s*$/, '$1$2')
            .replace(/^(\s*)undefined([a-zA-Z_][a-zA-Z0-9_:.-]*\s*=)/, '$1$2');
        changed ||= sanitizedLine !== currentLine;
        repaired.push(sanitizedLine);
    }

    return {
        content: repaired.join('\n'),
        changed
    };
}

function rewriteRuleTokenForModern(token) {
    if (token.startsWith('match:')) {
        const match = token.match(/^match:([^\s]+)\s+(.+)$/i);
        if (!match)
            return token;

        const [, rawField, rawValue] = match;
        return `match:${canonicalizeMatchField(rawField)} ${rawValue.trim()}`;
    }

    return rewriteLegacyAction(token) || token;
}

function rewriteRuleLineForModern(line) {
    const match = line.match(/^(\s*)(windowrule|layerrule)\s*=\s*(.+)$/i);
    if (!match)
        return { line, changed: false };

    const [, indent, ruleKind, bodyWithComment] = match;
    const { body, comment } = splitComment(bodyWithComment);
    const tokens = splitRuleTokens(body);
    if (tokens.length === 0)
        return { line, changed: false };

    const rewrittenLine = `${indent}${ruleKind.toLowerCase()} = ${tokens.map(rewriteRuleTokenForModern).join(', ')}${comment ? ` ${comment}` : ''}`.trimEnd();
    return {
        line: rewrittenLine,
        changed: rewrittenLine !== line.trimEnd()
    };
}

function rewriteHyprexpoGestureConfig(content, targetVersion) {
    if (compareHyprlandVersions(targetVersion, '0.54.0') < 0)
        return { content, changed: false };

    const lines = content.split('\n');
    const normalized = [];
    const stack = [];
    let changed = false;
    let hyprexpoState = null;
    let pendingPluginLines = [];

    for (const line of lines) {
        const trimmed = line.trim();
        const currentPath = stack.join(':');
        const openingMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*\{$/);

        if (currentPath === 'plugin:hyprexpo') {
            const assignmentMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*(.+?)\s*$/);
            if (assignmentMatch) {
                const [, rawName, rawValue] = assignmentMatch;
                const name = rawName.toLowerCase();
                const value = rawValue.trim();

                switch (name) {
                    case 'enable_gesture':
                        hyprexpoState.enabled = parseBoolean(value);
                        changed = true;
                        continue;
                    case 'gesture_fingers': {
                        const parsed = parseInt(value, 10);
                        hyprexpoState.fingers = Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
                        changed = true;
                        continue;
                    }
                    case 'gesture_positive':
                        hyprexpoState.positive = parseBoolean(value);
                        changed = true;
                        continue;
                    case 'gesture_distance':
                        hyprexpoState.distance = value;
                        changed = true;
                        continue;
                    default:
                        break;
                }
            }
        }

        normalized.push(line);

        if (openingMatch) {
            const blockName = openingMatch[1].toLowerCase();
            stack.push(blockName);
            if (stack.join(':') === 'plugin:hyprexpo') {
                hyprexpoState = {
                    enabled: null,
                    fingers: 3,
                    positive: true,
                    distance: null
                };
            }
            continue;
        }

        if (trimmed !== '}')
            continue;

        const closingBlock = stack[stack.length - 1];
        if (closingBlock === 'hyprexpo' && hyprexpoState?.enabled) {
            const direction = hyprexpoState.positive ? 'down' : 'up';
            pendingPluginLines.push(`hyprexpo-gesture = ${hyprexpoState.fingers}, ${direction}, expo`);
            if (hyprexpoState.distance) {
                pendingPluginLines.push(
                    `# [LL:HYPR:manual-plugin-option:0.54.0] hyprexpo gesture_distance = ${hyprexpoState.distance}`
                );
            }
        }
        closingBlock === 'hyprexpo' && (hyprexpoState = null);
        stack.pop();

        if (closingBlock === 'plugin' && pendingPluginLines.length > 0) {
            normalized.push(...pendingPluginLines);
            pendingPluginLines = [];
        }
    }

    return {
        content: normalized.join('\n'),
        changed
    };
}

function rewriteVersionSpecificSyntax(content, targetVersion) {
    let result = content;
    let changed = false;

    const repaired = repairKnownMigrationArtifacts(result);
    if (repaired.changed) {
        result = repaired.content;
        changed = true;
    }

    result = result
        .split('\n')
        .map((line) => {
            const rewrittenLine = rewriteBezierLine(line);
            changed ||= rewrittenLine.changed;
            return rewrittenLine.line;
        })
        .join('\n');

    const rewrittenHyprexpoConfig = rewriteHyprexpoGestureConfig(result, targetVersion);
    if (rewrittenHyprexpoConfig.changed) {
        result = rewrittenHyprexpoConfig.content;
        changed = true;
    }

    if (hasModernRules(targetVersion)) {
        result = result
            .split('\n')
            .map((line) => {
                if (/^\s*#/.test(line))
                    return line;
                const rewrittenLine = rewriteRuleLineForModern(line);
                changed ||= rewrittenLine.changed;
                return rewrittenLine.line;
            })
            .join('\n');
    }

    return { content: result, changed };
}

function parseLegacyRuleTokens(tokens, ruleKind) {
    if (tokens.length === 0)
        return null;

    const actionText = tokens[0];
    const matchTokens = [];

    for (const token of tokens.slice(1)) {
        const colonIndex = token.indexOf(':');
        if (colonIndex === -1) {
            const implicitField = ruleKind === 'layerrule' ? 'namespace' : 'class';
            matchTokens.push(`match:${implicitField} ${token}`);
            continue;
        }

        const field = token.slice(0, colonIndex).trim();
        const value = token.slice(colonIndex + 1).trim();
        if (!field || !value)
            continue;

        if (LEGACY_MATCH_FIELDS.has(field.toLowerCase()) || ruleKind === 'layerrule') {
            const normalizedField = ruleKind === 'layerrule'
                ? 'namespace'
                : canonicalizeMatchField(field);
            matchTokens.push(`match:${normalizedField} ${value}`);
            continue;
        }

        return null;
    }

    const normalizedAction = rewriteLegacyAction(actionText);
    if (!normalizedAction)
        return null;

    return { action: normalizedAction, matches: matchTokens };
}

function convertLegacyRuleLine(line) {
    const match = line.match(/^(\s*)(windowrulev2|windowrule|layerrule)\s*=\s*(.+)$/i);
    if (!match)
        return { line, changed: false, unresolved: false };

    const [, indent, ruleKindRaw, bodyWithComment] = match;
    const { body, comment } = splitComment(bodyWithComment);
    if (ruleKindRaw.toLowerCase() !== 'windowrulev2' && body.includes('match:'))
        return { line, changed: false, unresolved: false };
    const ruleKind = ruleKindRaw.toLowerCase();
    const tokens = splitRuleTokens(body);
    const parsed = parseLegacyRuleTokens(tokens, ruleKind);

    if (!parsed) {
        return {
            line: `${indent}# [LL:HYPR:manual-rule:0.53.0] ${body.trim()}${comment ? ` ${comment}` : ''}`.trimEnd(),
            changed: true,
            unresolved: true
        };
    }

    const normalizedRuleKind = ruleKind === 'layerrule' ? 'layerrule' : 'windowrule';
    const commentSuffix = comment ? ` ${comment}` : '';
    const assembled = `${indent}${normalizedRuleKind} = ${[parsed.action, ...parsed.matches].join(', ')}${commentSuffix}`;
    return { line: assembled.trimEnd(), changed: assembled.trimEnd() !== line.trimEnd(), unresolved: false };
}

function parseModernRuleTokens(tokens) {
    const matches = [];
    const actions = [];

    for (const token of tokens) {
        if (token.startsWith('match:')) {
            const [, rawField = '', rawValue = ''] = token.match(/^match:([^\s]+)\s+(.+)$/i) || [];
            if (!rawField || !rawValue)
                return null;
            matches.push({ field: rawField.trim(), value: rawValue.trim() });
            continue;
        }
        actions.push(token);
    }

    if (actions.length !== 1)
        return null;

    return { action: actions[0], matches };
}

function convertModernRuleLine(line) {
    const match = line.match(/^(\s*)(windowrule|layerrule)\s*=\s*(.+)$/i);
    if (!match)
        return { line, changed: false, unresolved: false };

    const [, indent, ruleKindRaw, bodyWithComment] = match;
    const { body, comment } = splitComment(bodyWithComment);
    if (!body.includes('match:'))
        return { line, changed: false, unresolved: false };

    const tokens = splitRuleTokens(body);
    const parsed = parseModernRuleTokens(tokens);
    if (!parsed)
        return {
            line: `${indent}# [LL:HYPR:manual-rule:0.49.0] ${body.trim()}${comment ? ` ${comment}` : ''}`.trimEnd(),
            changed: true,
            unresolved: true
        };

    const normalizedAction = rewriteModernAction(parsed.action);
    const legacyMatches = parsed.matches.map(({ field, value }) => {
        if (ruleKindRaw.toLowerCase() === 'layerrule')
            return value;
        return `${field}:${value}`;
    });
    const ruleKind = ruleKindRaw.toLowerCase() === 'layerrule' ? 'layerrule' : 'windowrulev2';
    const commentSuffix = comment ? ` ${comment}` : '';
    const assembled = `${indent}${ruleKind} = ${[normalizedAction, ...legacyMatches].join(',')}${commentSuffix}`;
    return { line: assembled.trimEnd(), changed: assembled.trimEnd() !== line.trimEnd(), unresolved: false };
}

const LEGACY_GESTURE_TOGGLE_RE = /^(?:gestures:)?workspace_swipe\s*=\s*(.+)$/i;
const LEGACY_GESTURE_FINGERS_RE = /^(?:gestures:)?workspace_swipe_fingers\s*=\s*(.+)$/i;
const WORKSPACE_GESTURE_RE = /^gesture\s*=\s*([^,]+),\s*([^,]+),\s*(.+)$/i;

function parseLegacyGestureDirective(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#'))
        return null;

    const toggleMatch = trimmed.match(LEGACY_GESTURE_TOGGLE_RE);
    if (toggleMatch) {
        return {
            kind: 'toggle',
            enabled: parseBoolean(toggleMatch[1].trim())
        };
    }

    const fingersMatch = trimmed.match(LEGACY_GESTURE_FINGERS_RE);
    if (!fingersMatch)
        return null;

    const parsed = parseInt(fingersMatch[1].trim(), 10);
    return {
        kind: 'fingers',
        fingers: Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '3'
    };
}

function isWorkspaceGestureLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#'))
        return false;

    const match = trimmed.match(WORKSPACE_GESTURE_RE);
    if (!match)
        return false;

    const direction = match[2].trim().toLowerCase();
    const action = match[3].trim().toLowerCase();
    return action.startsWith('workspace') && ['horizontal', 'left', 'right'].includes(direction);
}

function convertLegacyGestures(content, targetVersion) {
    if (!hasModernGestures(targetVersion))
        return { content, changed: false };

    const lines = content.split('\n');
    const converted = [];
    let changed = false;
    let swipeEnabled = false;
    let fingers = '3';
    let insertionIndex = null;
    let hasWorkspaceGesture = false;

    for (const line of lines) {
        const legacyGesture = parseLegacyGestureDirective(line);
        if (legacyGesture) {
            if (insertionIndex === null)
                insertionIndex = converted.length;
            switch (legacyGesture.kind) {
                case 'toggle':
                    swipeEnabled = legacyGesture.enabled;
                    break;
                case 'fingers':
                    fingers = legacyGesture.fingers;
                    break;
            }
            changed = true;
            continue;
        }

        if (isWorkspaceGestureLine(line))
            hasWorkspaceGesture = true;

        converted.push(line);
    }

    if (swipeEnabled && !hasWorkspaceGesture) {
        const gestureLine = `gesture = ${fingers}, horizontal, workspace`;
        const targetIndex = insertionIndex === null ? converted.length : insertionIndex;
        converted.splice(targetIndex, 0, gestureLine);
        changed = true;
    }

    return { content: converted.join('\n'), changed };
}

function convertRuleSyntax(content, targetVersion) {
    const shouldUseModernRules = hasModernRules(targetVersion);
    const lines = content.split('\n');
    let changed = false;
    let convertedCount = 0;
    let unresolvedCount = 0;

    const transformed = lines.map((line) => {
        if (/^\s*#/.test(line))
            return line;
        if (!/(windowrulev2|windowrule|layerrule)\s*=/.test(line))
            return line;

        const result = shouldUseModernRules
            ? convertLegacyRuleLine(line)
            : convertModernRuleLine(line);
        changed ||= result.changed;
        if (result.changed && !result.unresolved)
            convertedCount++;
        if (result.unresolved)
            unresolvedCount++;
        return result.line;
    });

    return {
        content: transformed.join('\n'),
        changed,
        convertedCount,
        unresolvedCount
    };
}

function buildLastLayerConfForVersion(targetVersion, options = {}) {
    const {
        includeBindings = true,
        includeInputBlock = true,
        includePopupRules = true
    } = options;

    const lines = [];
    const modernRules = hasModernRules(targetVersion);
    const modernGestures = hasModernGestures(targetVersion);

    if (modernRules) {
        lines.push('windowrule = opacity 0.0, match:class ^(lastlayerhidden)$');
        lines.push('windowrule = no_focus on, match:class ^(lastlayerhidden)$');
        lines.push('windowrule = no_anim on, match:class ^(lastlayerhidden)$');
        lines.push('windowrule = no_blur on, match:class ^(lastlayerhidden)$');
        lines.push('windowrule = no_initial_focus on, match:class ^(lastlayerhidden)$');
        lines.push('windowrule = min_size 1 1, match:class ^(lastlayerhidden)$');
        lines.push('windowrule = max_size 1 1, match:class ^(lastlayerhidden)$');
        lines.push('windowrule = float on, match:class ^(lastlayerhidden)$');
        lines.push('windowrule = workspace special silent, match:class ^(lastlayerhidden)$');
    } else {
        lines.push('windowrulev2 = opacity 0.0,class:^(lastlayerhidden)$');
        lines.push('windowrulev2 = nofocus,class:^(lastlayerhidden)$');
        lines.push('windowrulev2 = noanim,class:^(lastlayerhidden)$');
        lines.push('windowrulev2 = noblur,class:^(lastlayerhidden)$');
        lines.push('windowrulev2 = noinitialfocus,class:^(lastlayerhidden)$');
        lines.push('windowrulev2 = minsize 1 1,class:^(lastlayerhidden)$');
        lines.push('windowrulev2 = maxsize 1 1,class:^(lastlayerhidden)$');
        lines.push('windowrulev2 = float,class:^(lastlayerhidden)$');
        lines.push('windowrulev2 = workspace special silent,class:^(lastlayerhidden)$');
    }

    if (includeBindings)
        lines.push('bind = SUPER, F12, exec, ~/.local/bin/lastlayer');

    if (includeInputBlock) {
        lines.push('input {');
        lines.push('    kb_layout = us');
        lines.push('    kb_options = grp:alt_shift_toggle');
        lines.push('    touchpad {');
        lines.push('        natural_scroll = yes');
        lines.push('    }');
        lines.push('}');
    }

    if (modernGestures) {
        lines.push('gesture = 3, horizontal, workspace');
    } else {
        lines.push('gestures {');
        lines.push('    workspace_swipe = true');
        lines.push('    workspace_swipe_fingers = 3');
        lines.push('}');
    }

    if (includePopupRules) {
        if (modernRules) {
            lines.push('windowrule = opacity 0.6, match:class ^(lastlayer)$');
            lines.push('windowrule = float on, match:class ^(LastLayerPopup)$');
            lines.push('windowrule = size 420 384, match:class ^(LastLayerPopup)$');
            lines.push('windowrule = move 100%-420 50%-192, match:class ^(LastLayerPopup)$');
            lines.push('windowrule = float on, match:class ^(lastlayer_install)$');
        } else {
            lines.push('windowrulev2 = opacity 0.6,class:^(lastlayer)$');
            lines.push('windowrulev2 = float, class:^(LastLayerPopup)$');
            lines.push('windowrulev2 = size 420 384, class:^(LastLayerPopup)$');
            lines.push('windowrulev2 = move 100%-420 50%-192, class:^(LastLayerPopup)$');
            lines.push('windowrulev2 = float, class:^(lastlayer_install)$');
        }
    }

    return `${lines.join('\n')}\n`;
}

function buildLastLayerOpacityRule(targetVersion, opacity = '0.6') {
    if (hasModernRules(targetVersion))
        return `windowrule = opacity ${opacity}, match:class ^(lastlayer)$`;
    return `windowrulev2 = opacity ${opacity},class:^(lastlayer)$`;
}

export {
    buildLastLayerConfForVersion,
    buildLastLayerOpacityRule,
    convertLegacyGestures,
    convertRuleSyntax,
    rewriteVersionSpecificSyntax
};
