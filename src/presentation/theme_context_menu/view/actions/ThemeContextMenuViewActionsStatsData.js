import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import { tryOrNull } from '../../../../infrastructure/utils/ErrorUtils.js';
import { normalizeThemeStats, toNonNegativeNumber } from '../../../../infrastructure/utils/Utils.js';

class ThemeContextMenuViewActionsStatsData {
    loadStats(labels = {}) {
        const theme = this.menuData && this.menuData.theme && typeof this.menuData.theme === 'object'
            ? this.menuData.theme
            : {};
        const sessionId = this.menuSessionId;
        this.applyStatsToLabels(labels, this.buildStatsSnapshot(theme));

        this.controller?.fetchThemeStats?.(theme, (serverStats) => {
            if (serverStats && typeof serverStats === 'object') {
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    this.runInCurrentMenuSession(sessionId, () => {
                        this.applyStatsToLabels(labels, serverStats);
                    });
                    return GLib.SOURCE_REMOVE;
                });
                const isNetwork = this.menuData && this.menuData.isNetwork;
                !isNetwork && this.showViewToggleButton(true, sessionId);
            }
        });
    }

    buildStatsSnapshot(stats = {}) {
        return normalizeThemeStats(stats);
    }

    applyStatsToLabels(labels, stats) {
        const mapping = [
            ['downloadsPrimary', () => this.formatDownloadsCount(stats.downloadCount)],
            ['installPrimary', () => this.formatPerformanceValue(stats.averageInstallMs)],
            ['applyPrimary', () => this.formatPerformanceValue(stats.averageApplyMs)]
        ];
        mapping.forEach(([key, format]) => {
            const label = labels[key];
            label && tryOrNull('applyStatsToLabels', () => label.set_label(format()));
        });
    }

    formatPerformanceValue(durationMs) {
        const normalized = toNonNegativeNumber(durationMs, null);
        if (normalized === null) {
            return '--';
        }
        const seconds = normalized / 1000;
        return normalized >= 1000
            ? `${seconds.toFixed(seconds >= 10 ? 1 : 2)} ${this.translate('PERFORMANCE_UNIT_SECONDS')}`
            : `${Math.round(normalized)} ${this.translate('PERFORMANCE_UNIT_MS')}`;
    }

    formatMeasurementLabel(count, options = {}) {
        if (!count) {
            return typeof options?.defaultText === 'string' ? options.defaultText : this.translate('THEME_CONTEXT_STATS_NO_MEASUREMENTS');
        }
        const translated = this.translate('THEME_CONTEXT_STATS_MEASUREMENTS', {count});
        return typeof translated === 'string' ? translated : `Measurements: ${count}`;
    }
}

export function applyThemeContextMenuViewActionsStatsData(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewActionsStatsData.prototype);
}
