import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

const TEXT_DECODER = new TextDecoder('utf-8');
const GENERIC_FONT_FAMILIES = new Set([
    'sans',
    'sans-serif',
    'serif',
    'monospace',
    'mono',
    'system-ui',
    'ui-sans-serif',
    'ui-serif',
    'ui-monospace',
    'emoji',
    'math',
    'fangsong',
    'fantasy',
    'cursive'
]);
const IGNORED_DIRECTORIES = new Set([
    '.git',
    '.cache',
    'backup',
    'backups',
    'build',
    'dist',
    'node_modules',
    'screenshots',
    'wallpapers'
]);
const IGNORED_FILE_SUFFIXES = ['.bak', '.orig', '.sample', '.example'];
const AUDITED_STYLE_PATHS = new Set([
    'theme.conf',
    'config/kitty/kitty.conf',
    'config/dunst/dunstrc',
    'config/rofi/config.rasi',
    'config/rofi/ultimate.rasi',
    'config/waybar/style.css',
    'config/waybar/style.scss',
    'config/swaync/style.css',
    'config/swaync/style.scss',
    'config/wofi/style.css',
    'config/wofi/style.scss',
    'config/eww/eww.css',
    'config/eww/eww.scss',
    'hyprland/hyprlock.conf',
    '.config/hypr/hyprlock.conf'
]);
const AUDITED_STYLE_PREFIXES = ['config/ags/', 'components/ags/', 'components/ags-'];
const FONT_STYLE_SUFFIXES = [
    'thin',
    'light',
    'regular',
    'medium',
    'semibold',
    'demibold',
    'bold',
    'black',
    'italic',
    'oblique',
    'condensed'
];

const fontAvailabilityCache = new Map();
let cachedInstalledIconThemes = null;

function getEnvMap() {
    const env = {};
    for (const key of GLib.listenv()) {
        env[key] = GLib.getenv(key);
    }
    return env;
}

function envToEnvp(env) {
    return Object.entries(env)
        .filter(([key, value]) => typeof key === 'string' && key.length > 0 && typeof value === 'string')
        .map(([key, value]) => `${key}=${value}`);
}

function runCommand(argv) {
    const [ok, stdout, stderr, status] = GLib.spawn_sync(
        null,
        argv,
        envToEnvp(getEnvMap()),
        GLib.SpawnFlags.SEARCH_PATH,
        null
    );

    return {
        ok,
        status,
        stdout: stdout ? TEXT_DECODER.decode(stdout) : '',
        stderr: stderr ? TEXT_DECODER.decode(stderr) : ''
    };
}

function canonicalizeRelativePath(path) {
    return String(path || '').replace(/\\/g, '/');
}

function shouldSkipDirectory(name) {
    return IGNORED_DIRECTORIES.has(String(name || '').toLowerCase());
}

function shouldSkipFile(name) {
    const lowerName = String(name || '').toLowerCase();
    return IGNORED_FILE_SUFFIXES.some((suffix) => lowerName.endsWith(suffix));
}

function shouldAuditFile(relativePath) {
    const path = canonicalizeRelativePath(relativePath);
    const lowerPath = path.toLowerCase();
    const fileName = GLib.path_get_basename(path).toLowerCase();
    if (AUDITED_STYLE_PATHS.has(lowerPath))
        return true;
    if (AUDITED_STYLE_PREFIXES.some((prefix) => lowerPath.startsWith(prefix)))
        return fileName.endsWith('.css') || fileName.endsWith('.scss');
    return false;
}

function walkAuditedFiles(basePath) {
    const files = [];

    function visit(directoryPath, relativePath = '') {
        const directory = Gio.File.new_for_path(directoryPath);
        if (!directory.query_exists(null))
            return;

        const enumerator = directory.enumerate_children(
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let info = null;
        while ((info = enumerator.next_file(null))) {
            const name = info.get_name();
            const childRelativePath = relativePath ? `${relativePath}/${name}` : name;
            const childPath = GLib.build_filenamev([directoryPath, name]);

            switch (info.get_file_type()) {
                case Gio.FileType.DIRECTORY:
                    shouldSkipDirectory(name) || visit(childPath, childRelativePath);
                    break;
                case Gio.FileType.REGULAR:
                    !shouldSkipFile(name) && shouldAuditFile(childRelativePath) && files.push({
                        absolutePath: childPath,
                        relativePath: canonicalizeRelativePath(childRelativePath)
                    });
                    break;
            }
        }

        tryRun('ThemeAssetSmokeAudit.walkAuditedFiles.close', () => enumerator.close(null));
    }

    visit(basePath);
    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function readTextFile(path) {
    return tryOrDefault('ThemeAssetSmokeAudit.readTextFile', () => {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? TEXT_DECODER.decode(bytes) : null;
    }, null);
}

function getLineNumber(text, index) {
    let line = 1;
    for (let cursor = 0; cursor < index; cursor++) {
        text[cursor] === '\n' && line++;
    }
    return line;
}

function splitList(value) {
    const items = [];
    let current = '';
    let quote = null;

    for (const character of String(value || '')) {
        switch (true) {
            case Boolean(quote):
                current += character;
                character === quote && (quote = null);
                break;
            case character === '\'' || character === '"':
                quote = character;
                current += character;
                break;
            case character === ',':
                current.trim().length > 0 && items.push(current.trim());
                current = '';
                break;
            default:
                current += character;
                break;
        }
    }

    current.trim().length > 0 && items.push(current.trim());
    return items;
}

function stripQuotes(value) {
    return String(value || '').trim().replace(/^['"]|['"]$/g, '').trim();
}

function cleanupFontValue(value) {
    let result = stripQuotes(value)
        .replace(/!important/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    result = result.replace(/^=\s*/, '').trim();
    result = result.replace(/\s+\d+(?:\.\d+)?(?:px|pt|rem|em|%)?$/i, '').trim();
    result = result.replace(/^-gtk-icon-theme:\s*/i, '').trim();

    return result;
}

function cleanupIconThemeValue(value) {
    return stripQuotes(value)
        .replace(/!important/gi, '')
        .replace(/[;{}]/g, '')
        .trim();
}

function isDynamicValue(value) {
    return /^\s*[$@]/.test(String(value || ''))
        || /\$\{|\bvar\s*\(|\bcalc\s*\(/i.test(String(value || ''));
}

function canonicalizeFontName(value) {
    return cleanupFontValue(value)
        .toLowerCase()
        .replace(/["']/g, '')
        .replace(/\bnerd\s*font\s*mono\b/gu, 'nerdfont')
        .replace(/\bnerd\s*font\b/gu, 'nerdfont')
        .replace(/\bnfm\b/gu, 'nerdfont')
        .replace(/\bnf\b/gu, 'nerdfont')
        .replace(/[^\p{L}\p{N}]+/gu, '');
}

function canonicalizeIconThemeName(value) {
    return cleanupIconThemeValue(value)
        .toLowerCase()
        .replace(/["']/g, '')
        .replace(/\s+/g, '');
}

function isGenericFontFamily(value) {
    const normalized = stripQuotes(value).toLowerCase().trim();
    return GENERIC_FONT_FAMILIES.has(normalized);
}

function buildFontMatchCandidates(value) {
    const initial = cleanupFontValue(value);
    if (!initial)
        return [];

    const candidates = new Set([initial]);
    let reduced = initial;

    while (true) {
        const parts = reduced.split(/\s+/).filter(Boolean);
        const lastPart = (parts[parts.length - 1] || '').toLowerCase();
        if (!FONT_STYLE_SUFFIXES.includes(lastPart) || parts.length < 2)
            break;
        parts.pop();
        reduced = parts.join(' ').trim();
        reduced && candidates.add(reduced);
    }

    return Array.from(candidates).filter(Boolean);
}

function queryResolvedFontFamily(value) {
    const cacheKey = String(value || '');
    if (fontAvailabilityCache.has(cacheKey))
        return fontAvailabilityCache.get(cacheKey);

    const result = runCommand(['fc-match', '-f', '%{family[0]}\n', cacheKey]);
    const payload = {
        available: false,
        resolvedFamily: '',
        toolingUnavailable: !(result.ok && result.status === 0)
    };

    if (!payload.toolingUnavailable) {
        payload.resolvedFamily = result.stdout.trim();
        const resolvedNormalized = canonicalizeFontName(payload.resolvedFamily);
        payload.available = buildFontMatchCandidates(cacheKey)
            .map(canonicalizeFontName)
            .filter(Boolean)
            .some((candidate) => candidate === resolvedNormalized
                || resolvedNormalized.includes(candidate)
                || candidate.includes(resolvedNormalized));
    }

    fontAvailabilityCache.set(cacheKey, payload);
    return payload;
}

function getInstalledIconThemes() {
    if (cachedInstalledIconThemes)
        return cachedInstalledIconThemes;

    const themes = new Map();
    const searchPaths = [
        GLib.build_filenamev([GLib.get_home_dir(), '.icons']),
        GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'icons']),
        '/usr/local/share/icons',
        '/usr/share/icons'
    ];

    for (const path of searchPaths) {
        const directory = Gio.File.new_for_path(path);
        if (!directory.query_exists(null))
            continue;

        const enumerator = tryOrDefault(
            'ThemeAssetSmokeAudit.getInstalledIconThemes.enumerate',
            () => directory.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            ),
            null
        );
        if (!enumerator)
            continue;

        let info = null;
        while ((info = enumerator.next_file(null))) {
            if (info.get_file_type() !== Gio.FileType.DIRECTORY)
                continue;

            const name = info.get_name();
            const indexPath = GLib.build_filenamev([path, name, 'index.theme']);
            GLib.file_test(indexPath, GLib.FileTest.EXISTS)
                && themes.set(canonicalizeIconThemeName(name), name);
        }

        tryRun('ThemeAssetSmokeAudit.getInstalledIconThemes.close', () => enumerator.close(null));
    }

    cachedInstalledIconThemes = themes;
    return cachedInstalledIconThemes;
}

function queryInstalledIconTheme(value) {
    const cleaned = cleanupIconThemeValue(value);
    const themes = getInstalledIconThemes();
    return {
        available: themes.has(canonicalizeIconThemeName(cleaned)),
        resolvedTheme: themes.get(canonicalizeIconThemeName(cleaned)) || '',
        toolingUnavailable: false
    };
}

function makeDeclaration(kind, sourceFile, sourceLine, rawValue, entries, sourceKey = null) {
    return {
        kind,
        sourceFile,
        sourceLine,
        rawValue: rawValue.trim(),
        sourceKey,
        entries
    };
}

function parseFontEntries(rawValue) {
    if (isDynamicValue(rawValue))
        return [];

    return splitList(rawValue)
        .map((item) => cleanupFontValue(item))
        .filter((item) => item.length > 0 && !isGenericFontFamily(item))
        .map((family) => ({
            family,
            availability: queryResolvedFontFamily(family)
        }));
}

function parseIconThemeEntries(rawValue) {
    if (isDynamicValue(rawValue))
        return [];

    const unwrapped = String(rawValue || '').trim().match(/^(['"])(.*)\1$/);
    const listValue = unwrapped ? unwrapped[2] : rawValue;

    return splitList(listValue)
        .map((item) => cleanupIconThemeValue(item))
        .filter((item) => item.length > 0)
        .map((theme) => ({
            theme,
            availability: queryInstalledIconTheme(theme)
        }));
}

function extractCssDeclarations(text, relativePath) {
    const declarations = [];
    const fontPattern = /font-family\s*:\s*([^;]+);/gi;
    let match = null;

    while ((match = fontPattern.exec(text))) {
        const entries = parseFontEntries(match[1]);
        entries.length > 0 && declarations.push(
            makeDeclaration('font', relativePath, getLineNumber(text, match.index), match[1], entries, 'font-family')
        );
    }

    return declarations;
}

function extractRasiDeclarations(text, relativePath) {
    const declarations = [];
    const fontPattern = /(?:^|\n)\s*font\s*:\s*([^;]+);/g;
    const iconPattern = /(?:^|\n)\s*icon-theme\s*:\s*([^;]+);/g;
    let match = null;

    while ((match = fontPattern.exec(text))) {
        const entries = parseFontEntries(match[1]);
        entries.length > 0 && declarations.push(
            makeDeclaration('font', relativePath, getLineNumber(text, match.index), match[1], entries, 'font')
        );
    }

    while ((match = iconPattern.exec(text))) {
        const entries = parseIconThemeEntries(match[1]);
        entries.length > 0 && declarations.push(
            makeDeclaration('icon-theme', relativePath, getLineNumber(text, match.index), match[1], entries, 'icon-theme')
        );
    }

    return declarations;
}

function extractIniStyleDeclarations(text, relativePath) {
    const declarations = [];
    const patterns = [
        { kind: 'font', key: 'font_family', pattern: /(?:^|\n)\s*font_family\s*=\s*([^\n#;]+)/g },
        { kind: 'font', key: 'font', pattern: /(?:^|\n)\s*font\s*=\s*([^\n#;]+)/g },
        { kind: 'font', key: 'font_family', pattern: /(?:^|\n)\s*font_family\s+(?![=])([^\n#;]+)/g },
        { kind: 'icon-theme', key: 'icon_theme', pattern: /(?:^|\n)\s*icon_theme\s*=\s*([^\n#;]+)/g },
        { kind: 'icon-theme', key: 'icon-theme', pattern: /(?:^|\n)\s*icon-theme\s*=\s*([^\n#;]+)/g },
        { kind: 'font', key: 'bar_text_font', pattern: /(?:^|\n)\s*bar_text_font\s*=\s*([^\n#;]+)/g }
    ];

    for (const descriptor of patterns) {
        let match = null;
        while ((match = descriptor.pattern.exec(text))) {
            const entries = descriptor.kind === 'font'
                ? parseFontEntries(match[1])
                : parseIconThemeEntries(match[1]);
            entries.length > 0 && declarations.push(
                makeDeclaration(
                    descriptor.kind,
                    relativePath,
                    getLineNumber(text, match.index),
                    match[1],
                    entries,
                    descriptor.key
                )
            );
        }
    }

    return declarations;
}

function hasGenericFontFallback(rawValue) {
    return splitList(rawValue)
        .map((item) => stripQuotes(item).toLowerCase().trim())
        .some((item) => GENERIC_FONT_FAMILIES.has(item));
}

function extractDeclarations(relativePath, text) {
    const lowerPath = relativePath.toLowerCase();

    switch (true) {
        case lowerPath.endsWith('.css'):
        case lowerPath.endsWith('.scss'):
            return extractCssDeclarations(text, relativePath);
        case lowerPath.endsWith('.rasi'):
            return extractRasiDeclarations(text, relativePath);
        default:
            return extractIniStyleDeclarations(text, relativePath);
    }
}

function evaluateFontDeclaration(declaration) {
    const availableEntries = declaration.entries.filter((entry) => entry.availability.available);
    const missingEntries = declaration.entries.filter((entry) => !entry.availability.available && !entry.availability.toolingUnavailable);
    const toolingUnavailable = declaration.entries.some((entry) => entry.availability.toolingUnavailable);
    const isFallbackStack = declaration.entries.length > 1;
    const genericFallbackPresent = hasGenericFontFallback(declaration.rawValue);

    if (toolingUnavailable) {
        return {
            required: [],
            missing: [],
            warnings: [{
                kind: 'font',
                sourceFile: declaration.sourceFile,
                sourceLine: declaration.sourceLine,
                sourceKey: declaration.sourceKey,
                rawValue: declaration.rawValue,
                message: 'fontconfig tooling unavailable, skipped strict font verification'
            }]
        };
    }

    switch (true) {
        case genericFallbackPresent:
            return {
                required: [],
                missing: [],
                warnings: missingEntries.map((entry) => ({
                    kind: 'font',
                    sourceFile: declaration.sourceFile,
                    sourceLine: declaration.sourceLine,
                    sourceKey: declaration.sourceKey,
                    rawValue: declaration.rawValue,
                    value: entry.family,
                    resolvedValue: entry.availability.resolvedFamily,
                    message: availableEntries.length > 0
                        ? 'preferred font missing, generic fallback remains available'
                        : 'preferred font missing, declaration still has a generic fallback'
                }))
            };
        case isFallbackStack && availableEntries.length > 0:
            return {
                required: [],
                missing: [],
                warnings: missingEntries.map((entry) => ({
                    kind: 'font',
                    sourceFile: declaration.sourceFile,
                    sourceLine: declaration.sourceLine,
                    sourceKey: declaration.sourceKey,
                    rawValue: declaration.rawValue,
                    value: entry.family,
                    resolvedValue: entry.availability.resolvedFamily,
                    message: 'font fallback candidate missing, declaration still has a working fallback'
                }))
            };
        case isFallbackStack && availableEntries.length === 0:
            return {
                required: [{
                    kind: 'font',
                    sourceFile: declaration.sourceFile,
                    sourceLine: declaration.sourceLine,
                    sourceKey: declaration.sourceKey,
                    rawValue: declaration.rawValue
                }],
                missing: declaration.entries.map((entry) => ({
                    kind: 'font',
                    sourceFile: declaration.sourceFile,
                    sourceLine: declaration.sourceLine,
                    sourceKey: declaration.sourceKey,
                    rawValue: declaration.rawValue,
                    value: entry.family,
                    resolvedValue: entry.availability.resolvedFamily
                })),
                warnings: []
            };
        case declaration.entries.length === 1 && missingEntries.length === 1:
            return {
                required: [{
                    kind: 'font',
                    sourceFile: declaration.sourceFile,
                    sourceLine: declaration.sourceLine,
                    sourceKey: declaration.sourceKey,
                    rawValue: declaration.rawValue
                }],
                missing: [{
                    kind: 'font',
                    sourceFile: declaration.sourceFile,
                    sourceLine: declaration.sourceLine,
                    sourceKey: declaration.sourceKey,
                    rawValue: declaration.rawValue,
                    value: missingEntries[0].family,
                    resolvedValue: missingEntries[0].availability.resolvedFamily
                }],
                warnings: []
            };
        default:
            return {required: [], missing: [], warnings: []};
    }
}

function evaluateIconThemeDeclaration(declaration) {
    const availableEntries = declaration.entries.filter((entry) => entry.availability.available);
    const missingEntries = declaration.entries.filter((entry) => !entry.availability.available);
    const isFallbackStack = declaration.entries.length > 1;

    switch (true) {
        case isFallbackStack && availableEntries.length > 0:
            return {
                required: [],
                missing: [],
                warnings: missingEntries.map((entry) => ({
                    kind: 'icon-theme',
                    sourceFile: declaration.sourceFile,
                    sourceLine: declaration.sourceLine,
                    sourceKey: declaration.sourceKey,
                    rawValue: declaration.rawValue,
                    value: entry.theme,
                    resolvedValue: entry.availability.resolvedTheme,
                    message: 'icon theme fallback candidate missing, declaration still has a working fallback'
                }))
            };
        case isFallbackStack && availableEntries.length === 0:
            return {
                required: [{
                    kind: 'icon-theme',
                    sourceFile: declaration.sourceFile,
                    sourceLine: declaration.sourceLine,
                    sourceKey: declaration.sourceKey,
                    rawValue: declaration.rawValue
                }],
                missing: declaration.entries.map((entry) => ({
                    kind: 'icon-theme',
                    sourceFile: declaration.sourceFile,
                    sourceLine: declaration.sourceLine,
                    sourceKey: declaration.sourceKey,
                    rawValue: declaration.rawValue,
                    value: entry.theme,
                    resolvedValue: entry.availability.resolvedTheme
                })),
                warnings: []
            };
        case declaration.entries.length === 1 && missingEntries.length === 1:
            return {
                required: [{
                    kind: 'icon-theme',
                    sourceFile: declaration.sourceFile,
                    sourceLine: declaration.sourceLine,
                    sourceKey: declaration.sourceKey,
                    rawValue: declaration.rawValue
                }],
                missing: [{
                    kind: 'icon-theme',
                    sourceFile: declaration.sourceFile,
                    sourceLine: declaration.sourceLine,
                    sourceKey: declaration.sourceKey,
                    rawValue: declaration.rawValue,
                    value: missingEntries[0].theme,
                    resolvedValue: missingEntries[0].availability.resolvedTheme
                }],
                warnings: []
            };
        default:
            return {required: [], missing: [], warnings: []};
    }
}

export function auditThemeAssets(themePath) {
    const files = walkAuditedFiles(themePath);
    const declarations = [];
    const fileErrors = [];

    for (const file of files) {
        const text = readTextFile(file.absolutePath);
        if (text === null) {
            fileErrors.push({
                sourceFile: file.relativePath,
                message: 'failed to read file for asset audit'
            });
            continue;
        }

        declarations.push(...extractDeclarations(file.relativePath, text));
    }

    const aggregate = {
        auditedFiles: files.map((file) => file.relativePath),
        fileErrors,
        requiredFonts: [],
        missingFonts: [],
        requiredIconThemes: [],
        missingIconThemes: [],
        warnings: []
    };

    for (const declaration of declarations) {
        const evaluation = declaration.kind === 'font'
            ? evaluateFontDeclaration(declaration)
            : evaluateIconThemeDeclaration(declaration);

        if (declaration.kind === 'font') {
            aggregate.requiredFonts.push(...evaluation.required);
            aggregate.missingFonts.push(...evaluation.missing);
        } else {
            aggregate.requiredIconThemes.push(...evaluation.required);
            aggregate.missingIconThemes.push(...evaluation.missing);
        }

        aggregate.warnings.push(...evaluation.warnings);
    }

    return {
        ...aggregate,
        declarationCount: declarations.length,
        success: aggregate.missingFonts.length === 0
            && aggregate.missingIconThemes.length === 0
            && aggregate.fileErrors.length === 0
    };
}
