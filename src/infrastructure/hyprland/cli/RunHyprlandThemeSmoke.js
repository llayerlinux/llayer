#!/usr/bin/env gjs -m

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import System from 'system';

import { MODULES } from '../../../app/AppModules.js';
import { applyAppInitialization } from '../../../app/AppInitialization.js';
import { auditThemeAssets } from '../ThemeAssetSmokeAudit.js';

class SmokeApp {
    constructor() {
        this.initialized = false;
        this.container = new MODULES.DIContainer();
        this.eventBus = new MODULES.EventBusClass();
        this.eventBus.Events = MODULES.Events;
        this.notifier = null;
        this.settingsManager = null;
    }
}

applyAppInitialization(SmokeApp.prototype);

function parseArgs(argv) {
    const args = {
        themes: [],
        reportPath: `${GLib.get_home_dir()}/.cache/lastlayer-hyprland-smoke-report.json`,
        maxFixPasses: 2,
        clearSkipList: true,
        fix: true
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
            case '--max-fix-passes':
                args.maxFixPasses = Math.max(0, parseInt(argv[i + 1] || '2', 10) || 0);
                i++;
                break;
            case '--preserve-skip-list':
                args.clearSkipList = false;
                break;
            case '--no-fix':
                args.fix = false;
                break;
            case '--help':
            case '-h':
                print([
                    'Usage:',
                    '  gjs -m RunHyprlandThemeSmoke.js [--theme <name>] [--report <path>]',
                    '                                   [--max-fix-passes <n>] [--preserve-skip-list] [--no-fix]'
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

const APPLY_STATUS_PATH = `${GLib.get_home_dir()}/.cache/lastlayer-apply-status.env`;
const APPLY_TRACE_PATH = `${GLib.get_home_dir()}/.cache/lastlayer-apply-trace.log`;
const SWITCH_THEME_LOG_PATH = `${GLib.get_home_dir()}/.cache/switch_theme.log`;

function readTextFile(path) {
    try {
        const [ok, contents] = GLib.file_get_contents(path);
        return ok && contents ? new TextDecoder('utf-8').decode(contents) : '';
    } catch (_error) {
        return '';
    }
}

function tailText(text, maxLines = 80) {
    return String(text || '')
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-maxLines);
}

function tailFile(path, maxLines = 80) {
    return tailText(readTextFile(path), maxLines);
}

function removeFileIfExists(path) {
    try {
        GLib.file_test(path, GLib.FileTest.EXISTS) && Gio.File.new_for_path(path).delete(null);
    } catch (_error) {
    }
}

function parseKeyValueFile(path) {
    const parsed = {};
    const text = readTextFile(path);
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex <= 0) continue;
        parsed[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1);
    }
    return parsed;
}

function stripInlineComment(line) {
    return String(line || '').replace(/\s+#.*$/, '').trim();
}

function listThemeConfigFiles(themePath) {
    const files = [
        `${themePath}/theme.conf`,
        `${themePath}/hyprland.conf`,
        `${themePath}/hyprland/keybinds.conf`,
        `${themePath}/hyprland/lastlayer.conf`,
        `${themePath}/hyprland/execs.conf`
    ];
    const hyprDir = `${themePath}/hyprland`;

    if (GLib.file_test(hyprDir, GLib.FileTest.IS_DIR)) {
        try {
            const dir = Gio.File.new_for_path(hyprDir);
            const enumerator = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                if (info.get_file_type() !== Gio.FileType.REGULAR) continue;
                const name = info.get_name();
                name.endsWith('.conf') && files.push(`${hyprDir}/${name}`);
            }
            enumerator.close(null);
        } catch (_error) {
        }
    }

    return Array.from(new Set(files.filter((path) => GLib.file_test(path, GLib.FileTest.EXISTS))));
}

function collectThemeVariables(themePath) {
    const variables = {
        HOME: GLib.get_home_dir()
    };

    for (const filePath of listThemeConfigFiles(themePath)) {
        const text = readTextFile(filePath);
        for (const rawLine of text.split(/\r?\n/)) {
            const line = stripInlineComment(rawLine);
            const match = line.match(/^\s*\$([A-Za-z0-9_]+)\s*=\s*(.+)\s*$/);
            if (!match) continue;
            variables[match[1]] = match[2].trim();
        }
    }

    return variables;
}

function expandThemeVariables(value, variables) {
    let output = String(value || '').trim();

    for (let pass = 0; pass < 8; pass++) {
        const previous = output;
        for (const [name, replacement] of Object.entries(variables || {})) {
            output = output.replace(new RegExp(`\\$${name}(?=[^A-Za-z0-9_]|$)`, 'g'), String(replacement));
        }
        output = output.replace(/\$HOME(?=[^A-Za-z0-9_]|$)/g, GLib.get_home_dir());
        output.startsWith('~/') && (output = `${GLib.get_home_dir()}/${output.slice(2)}`);
        if (output === previous) break;
    }

    return output;
}

function resolveMenuBinding(themePath) {
    const variables = collectThemeVariables(themePath);
    const candidates = [
        `${themePath}/hyprland/keybinds.conf`,
        `${themePath}/hyprland/lastlayer.conf`,
        `${themePath}/hyprland.conf`
    ];

    for (const filePath of candidates) {
        if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) continue;
        const text = readTextFile(filePath);
        for (const rawLine of text.split(/\r?\n/)) {
            const line = stripInlineComment(rawLine);
            const match = line.match(/^bind\w*\s*=\s*([^,]+),\s*([^,]+),\s*exec,\s*(.+)$/i);
            if (!match) continue;
            const modifiers = match[1].trim();
            const key = match[2].trim();
            if (!/super|\$mainmod/i.test(modifiers) || !/^return$/i.test(key)) continue;
            const rawCommand = match[3].trim();
            return {
                file: filePath,
                modifiers,
                key,
                rawCommand,
                resolvedCommand: expandThemeVariables(rawCommand, variables)
            };
        }
    }

    return null;
}

function detectThemeDir(themePath, relativePaths = []) {
    for (const relativePath of relativePaths) {
        const candidate = `${themePath}/${relativePath}`;
        if (GLib.file_test(candidate, GLib.FileTest.IS_DIR)) {
            return candidate;
        }
    }
    return null;
}

function detectExpectedRuntimes(themePath) {
    const configText = [
        ...listThemeConfigFiles(themePath).map(readTextFile),
        readTextFile(`${themePath}/autostart`)
    ].join('\n').toLowerCase();
    const expected = [];
    const agsDir = detectThemeDir(themePath, ['ags', 'config/ags', 'components/ags', 'base/ags']);
    const ewwDir = detectThemeDir(themePath, ['eww', 'config/eww']);
    const waybarDir = detectThemeDir(themePath, ['waybar', 'config/waybar', 'component/waybar']);

    if (waybarDir && /\bwaybar\b/.test(configText)) expected.push('waybar');
    if (ewwDir && /\beww\b/.test(configText)) expected.push('eww');
    if (agsDir && /\bagsv1\b|\bags-1\.8\.2\b/.test(configText)) {
        expected.push('agsv1');
    } else if (agsDir && /\bags\b|\bags-v2|\bags-2\./.test(configText)) {
        expected.push('ags');
    }

    return Array.from(new Set(expected));
}

function countProcess(command, hyprEnv) {
    const result = runCommand(['bash', '-lc', command], hyprEnv);
    return parseInt(result.stdout.trim(), 10) || 0;
}

function isRuntimeRunning(kind, hyprEnv) {
    switch (kind) {
        case 'waybar':
            return countProcess('pgrep -xc waybar || true', hyprEnv) > 0;
        case 'eww':
            return countProcess("pgrep -af '(^|/)eww(-real)?( |$)' | wc -l", hyprEnv) > 0;
        case 'agsv1':
            return countProcess("pgrep -af 'agsv1|agsv1-real|ags-1\\.8\\.2( |$)' | wc -l", hyprEnv) > 0;
        case 'ags':
            return countProcess("pgrep -af 'ags-real|ags-v2\\.3\\.0|ags-2\\.0\\.0|astal-gjs|/ags run -d ' | wc -l", hyprEnv) > 0;
        default:
            return false;
    }
}

function auditThemeRuntime(themePath, hyprEnv) {
    const expected = detectExpectedRuntimes(themePath);
    const running = Object.fromEntries(expected.map((kind) => [kind, isRuntimeRunning(kind, hyprEnv)]));
    return {
        expected,
        running,
        success: expected.every((kind) => running[kind] === true)
    };
}

function getCommandScriptPath(command) {
    const trimmed = String(command || '').trim();
    const bashMatch = trimmed.match(/^(?:bash|sh)\s+(.+)$/);
    const candidate = bashMatch ? bashMatch[1].trim() : trimmed.split(/\s+/)[0];
    return candidate.startsWith('~') || candidate.startsWith('/')
        ? expandThemeVariables(candidate, {HOME: GLib.get_home_dir()})
        : '';
}

function detectMenuCommandType(command, scriptContents = '') {
    const value = `${String(command || '')}\n${String(scriptContents || '')}`.toLowerCase();
    switch (true) {
        case value.includes('rofi'):
            return 'rofi';
        case value.includes('wofi'):
            return 'wofi';
        case value.includes('fuzzel'):
            return 'fuzzel';
        case value.includes('astal request')
            || value.includes('.local/bin/astal')
            || value.includes('ags request')
            || value.includes('agsv1')
            || value.includes('toggle_settings'):
            return 'ags';
        default:
            return 'command';
    }
}

function auditThemeMenuLauncher(themePath, hyprEnv) {
    const binding = resolveMenuBinding(themePath);
    if (!binding) {
        return {
            success: false,
            error: 'Super+Return launcher binding not found',
            binding: null
        };
    }

    const scriptPath = getCommandScriptPath(binding.resolvedCommand);
    const scriptContents = scriptPath && GLib.file_test(scriptPath, GLib.FileTest.EXISTS)
        ? readTextFile(scriptPath)
        : '';
    const type = detectMenuCommandType(binding.resolvedCommand, scriptContents);
    const missingDependencies = [];

    if (scriptPath && !GLib.file_test(scriptPath, GLib.FileTest.EXISTS)) {
        missingDependencies.push(`missing-script:${scriptPath}`);
    }

    switch (type) {
        case 'rofi':
            runCommand(['bash', '-lc', 'command -v rofi >/dev/null 2>&1'], hyprEnv).status === 0
                || missingDependencies.push('missing-binary:rofi');
            break;
        case 'wofi':
            runCommand(['bash', '-lc', 'command -v wofi >/dev/null 2>&1'], hyprEnv).status === 0
                || missingDependencies.push('missing-binary:wofi');
            break;
        case 'fuzzel':
            runCommand(['bash', '-lc', 'command -v fuzzel >/dev/null 2>&1'], hyprEnv).status === 0
                || missingDependencies.push('missing-binary:fuzzel');
            break;
        case 'ags':
            runCommand(['bash', '-lc', 'command -v ags >/dev/null 2>&1 || command -v agsv1 >/dev/null 2>&1 || command -v astal >/dev/null 2>&1 || [ -x "$HOME/.local/bin/ags" ] || [ -x "$HOME/.local/bin/agsv1" ] || [ -x "$HOME/.local/bin/astal" ]'], hyprEnv).status === 0
                || missingDependencies.push('missing-binary:ags');
            break;
    }

    let launchResult = {status: -1, stdout: '', stderr: ''};
    let launchSuccess = missingDependencies.length === 0;

    if (launchSuccess) {
        switch (type) {
            case 'rofi': {
                const before = countProcess('pgrep -xc rofi || true', hyprEnv);
                launchResult = runCommand(['bash', '-lc', `timeout 2s ${binding.resolvedCommand}`], hyprEnv);
                const after = countProcess('pgrep -xc rofi || true', hyprEnv);
                launchSuccess = launchResult.exitCode === 0 || launchResult.exitCode === 124 || after > before || after > 0;
                runCommand(['bash', '-lc', 'pkill -TERM -x rofi >/dev/null 2>&1 || true'], hyprEnv);
                break;
            }
            case 'wofi': {
                const before = countProcess('pgrep -xc wofi || true', hyprEnv);
                launchResult = runCommand(['bash', '-lc', `timeout 2s ${binding.resolvedCommand}`], hyprEnv);
                const after = countProcess('pgrep -xc wofi || true', hyprEnv);
                launchSuccess = launchResult.exitCode === 0 || launchResult.exitCode === 124 || after > before || after > 0;
                runCommand(['bash', '-lc', 'pkill -TERM -x wofi >/dev/null 2>&1 || true'], hyprEnv);
                break;
            }
            case 'fuzzel': {
                const before = countProcess('pgrep -xc fuzzel || true', hyprEnv);
                launchResult = runCommand(['bash', '-lc', `timeout 2s ${binding.resolvedCommand}`], hyprEnv);
                const after = countProcess('pgrep -xc fuzzel || true', hyprEnv);
                launchSuccess = launchResult.exitCode === 0 || launchResult.exitCode === 124 || after > before || after > 0;
                runCommand(['bash', '-lc', 'pkill -TERM -x fuzzel >/dev/null 2>&1 || true'], hyprEnv);
                break;
            }
            default:
                launchResult = runCommand(['bash', '-lc', binding.resolvedCommand], hyprEnv);
                launchSuccess = launchResult.exitCode === 0;
                break;
        }
    }

    return {
        success: launchSuccess,
        binding,
        type,
        scriptPath: scriptPath || null,
        missingDependencies,
        launchStatus: launchResult.exitCode,
        launchStdout: tailText(launchResult.stdout, 12),
        launchStderr: tailText(launchResult.stderr, 12)
    };
}

function collectStageFailures(status = {}) {
    return Object.entries(status)
        .filter(([key, value]) => key.endsWith('_RC') && String(value) !== '0')
        .map(([key, value]) => ({stage: key.replace(/_RC$/, ''), rc: Number(value)}));
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

function backupSettings(settingsManager) {
    const settingsPath = settingsManager?.settingsPath;
    if (!settingsPath || !GLib.file_test(settingsPath, GLib.FileTest.EXISTS))
        return null;

    const backupPath = `${settingsPath}.smoke-backup-${Date.now()}`;
    Gio.File.new_for_path(settingsPath).copy(
        Gio.File.new_for_path(backupPath),
        Gio.FileCopyFlags.OVERWRITE,
        null,
        null
    );
    return backupPath;
}

function clearSkipInstallList(settingsManager) {
    settingsManager.set('skip_install_theme_apps', []);
    settingsManager.write(null, {silent: true});
}

async function applyThemeSync(applyThemeUseCase, themeName) {
    return await applyThemeUseCase.execute(themeName, {
        source: 'hyprland-smoke',
        sync: true,
        sanitizeConfigErrors: false
    });
}

async function processTheme({theme, applyThemeUseCase, hyprEnv, configGenerator, maxFixPasses, fix}) {
    const report = {
        theme: theme.name,
        path: theme.path,
        applySuccess: false,
        passes: [],
        finalErrorCount: null,
        finalErrors: [],
        applyStatus: null,
        stageFailures: [],
        runtimeAudit: null,
        menuAudit: null,
        applyTraceTail: [],
        switchThemeLogTail: [],
        assetAudit: null,
        success: false
    };

    const finalizeReport = (passReport) => {
        report.applyStatus = parseKeyValueFile(APPLY_STATUS_PATH);
        report.stageFailures = collectStageFailures(report.applyStatus);
        report.runtimeAudit = auditThemeRuntime(theme.path, hyprEnv);
        report.menuAudit = auditThemeMenuLauncher(theme.path, hyprEnv);
        report.applyTraceTail = tailFile(APPLY_TRACE_PATH, 120);
        report.switchThemeLogTail = tailFile(SWITCH_THEME_LOG_PATH, 120);
        report.finalErrorCount = passReport.uniqueErrorCount;
        report.finalErrors = passReport.errors;
        report.assetAudit = auditThemeAssets(theme.path);
        report.success = passReport.applySuccess
            && passReport.uniqueErrorCount === 0
            && report.stageFailures.length === 0
            && report.runtimeAudit.success
            && report.menuAudit.success;
        return report;
    };

    for (let pass = 0; pass <= maxFixPasses; pass++) {
        if (pass > 0 && fix) {
            configGenerator.generateThemeForCurrentVersion(theme.path, {
                skipIfFresh: false,
                writeMetadata: true
            });
        }

        removeFileIfExists(APPLY_STATUS_PATH);
        removeFileIfExists(APPLY_TRACE_PATH);
        const applyResult = await applyThemeSync(applyThemeUseCase, theme.name);
        await sleep(600);
        const errors = collectConfigErrors(hyprEnv);

        const passReport = {
            pass,
            applySuccess: applyResult?.success === true,
            applyMessages: Array.isArray(applyResult?.messages) ? [...applyResult.messages] : [],
            applyErrors: Array.isArray(applyResult?.errors) ? [...applyResult.errors] : [],
            rawErrorCount: Array.isArray(errors.raw) ? errors.raw.length : 0,
            uniqueErrorCount: Array.isArray(errors.unique) ? errors.unique.length : 0,
            errors: (errors.unique || []).map((item) => ({
                file: item.rootFile,
                line: item.rootLine,
                message: item.rootMessage
            }))
        };
        report.passes.push(passReport);
        report.applySuccess = passReport.applySuccess;

        if (passReport.uniqueErrorCount === 0)
            return finalizeReport(passReport);

        if (!fix || pass === maxFixPasses)
            return finalizeReport(passReport);
    }

    return report;
}

async function main(argv) {
    const args = parseArgs(argv);
    const hyprEnv = detectHyprlandEnvironment();

    const app = new SmokeApp();
    await app.initialize({skipGtk: true});

    const settingsService = app.container.get('settingsService');
    const settingsManager = app.settingsManager;
    const themeRepository = app.container.get('themeRepository');
    const applyThemeUseCase = app.container.get('applyThemeUseCase');
    const hyprlandParameterService = app.container.get('hyprlandParameterService');
    const configGenerator = hyprlandParameterService?.configGenerator;

    if (!settingsService || !themeRepository || !applyThemeUseCase || !configGenerator)
        throw new Error('Smoke runner failed to initialize required services');

    const settingsBackup = backupSettings(settingsManager);
    args.clearSkipList && clearSkipInstallList(settingsManager);

    const themes = await loadThemes(themeRepository, args.themes);
    const report = {
        generatedAt: new Date().toISOString(),
        hyprlandEnv: hyprEnv,
        settingsBackup,
        skipListCleared: args.clearSkipList,
        maxFixPasses: args.maxFixPasses,
        themes: [],
        success: true
    };

    for (const theme of themes) {
        const themeReport = await processTheme({
            theme,
            applyThemeUseCase,
            hyprEnv,
            configGenerator,
            maxFixPasses: args.maxFixPasses,
            fix: args.fix
        });
        report.themes.push(themeReport);
        if (!themeReport.success
            || themeReport.finalErrorCount !== 0
            || themeReport.assetAudit?.success === false)
            report.success = false;
    }

    writeJson(args.reportPath, report);
    print(JSON.stringify(report, null, 2));
    return report.success ? 0 : 1;
}

System.exit(await main(ARGV));
