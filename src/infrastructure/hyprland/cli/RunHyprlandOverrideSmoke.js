#!/usr/bin/env gjs -m

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import System from 'system';

import { MODULES } from '../../../app/AppModules.js';
import { applyAppInitialization } from '../../../app/AppInitialization.js';

class OverrideSmokeApp {
    constructor() {
        this.initialized = false;
        this.container = new MODULES.DIContainer();
        this.eventBus = new MODULES.EventBusClass();
        this.eventBus.Events = MODULES.Events;
        this.notifier = null;
        this.settingsManager = null;
    }
}

applyAppInitialization(OverrideSmokeApp.prototype);

const APPLY_STATUS_PATH = `${GLib.get_home_dir()}/.cache/lastlayer-apply-status.env`;
const APPLY_TRACE_PATH = `${GLib.get_home_dir()}/.cache/lastlayer-apply-trace.log`;

function parseArgs(argv) {
    const args = {
        themes: [],
        reportPath: `${GLib.get_home_dir()}/.cache/lastlayer-hyprland-override-smoke.json`
    };

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        switch (token) {
            case '--theme':
                argv[i + 1] && args.themes.push(argv[++i]);
                break;
            case '--report':
                args.reportPath = argv[i + 1] || args.reportPath;
                i++;
                break;
            case '--help':
            case '-h':
                print([
                    'Usage:',
                    '  gjs -m RunHyprlandOverrideSmoke.js [--theme <name>] [--report <path>]'
                ].join('\n'));
                System.exit(0);
                break;
        }
    }

    return args;
}

function getEnvMap(overrides = {}) {
    const env = {};
    for (const key of GLib.listenv()) {
        env[key] = GLib.getenv(key);
    }
    return {...env, ...overrides};
}

function envToEnvp(env) {
    return Object.entries(env)
        .filter(([key, value]) => typeof key === 'string' && key.length > 0 && typeof value === 'string')
        .map(([key, value]) => `${key}=${value}`);
}

function runCommand(argv, overrides = {}) {
    const envp = envToEnvp(getEnvMap(overrides));
    const [ok, stdout, stderr, status] = GLib.spawn_sync(
        null,
        argv,
        envp,
        GLib.SpawnFlags.SEARCH_PATH,
        null
    );

    return {
        ok,
        status,
        exitCode: status === 0 ? 0 : (status >> 8),
        stdout: stdout ? new TextDecoder('utf-8').decode(stdout) : '',
        stderr: stderr ? new TextDecoder('utf-8').decode(stderr) : ''
    };
}

function detectHyprlandEnvironment() {
    const instancesResult = runCommand(['hyprctl', 'instances', '-j']);
    if (!instancesResult.ok || instancesResult.status !== 0)
        throw new Error(`Failed to detect Hyprland instances: ${instancesResult.stderr || instancesResult.stdout}`);

    const instances = JSON.parse(instancesResult.stdout || '[]');
    if (!Array.isArray(instances) || instances.length === 0)
        throw new Error('No active Hyprland instance found');

    const [instance] = instances;
    const runtimeDir = GLib.getenv('XDG_RUNTIME_DIR') || '/run/user/1000';
    const env = {
        XDG_RUNTIME_DIR: runtimeDir,
        HYPRLAND_INSTANCE_SIGNATURE: instance.instance
    };

    typeof instance.wl_socket === 'string' && instance.wl_socket.length > 0
        && (env.WAYLAND_DISPLAY = instance.wl_socket);
    !GLib.getenv('DBUS_SESSION_BUS_ADDRESS')
        && (env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${runtimeDir}/bus`);

    for (const [key, value] of Object.entries(env)) {
        GLib.setenv(key, value, true);
    }

    return env;
}

function parseSingleConfigError(text) {
    const pattern = /^Config error in file (.+?) at line (\d+):\s*(.*)$/;
    const trimmed = String(text || '').trim();
    const match = trimmed.match(pattern);
    if (!match) {
        return {
            raw: trimmed,
            file: null,
            line: null,
            message: trimmed,
            rootFile: null,
            rootLine: null,
            rootMessage: trimmed
        };
    }

    const [, file, lineText, remainder] = match;
    const nested = remainder.startsWith('Config error in file ')
        ? parseSingleConfigError(remainder)
        : null;

    return {
        raw: trimmed,
        file: file.trim(),
        line: parseInt(lineText, 10),
        message: remainder.trim(),
        rootFile: nested?.rootFile || file.trim(),
        rootLine: nested?.rootLine || parseInt(lineText, 10),
        rootMessage: nested?.rootMessage || remainder.trim()
    };
}

function collectConfigErrors(hyprEnv) {
    const result = runCommand(['hyprctl', '-j', 'configerrors'], hyprEnv);
    if (!result.ok || result.status !== 0) {
        return {
            raw: [],
            parsed: [],
            unique: [],
            error: result.stderr || result.stdout || 'hyprctl configerrors failed'
        };
    }

    let rawErrors = [];
    try {
        rawErrors = JSON.parse(result.stdout || '[]');
    } catch (error) {
        return {
            raw: [],
            parsed: [],
            unique: [],
            error: `Failed to parse hyprctl configerrors JSON: ${error.message}`
        };
    }

    rawErrors = Array.isArray(rawErrors)
        ? rawErrors.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean)
        : [];

    const parsed = rawErrors.map(parseSingleConfigError);
    const uniqueMap = new Map();
    for (const item of parsed) {
        const key = `${item.rootFile || ''}:${item.rootLine || ''}:${item.rootMessage || item.message || item.raw}`;
        uniqueMap.has(key) || uniqueMap.set(key, item);
    }

    return {
        raw: rawErrors,
        parsed,
        unique: Array.from(uniqueMap.values()),
        error: null
    };
}

function writeJson(path, payload) {
    const parent = GLib.path_get_dirname(path);
    GLib.mkdir_with_parents(parent, parseInt('0755', 8));
    GLib.file_set_contents(path, JSON.stringify(payload, null, 2));
}

function sleep(ms) {
    return new Promise((resolve) => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

function parseKeyValueFile(path) {
    const parsed = {};
    try {
        if (!GLib.file_test(path, GLib.FileTest.EXISTS))
            return parsed;
        const [ok, contents] = GLib.file_get_contents(path);
        if (!ok || !contents)
            return parsed;
        const text = new TextDecoder('utf-8').decode(contents);
        for (const line of text.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            const separatorIndex = trimmed.indexOf('=');
            if (separatorIndex <= 0)
                continue;
            parsed[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1);
        }
    } catch (_error) {
    }
    return parsed;
}

function readTextFile(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok && bytes ? new TextDecoder('utf-8').decode(bytes) : null;
    } catch (_error) {
        return null;
    }
}

function restoreTextFile(path, contents) {
    contents === null
        ? (GLib.file_test(path, GLib.FileTest.EXISTS) && Gio.File.new_for_path(path).delete(null))
        : GLib.file_set_contents(path, contents);
}

function isThemeEligible(theme) {
    return Boolean(
        theme?.name &&
        !String(theme.name).startsWith('.') &&
        String(theme.name) !== '.restore_points' &&
        (GLib.file_test(`${theme.path}/hyprland.conf`, GLib.FileTest.EXISTS)
            || GLib.file_test(`${theme.path}/hyprland`, GLib.FileTest.IS_DIR))
    );
}

async function loadThemes(themeRepository, requestedThemes = []) {
    const allThemes = await themeRepository.getLocalThemes();
    const eligibleThemes = allThemes.filter(isThemeEligible).sort((left, right) => left.name.localeCompare(right.name));

    if (requestedThemes.length === 0)
        return eligibleThemes;

    const requested = new Set(requestedThemes);
    return eligibleThemes.filter((theme) => requested.has(theme.name));
}

async function applyThemeSync(applyThemeUseCase, themeName) {
    return await applyThemeUseCase.execute(themeName, {
        source: 'hyprland-override-smoke',
        sync: true,
        sanitizeConfigErrors: false
    });
}

const OVERRIDE_CANDIDATE_PATHS = [
    'general:gaps_in',
    'general:gaps_out',
    'decoration:rounding',
    'input:sensitivity',
    'misc:disable_hyprland_logo',
    'general:layout'
];

function clampNumeric(value, min, max) {
    let next = Number(value);
    typeof min === 'number' && Number.isFinite(min) && next < min && (next = min);
    typeof max === 'number' && Number.isFinite(max) && next > max && (next = max);
    return next;
}

function chooseOverrideValue(parameter, currentValue) {
    const type = parameter?.type || 'str';
    const current = typeof currentValue === 'string'
        ? currentValue.trim()
        : String(currentValue ?? parameter?.default ?? '').trim();

    switch (type) {
        case 'int': {
            const parsed = Number.parseInt(current || String(parameter?.default ?? '0'), 10);
            const next = clampNumeric((Number.isFinite(parsed) ? parsed : 0) + 2, parameter?.min, parameter?.max);
            return String(Math.trunc(next));
        }
        case 'float': {
            const parsed = Number.parseFloat(current || String(parameter?.default ?? '0'));
            const next = clampNumeric((Number.isFinite(parsed) ? parsed : 0) + 0.15, parameter?.min, parameter?.max);
            return String(Number(next).toFixed(2));
        }
        case 'bool':
            return ['1', 'true', 'yes', 'on'].includes(current.toLowerCase()) ? 'false' : 'true';
        case 'str': {
            const options = Array.isArray(parameter?.options)
                ? parameter.options.map((value) => String(value))
                : [];
            if (options.length > 0) {
                return options.find((option) => option !== current) || options[0];
            }
            if (parameter?.fullPath === 'general:layout')
                return current === 'master' ? 'dwindle' : 'master';
            return current || String(parameter?.default ?? '');
        }
        default:
            return null;
    }
}

function buildOverrideSamples(parameterService, originals = {}) {
    const samples = [];

    for (const path of OVERRIDE_CANDIDATE_PATHS) {
        const parameter = parameterService.getParameter(path);
        if (!parameter)
            continue;

        if (!Object.prototype.hasOwnProperty.call(originals, path))
            continue;

        const currentValue = originals[path];
        const expectedValue = chooseOverrideValue(parameter, currentValue);
        if (expectedValue == null || String(expectedValue) === String(currentValue ?? ''))
            continue;

        samples.push({
            path,
            type: parameter.type,
            currentValue: currentValue ?? null,
            expectedValue
        });
    }

    return samples;
}

function normalizeExpectedValue(sample) {
    switch (sample.type) {
        case 'int':
            return Number.parseInt(sample.expectedValue, 10);
        case 'float':
            return Number.parseFloat(sample.expectedValue);
        case 'bool':
            return ['1', 'true', 'yes', 'on'].includes(String(sample.expectedValue).toLowerCase());
        default:
            return String(sample.expectedValue).trim();
    }
}

function extractComparableValue(sample, payload) {
    if (!payload || typeof payload !== 'object')
        return null;

    switch (sample.type) {
        case 'int': {
            if (typeof payload.int === 'number')
                return payload.int;

            const stringCandidate = typeof payload.str === 'string' && payload.str !== '[[EMPTY]]'
                ? payload.str
                : (typeof payload.custom === 'string' && payload.custom !== '[[EMPTY]]'
                    ? payload.custom
                    : '');
            const firstToken = String(stringCandidate).trim().split(/\s+/)[0] || '';
            const parsed = Number.parseInt(firstToken, 10);
            return Number.isFinite(parsed) ? parsed : null;
        }
        case 'float':
            return typeof payload.float === 'number'
                ? payload.float
                : (typeof payload.int === 'number'
                    ? Number(payload.int)
                    : Number.parseFloat(String(payload.str ?? '')));
        case 'bool':
            return typeof payload.int === 'number'
                ? payload.int !== 0
                : (typeof payload.set === 'boolean'
                    ? payload.set
                    : ['1', 'true', 'yes', 'on'].includes(String(payload.str ?? '').toLowerCase()));
        default:
            if (typeof payload.str === 'string' && payload.str !== '[[EMPTY]]')
                return payload.str.trim();
            if (typeof payload.custom === 'string' && payload.custom !== '[[EMPTY]]')
                return payload.custom.trim();
            return null;
    }
}

function valuesMatch(sample, expected, actual) {
    if (expected == null || actual == null)
        return false;

    switch (sample.type) {
        case 'int':
            return Number(actual) === Number(expected);
        case 'float':
            return Math.abs(Number(actual) - Number(expected)) < 0.02;
        case 'bool':
            return Boolean(actual) === Boolean(expected);
        default:
            return String(actual).trim() === String(expected).trim();
    }
}

function readHyprctlOption(path, hyprEnv) {
    const result = runCommand(['hyprctl', 'getoption', path, '-j'], hyprEnv);
    if (!result.ok || result.status !== 0) {
        return {
            ok: false,
            error: result.stderr || result.stdout || 'hyprctl getoption failed',
            payload: null
        };
    }

    try {
        return {
            ok: true,
            error: null,
            payload: JSON.parse(result.stdout || '{}')
        };
    } catch (error) {
        return {
            ok: false,
            error: `Failed to parse hyprctl getoption JSON: ${error.message}`,
            payload: null
        };
    }
}

async function processTheme({theme, applyThemeUseCase, parameterService, settingsManager, hyprEnv}) {
    const overridePath = `${theme.path}/per_rice_hyprland.json`;
    const originalOverrideContents = readTextFile(overridePath);
    const originalOverrides = parameterService.getPerRiceOverrides(theme.path);
    const report = {
        theme: theme.name,
        path: theme.path,
        baselineApplySuccess: false,
        overrideApplySuccess: false,
        samples: [],
        configErrors: [],
        applyStatus: null,
        applyTraceTail: [],
        restored: false,
        success: false
    };

    const tailApplyTrace = () => {
        const text = readTextFile(APPLY_TRACE_PATH) || '';
        report.applyTraceTail = text.split(/\r?\n/).filter(Boolean).slice(-60);
    };

    try {
        let applyResult = await applyThemeSync(applyThemeUseCase, theme.name);
        report.baselineApplySuccess = applyResult?.success === true;
        if (!report.baselineApplySuccess) {
            report.applyStatus = parseKeyValueFile(APPLY_STATUS_PATH);
            tailApplyTrace();
            return report;
        }

        const originals = parameterService.parseThemeOriginals(theme.path);
        const samples = buildOverrideSamples(parameterService, originals);
        if (samples.length === 0) {
            report.success = false;
            report.error = 'no_safe_override_samples';
            return report;
        }

        const overrideMap = Object.fromEntries(samples.map((sample) => [sample.path, sample.expectedValue]));
        parameterService.savePerRiceOverrides(theme.path, {
            ...originalOverrides,
            ...overrideMap
        });
        parameterService.writeEffectiveOverrides(theme.path, settingsManager.getAll());

        applyResult = await applyThemeSync(applyThemeUseCase, theme.name);
        report.overrideApplySuccess = applyResult?.success === true;
        await sleep(700);

        const configErrors = collectConfigErrors(hyprEnv);
        report.configErrors = (configErrors.unique || []).map((item) => ({
            file: item.rootFile,
            line: item.rootLine,
            message: item.rootMessage
        }));

        for (const sample of samples) {
            const optionResult = readHyprctlOption(sample.path, hyprEnv);
            const expected = normalizeExpectedValue(sample);
            const actual = optionResult.ok ? extractComparableValue(sample, optionResult.payload) : null;

            report.samples.push({
                path: sample.path,
                type: sample.type,
                currentValue: sample.currentValue,
                expectedValue: sample.expectedValue,
                actualValue: actual,
                match: optionResult.ok && valuesMatch(sample, expected, actual),
                error: optionResult.error
            });
        }

        report.applyStatus = parseKeyValueFile(APPLY_STATUS_PATH);
        tailApplyTrace();
        report.success = report.overrideApplySuccess
            && report.configErrors.length === 0
            && report.samples.every((sample) => sample.match);
        return report;
    } finally {
        try {
            restoreTextFile(overridePath, originalOverrideContents);
            await applyThemeSync(applyThemeUseCase, theme.name);
            await sleep(300);
            report.restored = true;
        } catch (error) {
            report.restored = false;
            report.restoreError = error.message;
        }
    }
}

async function main(argv) {
    const args = parseArgs(argv);
    const hyprEnv = detectHyprlandEnvironment();

    const app = new OverrideSmokeApp();
    await app.initialize({skipGtk: true});

    const settingsManager = app.settingsManager;
    const themeRepository = app.container.get('themeRepository');
    const applyThemeUseCase = app.container.get('applyThemeUseCase');
    const parameterService = app.container.get('hyprlandParameterService');

    if (!settingsManager || !themeRepository || !applyThemeUseCase || !parameterService)
        throw new Error('Override smoke runner failed to initialize required services');

    const themes = await loadThemes(themeRepository, args.themes);
    const report = {
        generatedAt: new Date().toISOString(),
        hyprlandEnv: hyprEnv,
        themes: [],
        success: true
    };

    for (const theme of themes) {
        const themeReport = await processTheme({
            theme,
            applyThemeUseCase,
            parameterService,
            settingsManager,
            hyprEnv
        });
        report.themes.push(themeReport);
        themeReport.success || (report.success = false);
    }

    writeJson(args.reportPath, report);
    print(JSON.stringify(report, null, 2));
    return report.success ? 0 : 1;
}

System.exit(await main(ARGV));
