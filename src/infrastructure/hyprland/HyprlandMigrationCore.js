import { HYPRLAND_FUTURE_PARAMS, HYPRLAND_MIGRATIONS } from './HyprlandMigrationMaps.js';

function toParamsMap(parameters) {
    if (parameters instanceof Map) {
        return parameters;
    }
    return new Map(Object.entries(parameters ?? {}));
}

function getInfoValue(info) {
    return typeof info === 'object' ? info.value : info;
}

export function applyHyprlandMigrationCore(targetPrototype) {
    targetPrototype.migrate = function(parameters, userVersion = null) {
        const version = userVersion || this.detectUserVersion(),
            result = new Map(),
            paramsMap = toParamsMap(parameters),
            processedPaths = new Set();

        let markProcessed = (...paths) => paths.filter(Boolean).forEach((path) => processedPaths.add(path));

        const applyLegacyMigration = (path, value) => {
            let legacyMigration = HYPRLAND_MIGRATIONS[path],
                canMigrate = legacyMigration && this.isVersionAtLeast(version, legacyMigration.version);
            if (!canMigrate) return false;

            if (legacyMigration.action === 'removed') {
                this.log(`Skipping removed parameter: ${path} (removed in ${legacyMigration.version})`);
                markProcessed(path);
                return true;
            }

            let canMove = (legacyMigration.action === 'moved' || legacyMigration.action === 'renamed')
                && !!legacyMigration.newPath;
            if (canMove) {
                this.log(`Migrating ${path} -> ${legacyMigration.newPath}`);
                result.set(legacyMigration.newPath, this.transformValue(value, legacyMigration.transform));
                markProcessed(path, legacyMigration.newPath);
                return true;
            }

            return false;
        };

        const applyFutureMigration = (path, value) => {
            let futureMigration = HYPRLAND_FUTURE_PARAMS[path],
                canDowngrade = futureMigration && !this.isVersionAtLeast(version, futureMigration.minVersion);
            if (!canDowngrade) return false;

            if (futureMigration.action === 'disable') {
                this.log(`Skipping unsupported parameter: ${path} (requires ${futureMigration.minVersion}+)`);
                markProcessed(path);
                return true;
            }

            let canRename = futureMigration.action === 'rename' && !!futureMigration.oldPath;
            if (canRename) {
                this.log(`Downgrading ${path} -> ${futureMigration.oldPath}`);
                result.set(futureMigration.oldPath, this.transformValue(value, futureMigration.transform));
                markProcessed(path, futureMigration.oldPath);
                return true;
            }

            return false;
        };

        for (const [path, info] of paramsMap) {
            let value = getInfoValue(info),
                handled = processedPaths.has(path)
                    || applyLegacyMigration(path, value)
                    || applyFutureMigration(path, value);
            if (!handled) {
                result.set(path, value);
                markProcessed(path);
            }
        }

        return result;
    };

    targetPrototype.getMigrations = function() {
        return HYPRLAND_MIGRATIONS;
    };

    targetPrototype.getFutureMigrations = function() {
        return HYPRLAND_FUTURE_PARAMS;
    };

    targetPrototype.getMigrationForPath = function(path) {
        return HYPRLAND_MIGRATIONS[path] || HYPRLAND_FUTURE_PARAMS[path] || null;
    };
}
