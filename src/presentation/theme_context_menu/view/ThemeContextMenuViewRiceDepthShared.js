import { isPlainObject } from '../../../infrastructure/utils/Utils.js';
import { RICE_LEVELS } from './ThemeContextMenuViewPackagesRiceDepthLevels.js';

function getRiceLevelDefaults(level) {
    const config = isPlainObject(RICE_LEVELS[level]) ? RICE_LEVELS[level] : null;
    return {
        code: typeof config?.code === 'string' ? config.code : `L${level}`,
        name: typeof config?.name === 'string' ? config.name : 'Unknown'
    };
}

function getRiceLevelEntry(levelData, level) {
    const entry = isPlainObject(levelData) ? levelData[level] : null;
    return isPlainObject(entry) ? entry : null;
}

function buildRiceIncludeLevelData(rawLevelData) {
    const levelData = {};

    for (const [rawLevel, rawData] of Object.entries(isPlainObject(rawLevelData) ? rawLevelData : {})) {
        const level = Number.parseInt(rawLevel, 10);
        Number.isFinite(level) && (() => {
            const defaults = getRiceLevelDefaults(level);
            const data = isPlainObject(rawData) ? rawData : {};

            levelData[level] = {
                code: typeof data.code === 'string' ? data.code : defaults.code,
                name: typeof data.name === 'string' ? data.name : defaults.name,
                filled: data.filled === true
            };
        })();
    }

    for (let level = 1; level <= 6; level++) {
        !levelData[level] && (() => {
            const defaults = getRiceLevelDefaults(level);
            levelData[level] = {
                code: defaults.code,
                name: defaults.name,
                filled: false
            };
        })();
    }

    return levelData;
}

function buildRiceLevelDataFromSearchText(searchText) {
    const normalizedText = typeof searchText === 'string' ? searchText.toLowerCase() : '',
          levelData = {};
    let maxLevel = 0;

    for (let level = 1; level <= 6; level++) {
        const config = RICE_LEVELS[level],
              foundPattern = config.patterns.find((pattern) => normalizedText.includes(pattern)) || null,
              foundApp = foundPattern ? foundPattern.charAt(0).toUpperCase() + foundPattern.slice(1) : null;

        levelData[level] = foundApp
            ? {code: config.code, name: foundApp, filled: true}
            : {code: config.code, name: config.name, filled: false};

        foundApp && level > maxLevel && (maxLevel = level);
    }

    for (let level = 1; level <= maxLevel; level++) {
        levelData[level].filled = true;
    }

    return {level: maxLevel || 1, levelData};
}

function collectRiceCandidate(target, value, {walkObjects = false} = {}) {
    if (Array.isArray(value)) {
        value.forEach((item) => collectRiceCandidate(target, item, {walkObjects}));
        return;
    }
    if (walkObjects && isPlainObject(value)) {
        Object.values(value).forEach((item) => collectRiceCandidate(target, item, {walkObjects}));
        return;
    }
    const normalized = value == null ? '' : String(value).toLowerCase().trim();
    normalized && target.push(normalized);
}

export {
    getRiceLevelDefaults,
    getRiceLevelEntry,
    buildRiceIncludeLevelData,
    buildRiceLevelDataFromSearchText,
    collectRiceCandidate
};
