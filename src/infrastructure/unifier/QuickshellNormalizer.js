import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull, tryRun } from '../utils/ErrorUtils.js';

export class QuickshellNormalizer {
    constructor(options = {}) {
        this.logger = options.logger || null;

        this.usernamePatterns = [
            /\$\{username\}/,
            /`file:\/\/\/home\/\$\{username\}/
        ];

        this.usernamePropertyTemplate = `
  property string username: ""
  Process {
    command: ["whoami"]
    running: true
    stdout: SplitParser { onRead: name => username = name }
  }
`;

        this.mouseAreaBlockingPattern = /MouseArea\s*\{[^}]*anchors\.fill:\s*parent[^}]*onWheel:[^}]*\}/gs;

        this.deprecatedPatterns = {
            qsMenuAnchorOpen: {
                pattern: /QsMenuAnchor\.open\(([^)]+)\)/g,
                replacement: '$1.popup ? $1.popup() : null'
            }
        };

        this.specialFiles = {
            faceImage: {
                sources: ['modules/user/face.jpg', 'modules/user/face.png', 'user/face.jpg', 'assets/face.jpg'],
                destination: '~/.face.jpg'
            },
            fonts: {
                sources: ['modules/fonts', 'fonts'],
                destination: '~/.local/share/fonts/'
            }
        };
    }

    log(msg, ...args) {
        if (this.logger?.info) {
            this.logger.info(`[QuickshellNormalizer] ${msg}`, ...args);
        }
    }

    rewriteThemeQml(themePath) {
        const fixes = [];
        const errors = [];

        const quickshellDirs = this.findQuickshellDirs(themePath);
        if (quickshellDirs.length === 0) {
            this.log('No quickshell config found, skipping');
            return { success: true, fixes: [], errors: [] };
        }

        this.log('Rewriting quickshell configs...');

        for (const quickshellDir of quickshellDirs) {
            const qmlFiles = this.findQmlFiles(quickshellDir.path);
            this.log(`Found ${qmlFiles.length} QML files in ${quickshellDir.path}`);

            for (const qmlFile of qmlFiles) {
                const result = tryOrNull(
                    `QuickshellNormalizer.processQmlFile:${qmlFile}`,
                    () => this.processQmlFile(qmlFile, quickshellDir)
                );
                result?.modified
                    ? fixes.push(...result.fixes)
                    : (!result && errors.push(`Error processing ${qmlFile}`));
            }
        }

        const specialResult = this.handleSpecialFiles(themePath);
        fixes.push(...specialResult.fixes);
        errors.push(...specialResult.errors);

        this.log(`Quickshell rewrite complete: ${fixes.length} fixes, ${errors.length} errors`);

        return {
            success: errors.length === 0,
            fixes,
            errors
        };
    }

    findQmlFiles(dirPath) {
        const files = [];

        const dir = Gio.File.new_for_path(dirPath);
        const enumerator = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);

        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const name = info.get_name();
            const type = info.get_file_type();
            const fullPath = `${dirPath}/${name}`;

            if (type === Gio.FileType.DIRECTORY) {
                files.push(...this.findQmlFiles(fullPath));
            }

            if (name.endsWith('.qml')) {
                files.push(fullPath);
            }
        }

        return files;
    }

    processQmlFile(filePath, context = {}) {
        const fixes = [];
        let modified = false;
        const themeRootRel = context.themeRootRel || null;
        const themeRootPath = context.themeRootPath || null;

        const [ok, contents] = GLib.file_get_contents(filePath);
        if (!ok) {
            throw new Error(`Cannot read file: ${filePath}`);
        }

        let content = new TextDecoder('utf-8').decode(contents);
        const originalContent = content;
        const fileName = filePath.split('/').pop();

        if (this.needsUsernameProperty(content)) {
            content = this.injectUsernameProperty(content);
            fixes.push(`${fileName}: Added username property`);
        }

        const imageFixResult = this.fixImageSources(content);
        if (imageFixResult.modified) {
            content = imageFixResult.content;
            fixes.push(`${fileName}: Fixed ${imageFixResult.count} Image sources`);
        }

        const mouseAreaResult = this.fixMouseAreaBlocking(content);
        if (mouseAreaResult.modified) {
            content = mouseAreaResult.content;
            fixes.push(`${fileName}: Fixed MouseArea click blocking`);
        }

        const apiResult = this.fixDeprecatedApi(content);
        if (apiResult.modified) {
            content = apiResult.content;
            fixes.push(`${fileName}: Fixed deprecated API calls`);
        }

        const anchorsResult = this.fixAnchorsInLayout(content);
        if (anchorsResult.modified) {
            content = anchorsResult.content;
            fixes.push(`${fileName}: Fixed anchors in layout`);
        }

        const animResult = this.fixBrokenAnimations(content);
        if (animResult.modified) {
            content = animResult.content;
            fixes.push(`${fileName}: Disabled broken animations`);
        }

        const connectionsResult = this.fixConnectionsUndefinedTarget(content);
        if (connectionsResult.modified) {
            content = connectionsResult.content;
            fixes.push(`${fileName}: Fixed Connections undefined target`);
        }

        const bindingLoopResult = this.fixBindingLoops(content);
        if (bindingLoopResult.modified) {
            content = bindingLoopResult.content;
            fixes.push(`${fileName}: Fixed binding loop`);
        }

        const rumdaResult = this.fixRumdaPaths(content, {
            filePath,
            themeRootRel,
            themeRootPath
        });
        if (rumdaResult.modified) {
            content = rumdaResult.content;
            fixes.push(...rumdaResult.fixes);
        }

        if (content !== originalContent) {
            GLib.file_set_contents(filePath, content);
            modified = true;
            this.log(`Modified: ${fileName}`);
        }

        return { modified, fixes };
    }

    needsUsernameProperty(content) {
        const usesUsername = this.usernamePatterns.some(p => p.test(content));
        const hasProperty = /property\s+string\s+username/.test(content);
        return usesUsername && !hasProperty;
    }

    injectUsernameProperty(content) {
        const rootElementMatch = content.match(/(Rectangle|Item|Scope|ColumnLayout|RowLayout)\s*\{/);
        if (!rootElementMatch) {
            return content;
        }

        const insertPos = content.indexOf('{', rootElementMatch.index) + 1;

        return content.slice(0, insertPos) + this.usernamePropertyTemplate + content.slice(insertPos);
    }

    fixImageSources(content) {
        let modified = false;
        let count = 0;

        const pattern = /source:\s*(`file:\/\/\/home\/\$\{username\}[^`]*`)/g;

        const newContent = content.replace(pattern, (match, templateLiteral) => {
            if (content.includes(`username ? ${templateLiteral}`)) {
                return match;
            }
            modified = true;
            count++;
            return `source: username ? ${templateLiteral} : ""`;
        });

        return { content: newContent, modified, count };
    }

    fixMouseAreaBlocking(content) {
        let modified = false;

        const pattern = /(MouseArea\s*\{[^}]*anchors\.fill:\s*parent)([^}]*onWheel:[^}]*\})/gs;

        const newContent = content.replace(pattern, (match, start, rest) => {
            if (match.includes('acceptedButtons')) {
                return match;
            }
            if (match.includes('onClicked') || match.includes('onPressed')) {
                return match;
            }
            modified = true;
            return start + '\n    acceptedButtons: Qt.NoButton' + rest;
        });

        return { content: newContent, modified };
    }

    fixDeprecatedApi(content) {
        let modified = false;
        let newContent = content;

        for (const [name, fix] of Object.entries(this.deprecatedPatterns)) {
            if (fix.pattern.test(newContent)) {
                newContent = newContent.replace(fix.pattern, fix.replacement);
                modified = true;
            }
        }

        return { content: newContent, modified };
    }

    fixAnchorsInLayout(content) {
        let modified = false;

        const pattern = /(Layout\.alignment:\s*Qt\.Align[HV]Center)\s*\n\s*(anchors\.(horizontal|vertical)Center:\s*parent\.\3Center)/g;

        const newContent = content.replace(pattern, (match, layout, anchors) => {
            modified = true;
            return layout;
        });

        return { content: newContent, modified };
    }

    fixBrokenAnimations(content) {
        let modified = false;
        let newContent = content;

        if (content.includes('property: "anchors.bottomMargin"') && content.includes('LazyLoader')) {
            const seqAnimPattern = /(SequentialAnimation\s*\{)\s*\n\s*id:\s*(\w+)\s*\n(?!.*running:)/gs;

            newContent = content.replace(seqAnimPattern, (match, start, id) => {
                const animBlock = content.slice(content.indexOf(match));
                if (animBlock.includes('property: "anchors.bottomMargin"')) {
                    modified = true;
                    return `${start}\n    id: ${id}\n    running: false
                }
                return match;
            });
        }

        return { content: newContent, modified };
    }

    fixConnectionsUndefinedTarget(content) {
        let modified = false;
        let newContent = content;

        const pattern = /Connections\s*\{\s*\n\s*target:\s*(\w+\.\w+\?\.\w+)\s*\n(?!\s*enabled:)/g;

        newContent = content.replace(pattern, (match, targetExpr) => {
            modified = true;
            return `Connections {\n    target: ${targetExpr} ?? null\n    enabled: target !== null\n`;
        });

        return { content: newContent, modified };
    }

    fixBindingLoops(content) {
        let modified = false;
        let newContent = content;

        if (content.includes('implicitHeight: childrenRect.height')) {
            const pattern = /implicitHeight:\s*childrenRect\.height\s*\+?\s*\d*/g;

            newContent = content.replace(pattern, (match) => {
                modified = true;
                return 'Layout.fillHeight: true';
            });
        }

        return { content: newContent, modified };
    }

    fixRumdaPaths(content, context) {
        const fixes = [];
        let modified = false;
        let newContent = content;

        if (!newContent.includes('rumda')) {
            return { content: newContent, modified, fixes };
        }

        const themeRootRel = context.themeRootRel;
        if (!themeRootRel) {
            return { content: newContent, modified, fixes };
        }

        const themeBasePath = `/${themeRootRel}`;

        const replaceAll = (from, to) => {
            if (newContent.includes(from)) {
                newContent = newContent.split(from).join(to);
                modified = true;
            }
        };

        replaceAll('/.config/rumda-pistachio', themeBasePath);
        replaceAll('/.config/rumda', themeBasePath);

        const pistachioPattern = /(^|[\s"'(])\.config\/rumda-pistachio/g;
        if (pistachioPattern.test(newContent)) {
            newContent = newContent.replace(pistachioPattern, `$1~/${themeRootRel}`);
            modified = true;
        }
        const rumdaPattern = /(^|[\s"'(])\.config\/rumda(?!-pistachio)/g;
        if (rumdaPattern.test(newContent)) {
            newContent = newContent.replace(rumdaPattern, `$1~/${themeRootRel}`);
            modified = true;
        }

        if (newContent.includes('catAnimationFolder') && newContent.includes('gato-jump')) {
            const before = newContent;
            newContent = newContent
                .replace('/light/gato-jump', '/light/icons/rumda-the-cat/gato-jump')
                .replace('/dark/gato-jump', '/dark/icons/rumda-the-cat/gato-jump');
            if (newContent !== before) {
                modified = true;
                fixes.push(`${context.filePath.split('/').pop()}: Fixed cat animation folder`);
            }
        }

        if (context.filePath.endsWith('/Common.qml') && newContent.includes('cEnableCat')) {
            const before = newContent;
            newContent = newContent.replace(
                /readonly\s+property\s+bool\s+cEnableCat:\s*false\b/,
                'readonly property bool cEnableCat: true'
            );
            if (newContent !== before) {
                modified = true;
                fixes.push(`${context.filePath.split('/').pop()}: Enabled cat by default`);
            }
        }

        if (newContent.includes('rumda-the-cat') && newContent.includes('walk_frames')) {
            const variant = context.filePath.includes('/dark/')
                ? 'dark'
                : (context.filePath.includes('/light/') ? 'light' : null);
            if (variant) {
                const catFramesPath = `${themeBasePath}/common/quickshell/${variant}/icons/rumda-the-cat/walk_frames`;
                const catFramesPattern = /\/\.config\/rumda(?:-pistachio)?\/(?:light|dark)-config\/quickshell\/rumda-the-cat\/walk_frames/g;
                if (catFramesPattern.test(newContent)) {
                    newContent = newContent.replace(catFramesPattern, catFramesPath);
                    modified = true;
                    fixes.push(`${context.filePath.split('/').pop()}: Fixed cat frames path`);
                }
            }
        }

        if (modified && fixes.length === 0) {
            fixes.push(`${context.filePath.split('/').pop()}: Updated rumda paths`);
        }

        return { content: newContent, modified, fixes };
    }

    getThemeRootForQuickshellDir(dirPath) {
        if (!dirPath) return null;
        const root = dirPath.replace(/\/(common|config|\.config)\/quickshell$/, '');
        return root !== dirPath ? root : null;
    }

    getThemeRootRel(themeRootPath) {
        if (!themeRootPath) return null;
        const homeDir = GLib.get_home_dir();
        if (!themeRootPath.startsWith(homeDir)) return null;
        let rel = themeRootPath.slice(homeDir.length);
        if (rel.startsWith('/')) rel = rel.slice(1);
        return rel || null;
    }

    findQuickshellDirs(themePath) {
        const dirs = new Map();
        const addDir = (dirPath) => {
            if (!GLib.file_test(dirPath, GLib.FileTest.IS_DIR)) return;
            if (dirs.has(dirPath)) return;
            const themeRootPath = this.getThemeRootForQuickshellDir(dirPath);
            const themeRootRel = this.getThemeRootRel(themeRootPath);
            dirs.set(dirPath, {
                path: dirPath,
                themeRootPath,
                themeRootRel
            });
        };

        addDir(`${themePath}/config/quickshell`);
        addDir(`${themePath}/common/quickshell`);
        addDir(`${themePath}/.config/quickshell`);

        const baseDir = Gio.File.new_for_path(themePath);
        if (baseDir.query_exists(null)) {
            tryRun('QuickshellNormalizer.findQuickshellDirs', () => {
                const enumerator = baseDir.enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );
                let info;
                while ((info = enumerator.next_file(null)) !== null) {
                    if (info.get_file_type() !== Gio.FileType.DIRECTORY) continue;
                    const name = info.get_name();
                    addDir(`${themePath}/${name}/config/quickshell`);
                    addDir(`${themePath}/${name}/common/quickshell`);
                    addDir(`${themePath}/${name}/.config/quickshell`);
                }
                enumerator.close(null);
            });
        }

        return Array.from(dirs.values());
    }

    handleSpecialFiles(themePath) {
        const fixes = [];
        const errors = [];

        for (const source of this.specialFiles.faceImage.sources) {
            const sourcePath = `${themePath}/${source}`;
            if (GLib.file_test(sourcePath, GLib.FileTest.EXISTS)) {
                const startScriptsDir = `${themePath}/start-scripts`;
                if (!GLib.file_test(startScriptsDir, GLib.FileTest.IS_DIR)) {
                    GLib.mkdir_with_parents(startScriptsDir, 0o755);
                }

                const copied = tryRun('QuickshellNormalizer.copyFaceImage', () => {
                    const sourceFile = Gio.File.new_for_path(sourcePath);
                    const destFile = Gio.File.new_for_path(`${startScriptsDir}/face.jpg`);
                    sourceFile.copy(destFile, Gio.FileCopyFlags.OVERWRITE, null, null);
                    this.addFaceInstallCommand(themePath);
                });
                copied
                    ? fixes.push(`Copied face image from ${source}`)
                    : errors.push(`Failed to copy face image: ${source}`);
                break;
            }
        }

        for (const source of this.specialFiles.fonts.sources) {
            const sourcePath = `${themePath}/${source}`;
            if (GLib.file_test(sourcePath, GLib.FileTest.IS_DIR)) {
                const copied = tryRun('QuickshellNormalizer.copyFonts', () => {
                    const fontsDestDir = `${themePath}/start-scripts/fonts`;
                    this.copyDirectory(sourcePath, fontsDestDir);
                    this.addFontsInstallCommand(themePath);
                });
                copied
                    ? fixes.push(`Copied fonts from ${source}`)
                    : errors.push(`Failed to copy fonts: ${source}`);
                break;
            }
        }

        return { fixes, errors };
    }

    copyDirectory(srcPath, destPath) {
        if (!GLib.file_test(destPath, GLib.FileTest.IS_DIR)) {
            GLib.mkdir_with_parents(destPath, 0o755);
        }

        const dir = Gio.File.new_for_path(srcPath);
        const enumerator = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);

        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const name = info.get_name();
            const type = info.get_file_type();
            const srcFile = `${srcPath}/${name}`;
            const destFile = `${destPath}/${name}`;

            if (type === Gio.FileType.DIRECTORY) {
                this.copyDirectory(srcFile, destFile);
            } else {
                const src = Gio.File.new_for_path(srcFile);
                const dest = Gio.File.new_for_path(destFile);
                src.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
            }
        }
    }

    addFaceInstallCommand(themePath) {
        const scriptPath = `${themePath}/start-scripts/set_after_install_actions.sh`;

        let content = '';
        if (GLib.file_test(scriptPath, GLib.FileTest.EXISTS)) {
            const [ok, data] = GLib.file_get_contents(scriptPath);
            if (ok) {
                content = new TextDecoder('utf-8').decode(data);
            }
        }

        if (content.includes('face.jpg')) {
            return;
        }

        const faceCommand = `
# Install profile picture
if [ -f "$THEME_DIR/start-scripts/face.jpg" ]; then
    cp "$THEME_DIR/start-scripts/face.jpg" ~/.face.jpg
    log "Installed profile picture"
fi
`;

        if (content.includes('exit 0')) {
            content = content.replace('exit 0', faceCommand + '\nexit 0');
        } else {
            content += faceCommand;
        }

        GLib.file_set_contents(scriptPath, content);
    }

    addFontsInstallCommand(themePath) {
        const scriptPath = `${themePath}/start-scripts/set_after_install_actions.sh`;

        let content = '';
        if (GLib.file_test(scriptPath, GLib.FileTest.EXISTS)) {
            const [ok, data] = GLib.file_get_contents(scriptPath);
            if (ok) {
                content = new TextDecoder('utf-8').decode(data);
            }
        }

        if (content.includes('fc-cache')) {
            return;
        }

        const fontsCommand = `
# Install theme fonts
if [ -d "$THEME_DIR/start-scripts/fonts" ]; then
    mkdir -p ~/.local/share/fonts
    cp -r "$THEME_DIR/start-scripts/fonts/"* ~/.local/share/fonts/
    fc-cache -fv > /dev/null 2>&1
    log "Installed theme fonts"
fi
`;

        if (content.includes('exit 0')) {
            content = content.replace('exit 0', fontsCommand + '\nexit 0');
        } else {
            content += fontsCommand;
        }

        GLib.file_set_contents(scriptPath, content);
    }
}
