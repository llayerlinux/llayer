import GLib from 'gi://GLib';
import { tryOrNull } from '../utils/ErrorUtils.js';
import { decodeBytes } from '../utils/Utils.js';

export class HyprlandConfigParser {
    parse(content) {
        const result = { parameters: new Map(), sections: new Set(), lines: [] },
            sectionStack = [];

        content.split('\n').forEach((raw, i) => {
            let trimmed = raw.replace(/\r$/, '').trim(),
                lineNumber = i + 1;

            if (!trimmed || trimmed.startsWith('#')) {
                result.lines.push({ lineNumber, raw, type: 'other' });
                return;
            }

            [...trimmed].forEach(c => c === '}' && sectionStack.length && sectionStack.pop());

            if (trimmed.length > 0 && [...trimmed].every(c => c === '}')) {
                result.lines.push({ lineNumber, raw, type: 'section_close' });
                return;
            }

            let sectionMatch = !trimmed.includes('=') && trimmed.includes('{') && trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
            if (sectionMatch) {
                sectionStack.push(sectionMatch[1]);
                result.sections.add(sectionStack.join(':'));
                result.lines.push({ lineNumber, raw, type: 'section_open', sectionName: sectionMatch[1] });
                return;
            }

            let paramInfo = this.parseParameterLine(trimmed, sectionStack);
            if (paramInfo) {
                result.parameters.set(paramInfo.paramPath, {
                    value: paramInfo.paramValue, lineNumber, sectionPath: [...sectionStack]
                });
                result.lines.push({
                    lineNumber, raw, type: 'parameter',
                    paramPath: paramInfo.paramPath, paramValue: paramInfo.paramValue,
                    sectionPath: [...sectionStack]
                });
            } else {
                result.lines.push({ lineNumber, raw, type: 'other' });
            }
        });

        return result;
    }

    parseParameterLine(line, sectionStack) {
        const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_:.-]*)\s*=\s*(.+?)(?:\s*#.*)?$/);
        if (!match) return null;

        const paramName = match[1];
        const paramPath = paramName.includes(':') ? paramName
            : (sectionStack.length ? `${sectionStack.join(':')}:${paramName}` : paramName);
        return { paramName, paramPath, paramValue: match[2].trim() };
    }

    parseFile(filePath) {
        if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
            return null;
        }

        const result = tryOrNull('HyprlandConfigParser.parseFile', () => GLib.file_get_contents(filePath));
        const [success, contents] = result ?? [];
        return success ? this.parse(decodeBytes(contents)) : null;
    }

    getParameterPaths(parseResult) {
        return Array.from(parseResult.parameters.keys());
    }

    toObject(parseResult) {
        const result = {};
        for (const [path, info] of parseResult.parameters) {
            result[path] = info.value;
        }
        return result;
    }
}

export default HyprlandConfigParser;
