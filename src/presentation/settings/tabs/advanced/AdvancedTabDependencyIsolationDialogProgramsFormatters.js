import { tryOrNull } from '../../../../infrastructure/utils/ErrorUtils.js';

export function getTypeIcon(type) {
    switch (type) {
        case 'shared': return '\uD83D\uDCE6 Hybrid';
        case 'per-rice': return '\uD83C\uDF5A Per-Rice';
        case 'per-program': return '\uD83D\uDD27 Per-Prog';
        case 'venv': return '\uD83D\uDC0D Venv';
        default: return '\u2753 Unknown';
    }
}

export function formatPath(path, homeDir) {
    return !path
        ? ''
        : homeDir && path.startsWith(homeDir)
        ? `~${path.substring(homeDir.length)}`
        : path;
}

export function formatPathForDisplay(fullPath, homeDir) {
    const hasPath = Boolean(fullPath && fullPath !== '');
    return hasPath
        ? (() => {
            const lastlayerIndex = fullPath.indexOf('lastlayer/');
            return lastlayerIndex !== -1
                ? '...' + fullPath.substring(lastlayerIndex - 1)
                : formatPath(fullPath, homeDir);
        })()
        : '';
}

export function formatTotalSize(bytes) {
    if (!bytes || bytes < 0) {
        return '\u2014';
    }
    let steps = [
        [1024, 1, 'B'],
        [1024 * 1024, 1024, 'K'],
        [1024 * 1024 * 1024, 1024 * 1024, 'M']
    ],
        step = steps.find(([limit]) => bytes < limit);
    return step
        ? (() => {
            const [, divider, suffix] = step;
            return divider === 1 ? `${bytes}${suffix}` : `${(bytes / divider).toFixed(1)}${suffix}`;
        })()
        : `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

export function parseSizeToBytes(sizeStr) {
    if (!sizeStr || sizeStr === '\u2014' || sizeStr === '...') {
        return 0;
    }
    const [, rawValue, rawUnit] = sizeStr.match(/^([\d.]+)([BKMG])?$/i) ?? [];
    return rawValue
        ? (() => {
            let value = parseFloat(rawValue),
                unit = (rawUnit || 'B').toUpperCase();
            switch (unit) {
                case 'K': return value * 1024;
                case 'M': return value * 1024 * 1024;
                case 'G': return value * 1024 * 1024 * 1024;
                default: return value;
            }
        })()
        : 0;
}

export function formatDate(unixTime) {
    return unixTime ? tryOrNull('formatDate', () => {
        const date = new Date(unixTime * 1000);
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }) : null;
}
