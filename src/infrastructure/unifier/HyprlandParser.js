import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {ScriptBuilder} from '../scripts/ScriptBuilder.js';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

export class HyprlandParser {
    constructor(options = {}) {
        this.logger = options.logger || null;
        this.settings = options.settings || {};

        this.wallpaperExecPatterns = [
            /swaybg\b/i,
            /swww\b/i,
            /hyprpaper\b/i,
            /wpaperd\b/i,
            /feh\b.*--bg/i,
            /nitrogen\b/i,
            /setroot\b/i,
            /hsetroot\b/i,
            /xwallpaper\b/i,
            /variety\b/i
        ];

        this.categories = {
            keybinds: {
                patterns: [
                    /^bind[mrel]*\s*=/,
                    /^submap\s*=/
                ],
                file: 'keybinds.conf'
            },
            rules: {
                patterns: [
                    /^windowrule(v2)?\s*=/,
                    /^layerrule\s*=/,
                    /^workspace\s*=/
                ],
                file: 'rules.conf'
            },
            execs: {
                patterns: [
                    /^exec(-once)?\s*=/
                ],
                file: 'execs.conf'
            },
            env: {
                patterns: [
                    /^env\s*=/,
                    /^\$\w+\s*=/
                ],
                file: 'env.conf'
            },
            colors: {
                patterns: [
                    /col\.\w+\s*=/
                ],
                file: 'colors.conf'
            }
        };

        this.generalSections = [
            'general', 'input', 'gestures', 'misc', 'binds',
            'decoration', 'animations', 'dwindle', 'master', 'cursor', 'xwayland'
        ];

        this.colorSections = ['decoration', 'plugin'];

        this.dangerousPatterns = {
            monitor: /^monitor\s*=\s*.+$/gm,
            homeDir: /\/home\/[a-zA-Z0-9_-]+\//g,
            plugin: /^plugin\s*=\s*\/usr\/lib[^}\n]+$/gm
        };
    }

    log(msg, ...args) {
        if (this.logger?.info) {
            this.logger.info(`[HyprlandParser] ${msg}`, ...args);
        }
    }

    parseAndModularize(themePath) {
        const hyprlandDir = `${themePath}/hyprland`;

        let mainConfig = null;
        const candidates = [
            `${hyprlandDir}/hyprland.conf`,
            `${themePath}/hyprland.conf`,
            `${hyprlandDir}/hypr.conf`
        ];

        for (const candidate of candidates) {
            if (GLib.file_test(candidate, GLib.FileTest.EXISTS)) {
                mainConfig = candidate;
                break;
            }
        }

        if (!mainConfig) {
            return { success: false, error: 'No hyprland.conf found' };
        }

        const result = tryOrDefault('HyprlandParser.parseAndModularize', () => {
            const allContent = this.readAllConfigs(mainConfig, hyprlandDir);

            const sanitizedContent = this.sanitizeContent(allContent);

            const categorized = this.categorizeContent(sanitizedContent);

            if (this.isAlreadyModularized(allContent)) {
                this.log('Config appears already modularized, sanitizing existing files');
                this.sanitizeExistingFiles(hyprlandDir);
                return {
                    success: true,
                    execs: this.extractExecs(allContent)
                };
            }

            this.writeModularFiles(hyprlandDir, categorized);

            this.generateMasterConfig(hyprlandDir, themePath);

            return {
                success: true,
                execs: categorized.execs.map(line => this.extractExecCommand(line))
            };
        }, null);

        return result || { success: false, error: 'Failed to modularize Hyprland config' };
    }

    readAllConfigs(configPath, baseDir) {
        const content = this.readFile(configPath);
        if (!content) return '';

        const lines = content.split('\n');
        const result = [];

        for (const line of lines) {
            const trimmed = line.trim();

            const sourceMatch = trimmed.match(/^source\s*=\s*(.+)$/);
            if (sourceMatch) {
                let includePath = this.resolveIncludePath(sourceMatch[1].trim(), baseDir);

                switch (true) {
                    case includePath.includes('.config/themes/'):
                        result.push(line);
                        break;
                    case GLib.file_test(includePath, GLib.FileTest.EXISTS): {
                        const included = this.readAllConfigs(includePath, baseDir);
                        result.push(`# ????????? Included from: ${sourceMatch[1]} ?????????`);
                        result.push(included);
                        result.push(`# ????????? End include ?????????`);
                        break;
                    }
                    default:
                        result.push(`# source= (not found): ${includePath}`);
                        break;
                }
                continue;
            }

            result.push(line);
        }

        return result.join('\n');
    }

    categorizeContent(content) {
        const categorized = {
            keybinds: [],
            rules: [],
            execs: [],
            env: [],
            colors: [],
            general: [],
            uncategorized: []
        };

        const lines = content.split('\n');
        let currentSection = null;
        let sectionDepth = 0;
        let sectionContent = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (!currentSection && (!trimmed || trimmed.startsWith('#'))) {
                if (trimmed.startsWith('#') && i < lines.length - 1) {
                    const nextLine = lines[i + 1].trim();
                    const category = this.getCategoryForLine(nextLine);
                    if (category) {
                        categorized[category].push(line);
                        continue;
                    }
                }
                continue;
            }

            if (trimmed.match(/^\w+\s*\{/) && !currentSection) {
                const sectionName = trimmed.match(/^(\w+)\s*\{/)[1];
                currentSection = sectionName;
                sectionDepth = 1;
                sectionContent = [line];
                continue;
            }

            if (currentSection) {
                sectionContent.push(line);

                const openBraces = (trimmed.match(/\{/g) || []).length;
                const closeBraces = (trimmed.match(/\}/g) || []).length;
                sectionDepth += openBraces - closeBraces;

                if (sectionDepth === 0) {
                    const sectionBlock = sectionContent.join('\n');

                    this.routeSectionBlock(categorized, currentSection, sectionBlock);
                    } else {
                        categorized.general.push(sectionBlock);
                    }

                    currentSection = null;
                    sectionContent = [];
                }
                continue;
            }

            const category = this.getCategoryForLine(trimmed);
            if (category) {
                categorized[category].push(line);
                continue;
            }

            if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('source')) {
                categorized.general.push(line);
            }
        }

        return categorized;
    }

    getCategoryForLine(line) {
        const trimmed = line.trim();

        for (const [category, config] of Object.entries(this.categories)) {
            if (config.patterns.some(pattern => pattern.test(trimmed))) {
                return category;
            }
        }

        return null;
    }

    routeSectionBlock(categorized, sectionName, sectionBlock) {
        switch (true) {
            case this.colorSections.includes(sectionName) && this.hasColorContent(sectionBlock): {
                const { colorParts, otherParts } = this.splitColorContent(sectionBlock, sectionName);
                colorParts && categorized.colors.push(colorParts);
                otherParts && categorized.general.push(otherParts);
                break;
            }
            case this.generalSections.includes(sectionName):
                categorized.general.push(sectionBlock);
                break;
            case sectionName === 'plugin':
                (this.hasColorContent(sectionBlock) ? categorized.colors : categorized.general).push(sectionBlock);
                break;
            default:
                categorized.general.push(sectionBlock);
                break;
        }
    }

    hasColorContent(content) {
        return /col\.\w+\s*=/.test(content) ||
               /rgba?\s*\(/.test(content) ||
               /#[0-9a-fA-F]{6,8}/.test(content);
    }

    splitColorContent(sectionBlock, sectionName) {
        if (this.hasColorContent(sectionBlock)) {
            return { colorParts: sectionBlock, otherParts: null };
        }
        return { colorParts: null, otherParts: sectionBlock };
    }

    isAlreadyModularized(content) {
        const lines = content.split('\n');
        let sourceCount = 0;
        let directiveCount = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('source')) {
                sourceCount++;
                continue;
            }

            if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('{') && !trimmed.startsWith('}')) {
                directiveCount++;
            }
        }

        return sourceCount > 3 && sourceCount > directiveCount;
    }

    writeModularFiles(hyprlandDir, categorized) {
        const processedExecs = this.commentOutWallpaperExecs(categorized.execs || []);

        const files = {
            'keybinds.conf': this.formatSection('Keybindings', categorized.keybinds),
            'rules.conf': this.formatSection('Window Rules', categorized.rules),
            'execs.conf': this.formatSection('Autostart / Exec', processedExecs),
            'env.conf': this.formatSection('Environment Variables', categorized.env),
            'colors.conf': this.formatSection('Colors & Decoration', categorized.colors),
            'general.conf': this.formatSection('General Configuration', categorized.general)
        };

        for (const [filename, content] of Object.entries(files)) {
            if (content.trim()) {
                const filePath = `${hyprlandDir}/${filename}`;
                this.writeFile(filePath, content);
            }
        }
    }

    formatSection(title, lines) {
        if (!lines || lines.length === 0) return '';

        const header = `# ╔══════════════════════════════════════════════════════════════╗
# ║  ${title.padEnd(58)}║
# ╚══════════════════════════════════════════════════════════════╝\n\n`;

        return header + lines.join('\n') + '\n';
    }

    commentOutWallpaperExecs(lines) {
        this.log(`commentOutWallpaperExecs called: setting=${this.settings.commentOutWallpaperExecs}, lines=${lines.length}`);

        if (!this.settings.commentOutWallpaperExecs) {
            this.log('Skipping wallpaper exec commenting (setting disabled)');
            return lines;
        }

        this.log(`Processing ${lines.length} exec lines for wallpaper patterns`);
        let commentedCount = 0;

        const result = lines.map(line => {
            if (line.trim().startsWith('#')) {
                return line;
            }

            for (const pattern of this.wallpaperExecPatterns) {
                pattern.lastIndex = 0;
                if (pattern.test(line)) {
                    commentedCount++;
                    this.log(`Commenting out wallpaper exec: ${line.trim().substring(0, 80)}...`);
                    return `# [llayer: wallpaper exec disabled] ${line}`;
                }
            }

            return line;
        });

        this.log(`Commented out ${commentedCount} wallpaper exec lines`);
        return result;
    }

    generateMasterConfig(hyprlandDir, themePath) {
        const themeName = themePath.split('/').pop();

        const lastlayerConfPath = `${hyprlandDir}/lastlayer.conf`;
        if (!GLib.file_test(lastlayerConfPath, GLib.FileTest.EXISTS)) {
            const lastlayerContent = ScriptBuilder.buildLastLayerConfTemplate();
            this.writeFile(lastlayerConfPath, lastlayerContent);
            this.log(`Generated lastlayer.conf for theme: ${themeName}`);
        }

        const modularFiles = ['env.conf', 'general.conf', 'colors.conf', 'rules.conf', 'keybinds.conf', 'execs.conf', 'lastlayer.conf'];
        const paletteFiles = this.findPaletteSources(hyprlandDir, modularFiles);
        const sourceLines = [...paletteFiles, ...modularFiles]
            .filter(file => GLib.file_test(`${hyprlandDir}/${file}`, GLib.FileTest.EXISTS))
            .map(file => `source = ~/.config/themes/${themeName}/hyprland/${file}`)
            .join('\n');

        const master = `# ╔══════════════════════════════════════════════════════════════╗
# ║  Theme: ${themeName.padEnd(52)}║
# ║  Generated by llayer-plus Theme Unifier                      ║
# ╚══════════════════════════════════════════════════════════════╝

# Load modular configuration files
${sourceLines}
`;

        const originalPath = `${hyprlandDir}/hyprland.conf`;
        if (GLib.file_test(originalPath, GLib.FileTest.EXISTS)) {
            this.copyFile(originalPath, `${hyprlandDir}/hyprland.conf.original`);
        }

        this.writeFile(originalPath, master);
    }

    extractExecs(content) {
        const execs = [];
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (/^exec(-once)?\s*=/.test(trimmed)) {
                const command = this.extractExecCommand(trimmed);
                if (command) execs.push(command);
            }
        }

        return execs;
    }

    extractExecCommand(line) {
        const match = line.match(/^exec(-once)?\s*=\s*(.+)$/);
        if (match) {
            return match[2].trim();
        }
        return null;
    }

    sanitizeExistingFiles(hyprlandDir) {
        const filesToSanitize = ['general.conf', 'env.conf', 'execs.conf', 'keybinds.conf', 'rules.conf', 'colors.conf'];

        for (const filename of filesToSanitize) {
            const filePath = `${hyprlandDir}/${filename}`;
            if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) continue;

            const content = this.readFile(filePath);
            if (!content) continue;

            let processed = this.sanitizeContent(content);

            if (filename === 'execs.conf' && this.settings.commentOutWallpaperExecs) {
                const lines = processed.split('\n');
                const commentedLines = this.commentOutWallpaperExecs(lines);
                processed = commentedLines.join('\n');
            }

            if (processed !== content) {
                this.writeFile(filePath, processed);
                this.log(`Sanitized ${filename}`);
            }
        }
    }

    findPaletteSources(hyprlandDir, modularFiles) {
        const candidates = this.getPaletteCandidates(hyprlandDir, modularFiles);
        if (candidates.length === 0) return [];

        const referenced = this.getPaletteSourcesFromOriginal(hyprlandDir, candidates);
        if (referenced.length > 0) return referenced;

        const requiredVars = this.collectUndefinedVariables(hyprlandDir);
        if (requiredVars.size === 0) {
            return candidates.length === 1 ? [candidates[0].name] : [];
        }

        let best = null;
        for (const candidate of candidates) {
            const score = [...requiredVars].filter(v => candidate.vars.has(v)).length;
            if (!best || score > best.score) {
                best = { name: candidate.name, score };
            }
        }

        return best && best.score > 0 ? [best.name] : [];
    }

    getPaletteCandidates(hyprlandDir, modularFiles) {
        const excluded = new Set([
            ...modularFiles,
            'hyprland.conf',
            'hyprland.conf.original',
            'hypr.conf',
            'hypridle.conf',
            'hyprlock.conf',
            'hyprpaper.conf'
        ]);

        return tryOrDefault('HyprlandParser.getPaletteCandidates', () => {
            const candidates = [];
            const dir = Gio.File.new_for_path(hyprlandDir);
            const enumerator = dir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                const name = info.get_name();
                if (info.get_file_type() !== Gio.FileType.REGULAR) continue;
                if (!name.endsWith('.conf')) continue;
                if (excluded.has(name)) continue;

                const filePath = `${hyprlandDir}/${name}`;
                const content = this.readFile(filePath);
                if (!content) continue;

                const vars = this.extractDefinedVariables(content);
                if (vars.size === 0) continue;
                if (!this.isPaletteFile(content)) continue;

                candidates.push({ name, vars });
            }
            tryRun('HyprlandParser.getPaletteCandidates.close', () => enumerator.close(null));
            return candidates;
        }, []);
    }

    isPaletteFile(content) {
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            if (trimmed.match(/^\$[A-Za-z_][A-Za-z0-9_-]*\s*=/)) continue;
            return false;
        }
        return true;
    }

    getPaletteSourcesFromOriginal(hyprlandDir, candidates) {
        const originalPath = `${hyprlandDir}/hyprland.conf.original`;
        if (!GLib.file_test(originalPath, GLib.FileTest.EXISTS)) return [];

        const candidateNames = new Set(candidates.map(c => c.name));
        const content = this.readFile(originalPath);
        if (!content) return [];

        const sources = [];
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            const match = trimmed.match(/^source\s*=\s*(.+)$/);
            if (!match) continue;
            const raw = match[1].trim();
            const baseName = raw.split('/').pop();
            if (!baseName || !candidateNames.has(baseName)) continue;
            if (!sources.includes(baseName)) sources.push(baseName);
        }

        return sources;
    }

    collectUndefinedVariables(hyprlandDir) {
        const defined = new Set();
        const used = new Set();
        const ignoreUpper = /^[A-Z0-9_]+$/;

        const envPath = `${hyprlandDir}/env.conf`;
        const envContent = this.readFile(envPath);
        if (envContent) {
            for (const name of this.extractDefinedVariables(envContent)) {
                defined.add(name);
            }
        }

        const scanFiles = ['general.conf', 'colors.conf', 'rules.conf', 'keybinds.conf', 'execs.conf', 'lastlayer.conf'];
        for (const filename of scanFiles) {
            const filePath = `${hyprlandDir}/${filename}`;
            if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) continue;
            const content = this.readFile(filePath);
            if (!content) continue;
            for (const name of this.extractUsedVariables(content)) {
                if (ignoreUpper.test(name)) continue;
                if (name.startsWith('XDG') || name === 'HOME') continue;
                used.add(name);
            }
        }

        const required = new Set();
        for (const name of used) {
            if (!defined.has(name)) required.add(name);
        }
        return required;
    }

    extractDefinedVariables(content) {
        const vars = new Set();
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            const match = trimmed.match(/^\$([A-Za-z_][A-Za-z0-9_-]*)\s*=/);
            if (match) vars.add(match[1]);
        }
        return vars;
    }

    extractUsedVariables(content) {
        const vars = new Set();
        const matches = content.match(/\$[A-Za-z_][A-Za-z0-9_-]*/g) || [];
        for (const match of matches) {
            vars.add(match.slice(1));
        }
        return vars;
    }

    sanitizeContent(content) {
        let sanitized = content;

        const monitorLines = sanitized.match(/^monitor\s*=\s*.+$/gm) || [];
        if (monitorLines.length > 0) {
            sanitized = sanitized.replace(/^monitor\s*=\s*.+\n?/gm, '');
            const universalMonitor = '# Universal monitor config (auto-detect)\nmonitor=,preferred,auto,1\n\n';

            const lines = sanitized.split('\n');
            let insertIndex = 0;
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    insertIndex = i;
                    break;
                }
            }
            lines.splice(insertIndex, 0, universalMonitor);
            sanitized = lines.join('\n');

            this.log(`Replaced ${monitorLines.length} hardcoded monitor configs with universal`);
        }

        const homeMatches = sanitized.match(/\/home\/[a-zA-Z0-9_-]+\//g);
        if (homeMatches) {
            sanitized = sanitized.replace(/\/home\/[a-zA-Z0-9_-]+\//g, '$HOME/');
            this.log(`Replaced ${homeMatches.length} hardcoded home paths with $HOME`);
        }

        sanitized = sanitized.replace(
            /^(plugin\s*=\s*\/usr\/lib[^\n]+)$/gm,
            '# $1  # Commented: system-specific path'
        );

        const workspaceMonitorPattern = /^(workspace\s*=\s*\d+),\s*monitor:[a-zA-Z0-9_-]+(.*)$/gm;
        const workspaceMatches = sanitized.match(workspaceMonitorPattern);
        if (workspaceMatches) {
            sanitized = sanitized.replace(workspaceMonitorPattern, '$1$2');
            sanitized = sanitized.replace(/,\s*,/g, ',');
            sanitized = sanitized.replace(/,\s*$/gm, '');
            this.log(`Removed hardcoded monitor from ${workspaceMatches.length} workspace rules`);
        }

        const deviceBlockPattern = /^device\s*\{([^}]*)\}\s*\n?/gms;
        const deviceMatches = sanitized.match(deviceBlockPattern);
        if (deviceMatches) {
            let accelProfile = null;
            for (const match of deviceMatches) {
                const accelMatch = match.match(/accel_profile\s*=\s*["']?(\w+)["']?/);
                if (accelMatch) {
                    accelProfile = accelMatch[1];
                    break;
                }
            }

            sanitized = sanitized.replace(deviceBlockPattern, '# Device block removed (hardware-specific)\n');
            this.log(`Removed ${deviceMatches.length} device-specific blocks`);

            if (accelProfile && !sanitized.match(/input\s*\{[^}]*accel_profile/s)) {
                sanitized = sanitized.replace(
                    /(input\s*\{[^\n]*\n)/,
                    `$1    accel_profile = ${accelProfile}  # Preserved from device block\n`
                );
                this.log(`Preserved accel_profile = ${accelProfile} in input block`);
            }
        }

        sanitized = sanitized.replace(
            /(sensitivity\s*=\s*)(-[\d.]+)/g,
            (match, prefix, value) => {
                const numValue = parseFloat(value);
                if (numValue < 0) {
                    this.log(`Normalized negative sensitivity ${numValue} to 0`);
                    return `${prefix}0  # Normalized (was: ${value})`;
                }
                return match;
            }
        );

        sanitized = this.rewriteLegacyWindowruleMatchSyntax(sanitized);

        return sanitized;
    }

    rewriteLegacyWindowruleMatchSyntax(content) {
        const lines = content.split('\n');
        let normalizedCount = 0;
        let commentedCount = 0;

        const normalized = lines.map((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;

            const legacyMatch = line.match(/^(\s*)windowrule(v2)?\s*=\s*match:(class|title)\s*(.+)$/i);
            if (!legacyMatch) return line;

            const indent = legacyMatch[1] || '';
            const field = (legacyMatch[3] || '').toLowerCase();
            const payload = (legacyMatch[4] || '').trim();
            const split = this.splitCommaOutsideParentheses(payload);
            if (!split) {
                commentedCount++;
                return `${indent}# [llayer: invalid legacy windowrule syntax] ${trimmed}`;
            }
            const selectorRaw = split.left;
            const action = split.right.trim();

            const selectorRegex = this.canonicalizeLegacyRuleSelector(selectorRaw);
            if (!selectorRegex || !action) {
                commentedCount++;
                return `${indent}# [llayer: invalid legacy windowrule syntax] ${trimmed}`;
            }
            if (/\bmatch:(class|title)\b/i.test(action)) {
                commentedCount++;
                return `${indent}# [llayer: invalid legacy windowrule syntax] ${trimmed}`;
            }

            normalizedCount++;
            return `${indent}windowrulev2 = ${action}, ${field}:${selectorRegex}`;
        });

        let residualCount = 0;
        const sanitized = normalized.map((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;

            const invalidMatch = line.match(/^(\s*)windowrulev2\s*=.*\bmatch:(class|title)\b/i);
            if (!invalidMatch) return line;

            residualCount++;
            const indent = invalidMatch[1] || '';
            return `${indent}# [llayer: invalid legacy windowrule syntax] ${trimmed}`;
        });

        if (normalizedCount > 0) {
            this.log(`Normalized ${normalizedCount} legacy windowrule match entries`);
        }
        const totalCommented = commentedCount + residualCount;
        if (totalCommented > 0) {
            this.log(`Commented ${totalCommented} invalid legacy windowrule entries`);
        }

        return sanitized.join('\n');
    }

    splitCommaOutsideParentheses(text) {
        let parenDepth = 0;
        let bracketDepth = 0;
        let braceDepth = 0;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            switch (ch) {
                case '(':
                    parenDepth++;
                    break;
                case ')':
                    if (parenDepth > 0) parenDepth--;
                    break;
                case '[':
                    bracketDepth++;
                    break;
                case ']':
                    if (bracketDepth > 0) bracketDepth--;
                    break;
                case '{':
                    braceDepth++;
                    break;
                case '}':
                    if (braceDepth > 0) braceDepth--;
                    break;
                case ',':
                    if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
                        return {
                            left: text.slice(0, i).trim(),
                            right: text.slice(i + 1).trim()
                        };
                    }
                    break;
            }
        }

        return null;
    }

    canonicalizeLegacyRuleSelector(selectorRaw) {
        let selector = (selectorRaw || '').trim();
        if (!selector) return '';

        if ((selector.startsWith('"') && selector.endsWith('"')) ||
            (selector.startsWith("'") && selector.endsWith("'"))) {
            selector = selector.slice(1, -1).trim();
        }

        if (selector.startsWith('(') && selector.endsWith(')') && selector.length > 2) {
            selector = selector.slice(1, -1).trim();
        }

        if (!selector) return '';

        const looksLikeRegex = selector.includes('^') ||
            selector.includes('$') ||
            selector.includes('.*') ||
            selector.includes('\\') ||
            selector.includes('[') ||
            selector.includes(']');

        if (looksLikeRegex) return selector;

        if (selector.includes(',')) {
            const parts = selector
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part) => this.escapeRegexLiteral(part));
            if (parts.length === 0) return '';
            return `^(${parts.join('|')})$`;
        }

        return `^(${this.escapeRegexLiteral(selector)})$`;
    }

    resolveIncludePath(includePath, baseDir) {
        switch (true) {
            case includePath.startsWith('~'):
                return includePath.replace('~', GLib.get_home_dir());
            case includePath.startsWith('$HOME'):
                return includePath.replace('$HOME', GLib.get_home_dir());
            case !includePath.startsWith('/'):
                return `${baseDir}/${includePath}`;
            default:
                return includePath;
        }
    }

    escapeRegexLiteral(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    readFile(path) {
        return tryOrDefault('HyprlandParser.readFile', () => {
            const [success, contents] = GLib.file_get_contents(path);
            return success ? new TextDecoder().decode(contents) : null;
        }, null);
    }

    writeFile(path, content) {
        const written = tryRun('HyprlandParser.writeFile', () => GLib.file_set_contents(path, content));
        !written && this.log('Failed to write file:', path);
    }

    copyFile(src, dest) {
        tryRun('HyprlandParser.copyFile', () => GLib.spawn_command_line_sync(`cp -f "${src}" "${dest}"`));
    }
}
