import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull } from '../utils/ErrorUtils.js';

const DEFAULT_OS_RELEASE_PATH = '/etc/os-release';

function parseOsReleaseId(content) {
    const lines = typeof content === 'string' ? content.split('\n') : [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('ID=')) continue;
        const raw = trimmed.slice(3).trim();
        const unquoted = raw.replace(/^["']|["']$/g, '').trim().toLowerCase();
        return unquoted || null;
    }
    return null;
}

export class DistributionService {
    readOsRelease(path = DEFAULT_OS_RELEASE_PATH) {
        const filePath = typeof path === 'string' ? path : DEFAULT_OS_RELEASE_PATH;
        if (!Gio.File.new_for_path(filePath).query_exists(null)) return '';
        const [ok, data] = tryOrNull('DistributionService.readOsRelease', () => GLib.file_get_contents(filePath)) || [];
        return ok && data ? new TextDecoder('utf-8').decode(data) : '';
    }

    getCurrentDistributionId(path = DEFAULT_OS_RELEASE_PATH) {
        return parseOsReleaseId(this.readOsRelease(path));
    }

    detectCurrentDistribution(supportedIds = [], fallback = 'arch') {
        const detected = this.getCurrentDistributionId();
        if (!Array.isArray(supportedIds) || supportedIds.length === 0) return detected || fallback;
        return supportedIds.includes(detected) ? detected : fallback;
    }
}
