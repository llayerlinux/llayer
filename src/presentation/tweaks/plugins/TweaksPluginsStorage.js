import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {COMMAND_BIN, DEFAULT_HYPRLAND_PLUGINS_REPO, PLUGIN_OPTION_PARSERS} from './TweaksPluginsConstants.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';

export const TweaksPluginsStorage = {
    readJsonFile(filePath) {
        if (!Gio.File.new_for_path(filePath).query_exists(null)) return {exists: false, value: null};
        let [ok, content] = GLib.file_get_contents(filePath);
        let value = ok
            ? tryOrNull('TweaksPluginsStorage.readJsonFile.parse', () => JSON.parse(new TextDecoder('utf-8').decode(content)))
            : null;
        return {exists: true, value};
    },

    writeJsonFile(filePath, data) {
        const json = JSON.stringify(data, null, 2);
        Gio.File.new_for_path(filePath).replace_contents(json, null, false, Gio.FileCreateFlags.NONE, null);
        return true;
    },

    loadPluginParametersFromFile() {
        const pluginParametersFilePath = this.getPluginParametersPath();
        const {exists, value} = this.readJsonFile(pluginParametersFilePath);
        if (exists) {
            value && (this.pluginParameters = value);
        } else {
            this.pluginParameters = {};
        }
    },

    writePluginParametersFile() {
        const pluginParametersFilePath = this.getPluginParametersPath();
        this.ensurePreferencesDir();
        return this.writeJsonFile(pluginParametersFilePath, this.pluginParameters);
    },

    writeCurrentPluginParameters(pluginName) {
        const parameters = this.getPluginParameters(pluginName);

        if (!parameters || parameters.length === 0) return true;

        const bucket = this.getPluginParamBucket(pluginName);

        parameters.forEach(param => {
            const currentValue = this.getPluginOption(pluginName, param.name, param.default);
            bucket[param.name] = currentValue;
        });

        return this.writePluginParametersFile();
    },

    restorePluginParameters(pluginName) {
        this.debugPluginParametersCache(`restore start ${pluginName}`);

        if (!this.pluginParameters?.[pluginName]) {
            this.debugPluginParametersCache(`no parameters for ${pluginName}`);
            return false;
        }

        const storedParams = this.pluginParameters?.[pluginName] ?? {};

        for (const [paramName, paramValue] of Object.entries(storedParams)) {
            if (paramValue === undefined || paramValue === null) continue;

            const fullParam = `plugin:${pluginName}:${paramName}`;
            this.execSyncCommand(`${COMMAND_BIN.HYPRCTL} keyword ${fullParam} ${paramValue}`);

            this.setPluginParam(pluginName, paramName, paramValue);
        }

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_MS, () => {
            this.debugPluginParametersCache(`restore complete ${pluginName}`);
            this.writePluginParametersFile();

            GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_QUICK_MS, () => {
                this.debugPluginParametersCache(`before UI update ${pluginName}`);
                this.updatePluginUI(pluginName);
                return GLib.SOURCE_REMOVE;
            });

            return GLib.SOURCE_REMOVE;
        });

        return true;
    },

    debugPluginParametersCache(context = '') {
        const logger = this.controller?.logger;
        const trackedPlugins = Object.keys(this.pluginParameters ?? {}).length;
        const customPlugins = Object.keys(this.customPluginParameters ?? {}).length;
        const logDebug = typeof logger?.debug === 'function' ? logger.debug.bind(logger) : null;
        logDebug?.(`[TweaksPluginsStorage] ${String(context || 'state')} tracked=${trackedPlugins} custom=${customPlugins}`);
    },

    loadCustomPluginParameters() {
        const customParametersFilePath = this.getCustomPluginParametersPath();
        const {exists, value} = this.readJsonFile(customParametersFilePath);
        if (exists) {
            value && (this.customPluginParameters = value);
        } else {
            this.customPluginParameters = {};
        }
    },

    writeCustomPluginParameters() {
        const customParametersFilePath = this.getCustomPluginParametersPath();
        this.ensurePreferencesDir();
        return this.writeJsonFile(customParametersFilePath, this.customPluginParameters);
    },

    getCustomParamBucket(pluginName) {
        this.customPluginParameters ||= {};
        this.customPluginParameters[pluginName] ||= {};
        return this.customPluginParameters[pluginName];
    },

    getCustomParam(pluginName, paramName) {
        return this.customPluginParameters?.[pluginName]?.[paramName] || null;
    },

    getPreferencesDir() {
        return `${GLib.get_user_config_dir()}/lastlayer_pref`;
    },

    ensurePreferencesDir() {
        const dir = Gio.File.new_for_path(this.getPreferencesDir());
        !dir.query_exists(null) && dir.make_directory_with_parents(null);
        return dir;
    },

    getPluginParametersPath() {
        return `${this.getPreferencesDir()}/plugin_parameters.json`;
    },

    getCustomPluginParametersPath() {
        return `${this.getPreferencesDir()}/custom_plugin_parameters.json`;
    },

    getPluginRepositoriesPath() {
        return `${this.getPreferencesDir()}/plugin_repositories.json`;
    },

    ensurePluginParameters() {
        this.pluginParameters ||= {};
        return this.pluginParameters;
    },

    getPluginParamBucket(pluginName) {
        const store = this.ensurePluginParameters();
        store[pluginName] ||= {};
        return store[pluginName];
    },

    getPluginParam(pluginName, paramName) {
        return this.pluginParameters?.[pluginName]?.[paramName];
    },

    setPluginParam(pluginName, paramName, value) {
        const bucket = this.getPluginParamBucket(pluginName);
        bucket[paramName] = value;
        return bucket[paramName];
    },

    removePluginParams(pluginName) {
        return this.pluginParameters?.[pluginName]
            ? (delete this.pluginParameters[pluginName], true)
            : false;
    },

    writeCustomParameterInfo(pluginName, paramName, info) {
        const bucket = this.getCustomParamBucket(pluginName);
        bucket[paramName] = info;
        return this.writeCustomPluginParameters();
    },

    removeCustomParameterInfo(pluginName, paramName) {
        const bucket = this.customPluginParameters?.[pluginName];
        const hasValue = bucket && Object.prototype.hasOwnProperty.call(bucket, paramName);
        if (hasValue) {
            delete bucket[paramName];
            Object.keys(bucket).length === 0 && delete this.customPluginParameters[pluginName];
            return this.writeCustomPluginParameters();
        }
        return false;
    },

    getPluginOption(pluginName, paramName, defaultValue = '') {
        const result = this.execSyncCommand(`${COMMAND_BIN.HYPRCTL} getoption plugin:${pluginName}:${paramName}`);
        if (!result || result.includes('no such option') || result.includes('Option plugin:')) return defaultValue;

        for (const [pattern, parse] of PLUGIN_OPTION_PARSERS) {
            const match = result.match(pattern);
            if (match) return parse(match);
        }

        return defaultValue;
    },

    setPluginOption(pluginName, paramName, value) {
        if (value == null) return;

        const isUnset = value === '' || value === 'unset',
            fullParam = `plugin:${pluginName}:${paramName}`;

        !isUnset && this.execSyncCommand(`${COMMAND_BIN.HYPRCTL} keyword ${fullParam} ${value}`);
        this.setPluginParam(pluginName, paramName, isUnset ? null : value);

        this.setPluginOption._writeDelayId && GLib.source_remove(this.setPluginOption._writeDelayId);
        this.setPluginOption._writeDelayId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.DEBOUNCE_MS, () => {
            this.writePluginParametersFile();
            this.setPluginOption._writeDelayId = null;
            return GLib.SOURCE_REMOVE;
        });
    },

    deletePluginParam(pluginName, paramName) {
        const bucket = this.pluginParameters?.[pluginName];
        if (!bucket || !(paramName in bucket)) return false;
        delete bucket[paramName];
        Object.keys(bucket).length === 0 && delete this.pluginParameters[pluginName];
        return true;
    },

    initRepositoriesData() {
        const reposPath = this.getPluginRepositoriesPath();
        const defaultRepo = DEFAULT_HYPRLAND_PLUGINS_REPO;
        const {value} = this.readJsonFile(reposPath);
        const repositories = Array.isArray(value) ? value : [];
        this.storedRepositories = repositories.length ? repositories : [defaultRepo];
    },

    writeRepositoriesFile() {
        const reposPath = this.getPluginRepositoriesPath();
        this.ensurePreferencesDir();
        const json = JSON.stringify(this.storedRepositories, null, 2);
        Gio.File.new_for_path(reposPath).replace_contents(json, null, false, Gio.FileCreateFlags.NONE, null);
    }
};
