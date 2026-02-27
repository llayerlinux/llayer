import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { isPlainObject } from '../../../infrastructure/utils/Utils.js';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';
import {
    buildRiceIncludeLevelData,
    buildRiceLevelDataFromSearchText,
    collectRiceCandidate
} from './ThemeContextMenuViewRiceDepthShared.js';

class ThemeContextMenuViewPackagesRiceDepthDetection {
    getThemeData() {
        return isPlainObject(this.menuData?.theme) ? this.menuData.theme : {};
    }

    determineIncludeLevels() {
        return !this.menuData?.isNetwork
            ? this.detectRiceDepthFromFiles()
            : (() => {
                const includes = isPlainObject(this.menuData?.includes) ? this.menuData.includes : null;
                return includes?.level !== undefined
                    ? {
                        level: Number(includes.level) || 1,
                        levelData: buildRiceIncludeLevelData(includes.levelData)
                    }
                    : this.detectRiceDepth();
            })();
    }

    detectRiceDepth() {
        let allCandidates = [];

        let theme = this.getThemeData(),
            packages = isPlainObject(this.menuData?.packages) ? this.menuData.packages : {},
            repository = isPlainObject(this.menuData?.repository) ? this.menuData.repository : {};

        collectRiceCandidate(allCandidates, packages.supported);
        collectRiceCandidate(allCandidates, theme.packageSupport);

        collectRiceCandidate(allCandidates, theme.name);
        collectRiceCandidate(allCandidates, theme.displayName);
        collectRiceCandidate(allCandidates, theme.title);

        collectRiceCandidate(allCandidates, theme.tags);
        collectRiceCandidate(allCandidates, theme.topics);

        collectRiceCandidate(allCandidates, theme.description);

        collectRiceCandidate(allCandidates, repository.name);
        collectRiceCandidate(allCandidates, repository.description);
        collectRiceCandidate(allCandidates, repository.topics);

        collectRiceCandidate(allCandidates, theme.repoUrl);

        let searchText = allCandidates.join(' ');

        typeof log === 'function' && log(`[RiceDepth] searchText: ${searchText.substring(0, 200)}`);

        return buildRiceLevelDataFromSearchText(searchText);
    }

    detectRiceDepthFromFiles() {
        const theme = this.getThemeData();
        const themePath = this.getLocalThemePath(theme);
        return themePath
            ? buildRiceLevelDataFromSearchText(this.scanThemeDirectory(themePath, 0, 3).join(' ').toLowerCase())
            : this.detectRiceDepth();
    }

    scanThemeDirectory(dirPath, depth = 0, maxDepth = 3) {
        const dir = Gio.File.new_for_path(dirPath);
        const canScan = depth <= maxDepth && dir.query_exists(null);
        return canScan
            ? (() => {
                const items = [];
                const enumerator = tryOrNull('scanThemeDirectory.enumerate', () =>
                    dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null)
                );
                return enumerator
                    ? (() => {
                        let fileInfo;
                        while ((fileInfo = enumerator.next_file(null)) !== null) {
                            const name = fileInfo.get_name();
                            !name.startsWith('.git') && (
                                items.push(name.toLowerCase()),
                                fileInfo.get_file_type() === Gio.FileType.DIRECTORY
                                    && items.push(...this.scanThemeDirectory(GLib.build_filenamev([dirPath, name]), depth + 1, maxDepth))
                            );
                        }
                        enumerator.close(null);
                        return items;
                    })()
                    : items;
            })()
            : [];
    }
}

export function applyThemeContextMenuViewPackagesRiceDepthDetection(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewPackagesRiceDepthDetection.prototype);
}
