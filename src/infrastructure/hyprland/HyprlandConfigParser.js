import GLib from 'gi://GLib';
import { tryOrNull } from '../utils/ErrorUtils.js';




export class HyprlandConfigParser {
    constructor() {
        this.MARKER_PATTERNS = {
            LEGACY_DISABLED: /\[LL:LEGACY:disabled:([^:]+):([^\]]+)\]/,
            LEGACY_CONVERTED: /\[LL:LEGACY:converted:([^:]+):([^\]]+)\]/,
            LEGACY_USER_ENABLED: /\[LL:USER_ENABLED_LEGACY\]/,
            FUTURE_DISABLED: /\[LL:FUTURE:disabled:([^:]+):([^\]]+)\]/,
            FUTURE_USER_ENABLED: /\[LL:USER_ENABLED_FUTURE\]/
        };

    }

    parse(content) {
        const lines = content.split('\n');
        const parsedLines = [];
        const parameters = new Map();
        const sections = new Set();
        const sectionStack = [];

        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const trimmed = raw.replace(/\r$/, '').trimEnd();
            const trimmedClean = trimmed.trim();
            const indent = raw.match(/^(\s*)/)?.[1] || '';
            const lineNumber = i + 1;

            const parsed = {
                lineNumber,
                raw,
                trimmed: trimmedClean,
                indent,
                sectionPath: [...sectionStack],
                type: 'other',
                marker: null
            };

            parsed.marker = this.detectMarker(trimmedClean);

            if (!trimmedClean) {
                parsed.type = 'empty';
                parsedLines.push(parsed);
                continue;
            }

            if (trimmedClean.startsWith('#') && !parsed.marker) {
                parsed.type = 'comment';
                parsedLines.push(parsed);
                continue;
            }

            const closeBraces = (trimmedClean.match(/\}/g) || []).length;
            for (let b = 0; b < closeBraces; b++) {
                if (sectionStack.length > 0) {
                    sectionStack.pop();
                }
            }
            parsed.sectionPath = [...sectionStack];

            if (/^\}+$/.test(trimmedClean)) {
                parsed.type = 'section_close';
                parsedLines.push(parsed);
                continue;
            }

            const sectionMatch = trimmedClean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\{/);
            if (sectionMatch && !trimmedClean.includes('=')) {
                const sectionName = sectionMatch[1];
                parsed.type = 'section_open';
                parsed.sectionName = sectionName;
                sectionStack.push(sectionName);
                sections.add(sectionStack.join(':'));
                parsedLines.push(parsed);
                continue;
            }

            const paramInfo = this.parseParameterLine(trimmedClean, sectionStack, parsed.marker);
            if (paramInfo) {
                parsed.type = 'parameter';
                parsed.paramName = paramInfo.paramName;
                parsed.paramPath = paramInfo.paramPath;
                parsed.paramValue = paramInfo.paramValue;
                parsed.isDisabled = paramInfo.isDisabled;
                parsed.isUserEnabled = paramInfo.isUserEnabled;

                if (!paramInfo.isDisabled || paramInfo.isUserEnabled) {
                    parameters.set(parsed.paramPath, parsed);
                }

                parsedLines.push(parsed);
                continue;
            }

            parsed.type = 'other';
            parsedLines.push(parsed);
        }

        return { lines: parsedLines, parameters, sections };
    }

    detectMarker(line) {
        {
            const m1 = line.match(/\[LL:FUTURE:converted:([^:]+):(.+?)=>([^\]]+)\]/);
            if (m1) {
                return { type: 'FUTURE_CONVERTED', match: m1, groups: m1.slice(1) };
            }

            const m2 = line.match(/\[LL:FUTURE:converted:([^:]+):([^:]+):([^\]]+)\]/);
            if (m2) {
                return { type: 'FUTURE_CONVERTED', match: m2, groups: m2.slice(1) };
            }

            const m3 = line.match(/\[LL:FUTURE:converted:([^:]+):([^\]]+)\]/);
            if (m3) {
                const minVersion = m3[1];
                const tail = m3[2] || '';
                const lastColon = tail.lastIndexOf(':');
                if (lastColon !== -1) {
                    const newPath = tail.slice(0, lastColon);
                    const oldPathPrefix = tail.slice(lastColon + 1);
                    return { type: 'FUTURE_CONVERTED', match: m3, groups: [minVersion, newPath, oldPathPrefix] };
                }
            }
        }

        for (const [type, pattern] of Object.entries(this.MARKER_PATTERNS)) {
            const match = line.match(pattern);
            if (match) {
                return { type, match, groups: match.slice(1) };
            }
        }
        return null;
    }

    parseParameterLine(line, sectionStack, marker) {
        let workLine = line;
        let isDisabled = false;
        let isUserEnabled = false;

        if (marker && (marker.type === 'LEGACY_DISABLED' || marker.type === 'FUTURE_DISABLED')) {
            isDisabled = true;
            const markerEnd = line.indexOf(']');
            if (markerEnd !== -1) {
                workLine = line.substring(markerEnd + 1).trim();
            }
        }

        if (marker && (marker.type === 'LEGACY_USER_ENABLED' || marker.type === 'FUTURE_USER_ENABLED')) {
            isUserEnabled = true;
            workLine = workLine.replace(/\s+#?\s*\[LL:USER_ENABLED_(?:LEGACY|FUTURE)\]$/, '');
        }

        if (workLine.startsWith('#')) {
            workLine = workLine.substring(1).trim();
        }

        const match = workLine.match(/^([a-zA-Z_][a-zA-Z0-9_:.-]*)\s*=\s*(.+?)(?:\s*#.*)?$/);
        if (!match) return null;

        let paramName = match[1];
        const paramValue = match[2].trim();

        let paramPath;
        if (paramName.includes(':')) {
            paramPath = paramName;
            paramName = paramName.split(':').pop();
        } else {
            if (sectionStack.length > 0) {
                paramPath = sectionStack.join(':') + ':' + paramName;
            } else {
                paramPath = paramName;
            }
        }

        return {
            paramName,
            paramPath,
            paramValue,
            isDisabled,
            isUserEnabled
        };
    }

    findParameter(parseResult, paramPath) {
        return parseResult.parameters.get(paramPath) || null;
    }

    findParameters(parseResult, predicate) {
        return parseResult.lines.filter(l => l.type === 'parameter' && predicate(l));
    }

    parseFile(filePath) {
        if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
            return null;
        }

        const result = tryOrNull(
            'HyprlandConfigParser.parseFile',
            () => GLib.file_get_contents(filePath)
        );
        const [success, contents] = result ?? [];
        return success ? this.parse(new TextDecoder('utf-8').decode(contents)) : null;
    }

    getParameterPaths(parseResult) {
        return Array.from(parseResult.parameters.keys());
    }

    setParameter(content, paramPath, newValue) {
        const parseResult = this.parse(content);
        const existing = this.findParameter(parseResult, paramPath);

        if (existing) {
            return this.replaceParameterInContent(content, existing, newValue);
        } else {
            return this.addParameter(content, paramPath, newValue, parseResult);
        }
    }

    replaceParameterInContent(content, parsed, newValue) {
        const lines = content.split('\n');
        const lineIndex = parsed.lineNumber - 1;

        if (lineIndex < 0 || lineIndex >= lines.length) {
            return content;
        }

        const oldLine = lines[lineIndex];
        const indent = oldLine.match(/^(\s*)/)?.[1] || '';

        let suffix = '';
        if (parsed.isUserEnabled) {
            switch (parsed.marker?.type) {
                case 'LEGACY_USER_ENABLED':
                    suffix = '  # [LL:USER_ENABLED_LEGACY]';
                    break;
                case 'FUTURE_USER_ENABLED':
                    suffix = '  # [LL:USER_ENABLED_FUTURE]';
                    break;
            }
        }

        const paramName = parsed.sectionPath.length > 0 ? parsed.paramName : parsed.paramPath;
        lines[lineIndex] = `${indent}${paramName} = ${newValue}${suffix}`;

        return lines.join('\n');
    }

    addParameter(content, paramPath, value, parseResult) {
        const lines = content.split('\n');
        const pathParts = paramPath.split(':');
        const paramName = pathParts.pop();
        const sectionPath = pathParts;

        if (sectionPath.length === 0) {
            lines.push(`${paramName} = ${value}`);
            return lines.join('\n');
        }

        const targetSection = sectionPath.join(':');
        let insertIndex = -1;
        let insertIndent = '    ';

        for (const line of parseResult.lines) {
            if (line.type === 'section_open' &&
                [...line.sectionPath, line.sectionName].join(':') === targetSection) {
                insertIndex = line.lineNumber; // Insert after the opening brace
                insertIndent = line.indent + '    ';
                break;
            }
        }

        if (insertIndex === -1) {
            return this.addParameterWithSection(content, paramPath, value);
        }

        lines.splice(insertIndex, 0, `${insertIndent}${paramName} = ${value}`);
        return lines.join('\n');
    }

    addParameterWithSection(content, paramPath, value) {
        const pathParts = paramPath.split(':');
        const paramName = pathParts.pop();

        let addition = '\n';
        let indent = '';
        for (const section of pathParts) {
            addition += `${indent}${section} {\n`;
            indent += '    ';
        }
        addition += `${indent}${paramName} = ${value}\n`;
        for (let i = pathParts.length - 1; i >= 0; i--) {
            indent = '    '.repeat(i);
            addition += `${indent}}\n`;
        }

        return content + addition;
    }

    removeParameter(content, paramPath) {
        const parseResult = this.parse(content);
        const existing = this.findParameter(parseResult, paramPath);

        if (!existing) {
            return content;
        }

        const lines = content.split('\n');
        lines.splice(existing.lineNumber - 1, 1);
        return lines.join('\n');
    }

    commentParameter(content, paramPath, marker) {
        const parseResult = this.parse(content);
        const existing = this.findParameter(parseResult, paramPath);

        if (!existing) {
            return content;
        }

        const lines = content.split('\n');
        const lineIndex = existing.lineNumber - 1;
        const indent = existing.indent;

        const paramName = existing.sectionPath.length > 0 ? existing.paramName : existing.paramPath;
        lines[lineIndex] = `${indent}${marker} ${paramName} = ${existing.paramValue}`;

        return lines.join('\n');
    }

    uncommentParameter(content, paramPath, userMarker) {
        const parseResult = this.parse(content);

        const disabled = parseResult.lines.find(l =>
            l.type === 'parameter' &&
            l.paramPath === paramPath &&
            l.isDisabled
        );

        if (!disabled) {
            return content;
        }

        const lines = content.split('\n');
        const lineIndex = disabled.lineNumber - 1;
        const indent = disabled.indent;

        const paramName = disabled.sectionPath.length > 0 ? disabled.paramName : disabled.paramPath;
        lines[lineIndex] = `${indent}${paramName} = ${disabled.paramValue}  # ${userMarker}`;

        return lines.join('\n');
    }

    forEachParameter(content, callback) {
        const parseResult = this.parse(content);
        for (const line of parseResult.lines) {
            if (line.type === 'parameter') {
                callback(line.paramPath, line.paramValue, line);
            }
        }
    }

    isSection(content, path) {
        const parseResult = this.parse(content);
        return parseResult.sections.has(path);
    }

    getParametersInSection(content, sectionPath) {
        const parseResult = this.parse(content);
        const prefix = sectionPath + ':';
        return parseResult.lines.filter(l =>
            l.type === 'parameter' &&
            l.paramPath.startsWith(prefix)
        );
    }
}

let parserInstance = null;

export function getHyprlandConfigParser() {
    if (!parserInstance) {
        parserInstance = new HyprlandConfigParser();
    }
    return parserInstance;
}

export default HyprlandConfigParser;
