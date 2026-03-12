const VERSION_MATRIX = Object.freeze([
    {
        profile: 'legacy',
        minVersion: '0.0.0',
        maxVersion: '0.50.99',
        docs: {
            variables: 'https://wiki.hypr.land/0.49.0/Configuring/Variables/',
            windowRules: 'https://wiki.hypr.land/0.49.0/Configuring/Window-Rules/',
            releaseNotes: 'https://github.com/hyprwm/Hyprland/releases/tag/v0.49.0'
        },
        capabilities: {
            modernGestures: false,
            modernRules: false,
            modernLayerRules: false
        }
    },
    {
        profile: 'gesture-transition',
        minVersion: '0.51.0',
        maxVersion: '0.52.99',
        docs: {
            variables: 'https://wiki.hypr.land/0.52.0/Configuring/Variables/',
            windowRules: 'https://wiki.hypr.land/0.52.0/Configuring/Window-Rules/',
            releaseNotes: 'https://github.com/hyprwm/Hyprland/releases/tag/v0.51.0'
        },
        capabilities: {
            modernGestures: true,
            modernRules: false,
            modernLayerRules: false
        }
    },
    {
        profile: 'modern-rules',
        minVersion: '0.53.0',
        maxVersion: null,
        docs: {
            variables: 'https://wiki.hypr.land/Configuring/Variables/',
            windowRules: 'https://wiki.hypr.land/Configuring/Window-Rules/',
            releaseNotes: 'https://github.com/hyprwm/Hyprland/releases/tag/v0.53.0'
        },
        capabilities: {
            modernGestures: true,
            modernRules: true,
            modernLayerRules: true
        }
    }
]);

const DOCUMENTATION_SERIES = Object.freeze([
    {
        series: '0.49.x',
        minVersion: '0.49.0',
        maxVersion: '0.49.99',
        profile: 'legacy',
        docs: {
            variables: 'https://wiki.hypr.land/0.49.0/Configuring/Variables/',
            windowRules: 'https://wiki.hypr.land/0.49.0/Configuring/Window-Rules/',
            releaseNotes: 'https://github.com/hyprwm/Hyprland/releases/tag/v0.49.0'
        }
    },
    {
        series: '0.50.x',
        minVersion: '0.50.0',
        maxVersion: '0.50.99',
        profile: 'legacy',
        docs: {
            variables: 'https://wiki.hypr.land/0.50.0/Configuring/Variables/',
            windowRules: 'https://wiki.hypr.land/0.50.0/Configuring/Window-Rules/',
            releaseNotes: 'https://github.com/hyprwm/Hyprland/releases/tag/v0.50.0'
        }
    },
    {
        series: '0.51.x',
        minVersion: '0.51.0',
        maxVersion: '0.51.99',
        profile: 'gesture-transition',
        docs: {
            variables: 'https://wiki.hypr.land/0.51.0/Configuring/Variables/',
            windowRules: 'https://wiki.hypr.land/0.51.0/Configuring/Window-Rules/',
            releaseNotes: 'https://github.com/hyprwm/Hyprland/releases/tag/v0.51.0'
        }
    },
    {
        series: '0.52.x',
        minVersion: '0.52.0',
        maxVersion: '0.52.99',
        profile: 'gesture-transition',
        docs: {
            variables: 'https://wiki.hypr.land/0.52.0/Configuring/Variables/',
            windowRules: 'https://wiki.hypr.land/0.52.0/Configuring/Window-Rules/',
            releaseNotes: 'https://github.com/hyprwm/Hyprland/releases/tag/v0.52.0'
        }
    },
    {
        series: '0.53.x',
        minVersion: '0.53.0',
        maxVersion: '0.53.99',
        profile: 'modern-rules',
        docs: {
            variables: 'https://wiki.hypr.land/0.53.0/Configuring/Variables/',
            windowRules: 'https://wiki.hypr.land/0.53.0/Configuring/Window-Rules/',
            releaseNotes: 'https://github.com/hyprwm/Hyprland/releases/tag/v0.53.0'
        }
    },
    {
        series: '>= 0.54.0',
        minVersion: '0.54.0',
        maxVersion: null,
        profile: 'modern-rules',
        docs: {
            variables: 'https://wiki.hypr.land/Configuring/Variables/',
            windowRules: 'https://wiki.hypr.land/Configuring/Window-Rules/',
            releaseNotes: 'https://github.com/hyprwm/Hyprland/releases/tag/v0.54.0'
        }
    }
]);

const BREAKING_CHANGES = Object.freeze([
    {
        version: '0.51.0',
        area: 'gestures',
        reason: 'workspace_swipe, workspace_swipe_fingers, and workspace_swipe_min_fingers were removed in favor of gesture = fingers, direction, action',
        docs: [
            'https://wiki.hypr.land/0.49.0/Configuring/Variables/',
            'https://wiki.hypr.land/Configuring/Variables/',
            'https://github.com/hyprwm/Hyprland/releases/tag/v0.51.0'
        ]
    },
    {
        version: '0.53.0',
        area: 'window-rules',
        reason: 'windowrule and layerrule syntax was overhauled to match:* based syntax',
        docs: [
            'https://wiki.hypr.land/0.49.0/Configuring/Window-Rules/',
            'https://wiki.hypr.land/0.53.0/Configuring/Window-Rules/',
            'https://github.com/hyprwm/Hyprland/releases/tag/v0.53.0'
        ]
    }
]);

function parseVersion(versionStr) {
    if (!versionStr || versionStr === 'unknown')
        return [0, 0, 0];
    const clean = String(versionStr).trim().replace(/^v/i, '').split('-')[0];
    const parts = clean.split('.').map((part) => parseInt(part, 10) || 0);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function compareVersions(a, b) {
    const left = parseVersion(a);
    const right = parseVersion(b);
    for (let i = 0; i < 3; i++) {
        if (left[i] !== right[i])
            return left[i] - right[i];
    }
    return 0;
}

function isVersionInRange(version, minVersion, maxVersion = null) {
    if (compareVersions(version, minVersion) < 0)
        return false;
    return !maxVersion || compareVersions(version, maxVersion) <= 0;
}

function getVersionProfile(version) {
    const resolvedVersion = version || '0.0.0';
    return VERSION_MATRIX.find((entry) => isVersionInRange(resolvedVersion, entry.minVersion, entry.maxVersion))
        || VERSION_MATRIX[VERSION_MATRIX.length - 1];
}

function getDocumentationSeries(version) {
    const resolvedVersion = version || '0.0.0';
    return DOCUMENTATION_SERIES.find((entry) => isVersionInRange(resolvedVersion, entry.minVersion, entry.maxVersion))
        || DOCUMENTATION_SERIES[DOCUMENTATION_SERIES.length - 1];
}

function hasModernGestures(version) {
    return getVersionProfile(version).capabilities.modernGestures;
}

function hasModernRules(version) {
    return getVersionProfile(version).capabilities.modernRules;
}

function hasModernLayerRules(version) {
    return getVersionProfile(version).capabilities.modernLayerRules;
}

export {
    BREAKING_CHANGES as HYPRLAND_BREAKING_CHANGES,
    DOCUMENTATION_SERIES as HYPRLAND_DOCUMENTATION_SERIES,
    VERSION_MATRIX as HYPRLAND_VERSION_MATRIX,
    compareVersions as compareHyprlandVersions,
    getDocumentationSeries as getHyprlandDocumentationSeries,
    getVersionProfile as getHyprlandVersionProfile,
    hasModernGestures,
    hasModernLayerRules,
    hasModernRules,
    isVersionInRange as isHyprlandVersionInRange,
    parseVersion as parseHyprlandVersion
};
