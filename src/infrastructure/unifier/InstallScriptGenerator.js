import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrDefault, tryOrFalse, tryOrNull, tryRun } from '../utils/ErrorUtils.js';

export class InstallScriptGenerator {
    constructor(options = {}) {
        this.logger = options.logger || null;
        this.isolationService = options.isolationService || null;
        this.settingsManager = options.settingsManager || null;

        this.dependencyMap = {
            'waybar': 'waybar',
            'ags': 'aylurs-gtk-shell',
            'eww': 'eww',
            'quickshell': 'quickshell-git',
            'fabric': 'fabric-git',
            'rofi': 'rofi-wayland',
            'wofi': 'wofi',
            'dunst': 'dunst',
            'mako': 'mako',
            'kitty': 'kitty',
            'alacritty': 'alacritty',
            'foot': 'foot',
            'wezterm': 'wezterm',
            'swaylock': 'swaylock-effects',
            'hyprlock': 'hyprlock',
            'hypridle': 'hypridle',
            'hyprpaper': 'hyprpaper',
            'swww': 'swww',
            'swaync': 'swaync',
            'wlogout': 'wlogout',
            'nwg-look': 'nwg-look',
            'nwg-dock-hyprland': 'nwg-dock-hyprland',
            'cava': 'cava',
            'btop': 'btop',
            'neofetch': 'neofetch',
            'fastfetch': 'fastfetch',
            'starship': 'starship',
            'fish': 'fish',
            'zsh': 'zsh',
            'qt5ct': 'qt5ct',
            'kvantum': 'kvantum',
            'gtk-3.0': 'gtk3',
            'gtk-4.0': 'gtk4'
        };

        this.execDependencyMap = {
            'quickshell': 'quickshell-git',
            'fabric': 'fabric-git',
            'pywal': 'python-pywal',
            'wal': 'python-pywal',
            'swww': 'swww',
            'swaybg': 'swaybg',
            'hyprpaper': 'hyprpaper',
            'waybar': 'waybar',
            'nwg-dock-hyprland': 'nwg-dock-hyprland',
            'ags': 'aylurs-gtk-shell',
            'eww': 'eww',
            'nm-applet': 'network-manager-applet',
            'blueman-applet': 'blueman',
            'polkit': 'polkit-gnome',
            'dunst': 'dunst',
            'mako': 'mako',
            'playerctl': 'playerctl',
            'pamixer': 'pamixer',
            'brightnessctl': 'brightnessctl',
            'wl-copy': 'wl-clipboard',
            'wl-paste': 'wl-clipboard',
            'grim': 'grim',
            'slurp': 'slurp',
            'jq': 'jq',
            'socat': 'socat',
            'cliphist': 'cliphist'
        };

        this.packagePatterns = [
            /yay\s+-S[^\n]*?([a-z0-9-]+)/gi,
            /paru\s+-S[^\n]*?([a-z0-9-]+)/gi,
            /pacman\s+-S[^\n]*?([a-z0-9-]+)/gi,
            /^\s*-\s*`?([a-z0-9-]+)`?\s*$/gim,
            /install\s+([a-z0-9-]+)/gi
        ];

        this.blockedPackages = new Set([
            'wayland', 'wayland-protocols', 'xwayland',
            'xorg-server', 'xorg-xinit', 'xorg',
            'hyprland', 'hyprland-git', 'hyprland-nvidia',
            'sway', 'sway-git',
            'linux', 'linux-lts', 'linux-zen', 'linux-hardened',
            'linux-headers', 'linux-lts-headers',
            'systemd', 'glibc', 'gcc', 'binutils',
            'base', 'base-devel', 'filesystem',
            'nvidia', 'nvidia-dkms', 'nvidia-open', 'nvidia-utils',
            'mesa', 'vulkan-radeon', 'vulkan-intel',
            'amd-ucode', 'intel-ucode',
            'glib2', 'gtk3', 'gtk4', 'qt5-base', 'qt6-base',
            'grub', 'systemd-boot', 'efibootmgr',
            'mkinitcpio', 'dracut',
            'pacman', 'yay', 'paru'
        ]);

        this.widgetSpecificConfig = {
            ignis: {
                aurFlags: { 'goignis': ['--nocheck'] },
                isolatedBuild: {
                    enabled: true,
                    pythonRepo: 'https://github.com/linkfrg/ignis.git',
                    goRepo: 'https://github.com/ignis-sh/goignis.git',
                    aurPackagesToReplace: ['python-ignis', 'goignis'],
                    goBinary: {
                        buildCmd: 'go build -o goignis .',
                        binary: 'goignis',
                        prerequisites: ['go']
                    },
                    pythonPackage: {
                        pipInstall: '.',
                        venvPipDeps: ['Pillow', 'numpy', 'scikit-learn', 'rapidfuzz', 'python-pam', 'six'],
                        patches: [
                            {
                                type: 'future_annotations',
                                description: 'Add from __future__ import annotations to defer type hints'
                            },
                            {
                                type: 'glib_compat',
                                description: 'GLib 2.86+ (Gio.DesktopAppInfo -> GioUnix)'
                            },
                            {
                                type: 'audio_service_graceful',
                                description: 'Make audio service optional (ignis-gvc may not build)'
                            }
                        ]
                    }
                },
                postInstallPatches: [{
                    description: 'GLib 2.86+ compatibility (Gio.DesktopAppInfo -> GioUnix)',
                    files: [
                        '/usr/lib/python3.13/site-packages/ignis/services/applications/action.py',
                        '/usr/lib/python3.13/site-packages/ignis/services/applications/application.py',
                        '/usr/lib/python3.13/site-packages/ignis/services/applications/service.py',
                        '/usr/lib/python3.13/site-packages/ignis/utils/icon.py'
                    ],
                    type: 'glib_compat'
                }],
                provides: ['notification_daemon', 'bar'],
                conflictsWith: ['swaync', 'mako', 'dunst', 'fnott', 'deadd-notification-center']
            },
            ags: {
                aurFlags: {},
                postInstallPatches: [],
                provides: ['notification_daemon', 'bar', 'launcher'],
                conflictsWith: ['swaync', 'mako', 'dunst', 'fnott', 'waybar', 'polybar']
            },
            eww: {
                aurFlags: {},
                postInstallPatches: [],
                provides: ['bar'],
                conflictsWith: ['waybar', 'polybar', 'ags']
            },
            waybar: {
                aurFlags: {},
                postInstallPatches: [],
                provides: ['bar'],
                conflictsWith: ['polybar', 'eww', 'ags']
            },
            'nwg-dock-hyprland': {
                aurFlags: {},
                postInstallPatches: [],
                provides: ['bar'],
                conflictsWith: []
            },
            hyprpanel: {
                aurFlags: {},
                postInstallPatches: [],
                provides: ['notification_daemon', 'bar'],
                conflictsWith: ['swaync', 'mako', 'dunst', 'waybar', 'polybar', 'eww']
            },
            fabric: {
                aurFlags: {},
                postInstallPatches: [],
                provides: ['bar'],
                conflictsWith: ['waybar', 'polybar', 'eww', 'ags']
            },
            quickshell: {
                aurFlags: {},
                postInstallPatches: [],
                provides: ['bar'],
                conflictsWith: ['waybar', 'polybar', 'eww', 'ags'],
                isolatedBuild: {
                    enabled: true,
                    aurPackagesToReplace: ['quickshell-git']
                }
            },
            swaync: {
                aurFlags: {},
                postInstallPatches: [],
                provides: ['notification_daemon'],
                conflictsWith: ['mako', 'dunst', 'fnott', 'ags', 'ignis', 'hyprpanel']
            },
            mako: {
                aurFlags: {},
                postInstallPatches: [],
                provides: ['notification_daemon'],
                conflictsWith: ['swaync', 'dunst', 'fnott', 'ags', 'ignis', 'hyprpanel']
            },
            dunst: {
                aurFlags: {},
                postInstallPatches: [],
                provides: ['notification_daemon'],
                conflictsWith: ['swaync', 'mako', 'fnott', 'ags', 'ignis', 'hyprpanel']
            }
        };

        this.serviceProcessMap = {
            notification_daemon: ['swaync', 'mako', 'dunst', 'fnott', 'deadd-notification-center'],
            bar: ['waybar', 'polybar', 'eww', 'ags', 'ignis', 'goignis', 'hyprpanel', 'fabric', 'quickshell', 'nwg-dock-hyprland'],
            launcher: ['rofi', 'wofi', 'fuzzel', 'anyrun', 'tofi']
        };

        this.knownAppDependencies = {
            ignis: {
                regular: [
                    'python-pillow', 'python-numpy', 'python-scikit-learn',
                    'python-rapidfuzz', 'python-pam', 'python-requests',
                    'gtk4', 'gtk4-layer-shell', 'libpulse'
                ],
                aur: ['python-ignis', 'goignis']
            },
            ags: {
                regular: ['gjs', 'gtk3', 'gtk-layer-shell', 'libpulse', 'libsoup3', 'networkmanager'],
                aur: ['aylurs-gtk-shell']
            },
            eww: {
                regular: ['gtk3', 'gtk-layer-shell', 'pango', 'gdk-pixbuf2', 'libdbusmenu-gtk3'],
                aur: ['eww']
            },
            fabric: {
                regular: [
                    'python-cairo', 'python-gobject', 'gtk3', 'gtk-layer-shell',
                    'libpulse', 'playerctl'
                ],
                aur: ['fabric-git', 'python-fabric']
            },
            quickshell: {
                regular: [
                    'qt6-base', 'qt6-declarative', 'qt6-wayland', 'qt6-svg',
                    'qt6-5compat', 'qt6-imageformats', 'qt6-multimedia',
                    'qt6-shadertools', 'qt6-tools', 'pipewire', 'wireplumber'
                ],
                aur: ['quickshell-git']
            },
            waybar: {
                regular: [
                    'waybar', 'gtkmm3', 'libpulse', 'libnl', 'libappindicator-gtk3',
                    'libdbusmenu-gtk3', 'libmpdclient', 'spdlog', 'playerctl'
                ],
                aur: []
            },
            hyprpanel: {
                regular: ['gjs', 'gtk3', 'gtk-layer-shell', 'libpulse', 'networkmanager'],
                aur: ['ags', 'hyprpanel-git']
            }
        };

        this.nonQueryableDeps = {
            pip: {
                'material-color-utilities': ['pillow', 'numpy'],
                'pywal': [],
                'haishoku': ['pillow'],
                'colorthief': ['pillow'],
                'i3ipc': [],
                'psutil': [],
                'pulsectl': [],
                'dbus-python': [],
                'pygobject': [],
                'pycairo': [],
                'pillow': [],
                'numpy': [],
                'scikit-learn': ['numpy', 'scipy'],
                'rapidfuzz': []
            },
            cargo: {
                'swww': [],
                'eww': [],
                'eza': [],
                'bat': [],
                'fd-find': [],
                'ripgrep': [],
                'starship': [],
                'zoxide': [],
                'hyprdim': [],
                'hyprsome': []
            },
            npm: {
                'sass': [],
                'typescript': [],
                'ts-node': ['typescript'],
                'bun': []
            },
            go: {
                'goignis': []
            }
        };
    }

    log(msg, ...args) {
        if (this.logger?.info) {
            this.logger.info(`[InstallScriptGenerator] ${msg}`, ...args);
        }
    }

    readTextFile(path, context) {
        return tryOrNull(context, () => {
            const [ok, content] = GLib.file_get_contents(path);
            return ok ? new TextDecoder().decode(content) : null;
        });
    }

    runCommand(command, context) {
        return tryOrNull(context, () => GLib.spawn_command_line_sync(command));
    }

    getGitCloneStrategy() {
        switch (this.settingsManager?.get?.('gitUrlMode') || 'https') {
            case 'ssh':
                return { gitCloneCommand: 'local GIT_SAFE_CLONE="git clone --depth 1"' };
            case 'https':
                return {
                    gitCloneCommand: 'local GIT_SAFE_CLONE="env GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null GIT_TERMINAL_PROMPT=0 git clone --depth 1"'
                };
            default:
                return { gitCloneCommand: 'local GIT_SAFE_CLONE="git clone --depth 1"' };
        }
    }


    getAURInstallFlags(packageName, detectedApps = []) {
        for (const app of detectedApps) {
            const config = this.widgetSpecificConfig[app.toLowerCase()];
            if (config?.aurFlags?.[packageName]) {
                return config.aurFlags[packageName];
            }
        }
        return [];
    }

    getConflictingProcesses(detectedApps) {
        const toKill = new Set();
        const providing = new Set();

        for (const app of detectedApps) {
            const config = this.widgetSpecificConfig[app.toLowerCase()];
            if (!config) continue;

            (config.provides || []).forEach(s => providing.add(s));

            (config.conflictsWith || []).forEach(p => toKill.add(p));
        }

        for (const serviceType of providing) {
            const processes = this.serviceProcessMap[serviceType] || [];
            processes.forEach(p => toKill.add(p));
        }

        for (const app of detectedApps) {
            toKill.delete(app.toLowerCase());
        }

        return toKill;
    }

    generatePostInstallPatches(detectedApps) {
        const patches = [];

        for (const app of detectedApps) {
            const config = this.widgetSpecificConfig[app.toLowerCase()];
            if (!config?.postInstallPatches?.length) continue;

            for (const patch of config.postInstallPatches) {
                if (patch.type === 'glib_compat') {
                    patches.push(this.generateGLibCompatPatch(patch));
                }
            }
        }

        if (patches.length === 0) return '';

        return `
# ────────────────────────────────────────────────────────────────
# Post-install patches (widget-specific compatibility fixes)
# ────────────────────────────────────────────────────────────────
${patches.join('\n')}
`;
    }

    generateGLibCompatPatch(patch) {
        const files = patch.files.map(f => `"${f}"`).join(' ');

        return `
# GLib 2.86+ compatibility patch: ${patch.description}
apply_glib_compat_patch() {
    log "[PATCH] Applying GLib 2.86+ compatibility patch..."

    # Check if glib2 version requires patch (2.86+)
    GLIB_VERSION=\$(pacman -Q glib2 2>/dev/null | awk "{print \\\$2}" | cut -d"-" -f1)
    GLIB_MAJOR=\$(echo "\$GLIB_VERSION" | cut -d"." -f1)
    GLIB_MINOR=\$(echo "\$GLIB_VERSION" | cut -d"." -f2)

    if [ "\$GLIB_MAJOR" -lt 2 ] || ([ "\$GLIB_MAJOR" -eq 2 ] && [ "\$GLIB_MINOR" -lt 86 ]); then
        log "[PATCH] GLib version \$GLIB_VERSION < 2.86, patch not needed"
        return
    fi

    log "[PATCH] GLib version \$GLIB_VERSION >= 2.86, applying patch..."

    PATCH_FILES=(${files})

    for file in "\${PATCH_FILES[@]}"; do
        if [ ! -f "\$file" ]; then
            log "[PATCH] File not found: \$file (skipping)"
            continue
        fi

        # Check if already patched
        if grep -q "GioUnix.DesktopAppInfo" "\$file" 2>/dev/null; then
            log "[PATCH] Already patched: \$file"
            continue
        fi

        # Check if needs patching
        if ! grep -q "Gio.DesktopAppInfo" "\$file" 2>/dev/null; then
            log "[PATCH] No Gio.DesktopAppInfo found in: \$file"
            continue
        fi

        log "[PATCH] Patching: \$file"

        # Create backup
        sudo cp "\$file" "\$file.bak" 2>/dev/null

        # Apply patch using sed (use octal \\047 for single quotes - works inside bash -c)
        # Add GioUnix import after Gio import
        sudo sed -i "s/from gi.repository import Gio\$/import gi; gi.require_version(\\047GioUnix\\047, \\0472.0\\047)\\nfrom gi.repository import Gio, GioUnix/" "\$file"
        # Replace Gio.DesktopAppInfo with GioUnix.DesktopAppInfo
        sudo sed -i "s/Gio\\.DesktopAppInfo/GioUnix.DesktopAppInfo/g" "\$file"
        log "[PATCH] Patched: \$file"

    done

    # Clear Python cache to ensure patched files are used
    log "[PATCH] Clearing Python cache..."
    sudo find /usr/lib/python*/site-packages/ignis -name "*.pyc" -delete 2>/dev/null
    sudo find /usr/lib/python*/site-packages/ignis -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

    log "[PATCH] GLib compatibility patch applied"
}
apply_glib_compat_patch
`;
    }

    generateKillConflictingServices(detectedApps) {
        const toKill = this.getConflictingProcesses(detectedApps);

        if (toKill.size === 0) return '';

        const processList = Array.from(toKill).map(p => `"${p}"`).join(' ');

        return `
# ────────────────────────────────────────────────────────────────
# Kill conflicting services (notification daemons, bars, etc.)
# ────────────────────────────────────────────────────────────────
kill_conflicting_services() {
    log "[CLEANUP] Killing conflicting services..."

    CONFLICTING_PROCESSES=(${processList})

    for proc in "\${CONFLICTING_PROCESSES[@]}"; do
        if pgrep -x "\$proc" &>/dev/null; then
            log "[KILL] Stopping \$proc..."
            # Some daemons (e.g. mako) are managed by systemd and will auto-restart after pkill.
            # Stop the user unit first so the bar can spawn its own notification backend.
            if [ "\$proc" = "mako" ] && command -v systemctl &>/dev/null; then
                systemctl --user stop mako.service 2>/dev/null || true
            fi
            pkill -x "\$proc" 2>/dev/null || true
        fi
    done

    # Give processes time to exit gracefully
    sleep 0.5

    # Force kill any remaining
    for proc in "\${CONFLICTING_PROCESSES[@]}"; do
        if pgrep -x "\$proc" &>/dev/null; then
            log "[KILL] Force killing \$proc..."
            pkill -9 -x "\$proc" 2>/dev/null || true
        fi
    done

    log "[CLEANUP] Conflicting services stopped"
}
kill_conflicting_services
`;
    }

    generateIsolatedWidgetBuild(widget, riceName) {
        const widgetLower = widget.toLowerCase();
        const config = this.widgetSpecificConfig[widgetLower];
        if (!config?.isolatedBuild?.enabled) return '';

        const isolationEnabled = this.isIsolationEnabled();
        if (!isolationEnabled) return '';

        const mode = this.getIsolationMode();
        const homeDir = GLib.get_home_dir();
        const basePath = `${homeDir}/.local/share/lastlayer/programs`;
        const venvPath = `${basePath}/rices/${riceName}/venv`;

        let installPath;
        switch (mode) {
            case 'per-rice':
                installPath = `${basePath}/rices/${riceName}`;
                break;
            case 'per-program':
                installPath = `${basePath}/${widgetLower}/isolated`;
                break;
            case 'hybrid':
            default:
                installPath = `${basePath}/shared/${widgetLower}/isolated`;
        }

        const build = config.isolatedBuild;

        const prereqs = build.goBinary?.prerequisites || [];
        const prereqsCheck = prereqs.length > 0 ? prereqs.map(p => `
    if ! command -v ${p} &>/dev/null; then
        log "[PREREQ] Installing ${p}..."
        sudo pacman -S --noconfirm ${p} < /dev/null 2>&1 | tee -a "$LOG_FILE" || return 1
    fi`).join('') : '';

        const goRepoUrl = build.goRepo || build.pythonRepo || build.repo;
        const goBuildSection = build.goBinary ? `
    # Build ${build.goBinary.binary} binary from source (from separate repo if configured)
    log "[ISOLATED_BUILD] Cloning ${build.goBinary.binary} repository..."
    local GO_BUILD_DIR="/tmp/${build.goBinary.binary}-build-$$"
    rm -rf "$GO_BUILD_DIR"
    git clone --depth 1 "${goRepoUrl}" "$GO_BUILD_DIR" 2>&1 | tee -a "$LOG_FILE"
    if [ $? -ne 0 ]; then
        log "[ERROR] Failed to clone ${build.goBinary.binary} repository"
    else
        cd "$GO_BUILD_DIR"
        log "[ISOLATED_BUILD] Building ${build.goBinary.binary} binary..."
        mkdir -p "$INSTALL_PREFIX/bin"
        ${build.goBinary.buildCmd} 2>&1 | tee -a "$LOG_FILE"
        if [ $? -eq 0 ] && [ -f "${build.goBinary.binary}" ]; then
            mv ${build.goBinary.binary} "$INSTALL_PREFIX/bin/"
            chmod +x "$INSTALL_PREFIX/bin/${build.goBinary.binary}"
            log "[SUCCESS] ${build.goBinary.binary} built: $INSTALL_PREFIX/bin/${build.goBinary.binary}"
        else
            log "[ERROR] Failed to build ${build.goBinary.binary}"
        fi
        cd /
        rm -rf "$GO_BUILD_DIR"
    fi` : '';

        const pythonSection = build.pythonPackage ? this.generatePythonPackageSection(
            widgetLower,
            build.pythonPackage,
            venvPath
        ) : '';

        const funcName = `build_isolated_${widgetLower}`;

        const checkConditions = [];
        if (build.goBinary) {
            checkConditions.push(`[ -x "$INSTALL_PREFIX/bin/${build.goBinary.binary}" ]`);
        }
        if (build.pythonPackage) {
            checkConditions.push(`[ -f "$VENV_PATH/bin/activate" ]`);
        }
        const alreadyBuiltCheck = checkConditions.length > 0
            ? `if ${checkConditions.join(' && ')}; then
        log "[ISOLATED_BUILD] ${widget} already built in isolation prefix"
        return 0
    fi`
            : '';

        const pythonRepoUrl = build.pythonRepo || build.repo;

        return `
# ────────────────────────────────────────────────────────────────
# ISOLATED BUILD: ${widget} (prevents system-wide patches)
# GENERIC: This section is auto-generated from widgetSpecificConfig
# ────────────────────────────────────────────────────────────────
${funcName}() {
    log "[ISOLATED_BUILD] Building ${widget} in isolation prefix..."

    local PYTHON_REPO="${pythonRepoUrl}"
    local INSTALL_PREFIX="${installPath}"
    local VENV_PATH="${venvPath}"
    local BUILD_DIR="/tmp/${widgetLower}-build-$$"

    # Check if already built
    ${alreadyBuiltCheck}

    # Prerequisites${prereqsCheck}
${goBuildSection}
    # Clone Python package repository
    log "[ISOLATED_BUILD] Cloning ${widget} Python package repository..."
    rm -rf "$BUILD_DIR"
    git clone --depth 1 "$PYTHON_REPO" "$BUILD_DIR" 2>&1 | tee -a "$LOG_FILE"
    if [ $? -ne 0 ]; then
        log "[ERROR] Failed to clone ${widget} repository"
        return 1
    fi

    cd "$BUILD_DIR"
${pythonSection}
    # Cleanup
    cd /
    rm -rf "$BUILD_DIR"

    # Write install date
    mkdir -p "$INSTALL_PREFIX"
    echo "$(date +%Y-%m-%d)" > "$INSTALL_PREFIX/.install_date"

    log "[ISOLATED_BUILD] ${widget} build complete!"
}
${funcName}
`;
    }

    generateHyprpanelIsolatedBuild(riceName) {
        const installPrefix = this.getHyprpanelAdaptivePrefix(riceName);
        const { gitCloneCommand } = this.getGitCloneStrategy();

        return `
# ────────────────────────────────────────────────────────────────
# ISOLATED BUILD: HyprPanel (ags + hyprpanel in per-rice prefix)
# ────────────────────────────────────────────────────────────────
build_isolated_hyprpanel() {
    log "[ISOLATED_BUILD] Building HyprPanel in isolation prefix..."

    local INSTALL_PREFIX="${installPrefix}"
    local BUILD_DIR="$HOME/.cache/lastlayer/hyprpanel-build-${riceName}"
    local AGS_REPO="https://github.com/Aylur/ags.git"
    local HYPRPANEL_REPO="https://github.com/Jas-SinghFSU/HyprPanel.git"
    ${gitCloneCommand}

    if [ -x "$INSTALL_PREFIX/bin/hyprpanel" ]; then
        log "[ISOLATED_BUILD] HyprPanel already built in prefix: $INSTALL_PREFIX"
        return 0
    fi

    if ! command -v git &> /dev/null; then
        log "[ERROR] git not found. Cannot build HyprPanel."
        return 1
    fi
    if ! command -v meson &> /dev/null || ! command -v ninja &> /dev/null; then
        log "[ERROR] meson/ninja not found. Cannot build HyprPanel."
        return 1
    fi
    if ! command -v npm &> /dev/null; then
        log "[ERROR] npm not found. Cannot build HyprPanel."
        return 1
    fi

    mkdir -p "$BUILD_DIR"
    rm -rf "$BUILD_DIR/ags" "$BUILD_DIR/HyprPanel"

    log "[ISOLATED_BUILD] Cloning AGS..."
    $GIT_SAFE_CLONE "$AGS_REPO" "$BUILD_DIR/ags" 2>&1 | tee -a "$LOG_FILE"
    if [ $? -ne 0 ]; then
        log "[ERROR] Failed to clone AGS"
        return 1
    fi

    log "[ISOLATED_BUILD] Building AGS..."
    (cd "$BUILD_DIR/ags" && meson setup --prefix "$INSTALL_PREFIX" build 2>&1 | tee -a "$LOG_FILE")
    (cd "$BUILD_DIR/ags" && meson compile -C build 2>&1 | tee -a "$LOG_FILE")
    (cd "$BUILD_DIR/ags" && meson install -C build 2>&1 | tee -a "$LOG_FILE")

    log "[ISOLATED_BUILD] Cloning HyprPanel..."
    $GIT_SAFE_CLONE "$HYPRPANEL_REPO" "$BUILD_DIR/HyprPanel" 2>&1 | tee -a "$LOG_FILE"
    if [ $? -ne 0 ]; then
        log "[ERROR] Failed to clone HyprPanel"
        return 1
    fi

    log "[ISOLATED_BUILD] Installing HyprPanel dependencies..."
    (cd "$BUILD_DIR/HyprPanel" && rm -f package-lock.json && npm install 2>&1 | tee -a "$LOG_FILE")

    log "[ISOLATED_BUILD] Building HyprPanel..."
    (cd "$BUILD_DIR/HyprPanel" && PATH="$INSTALL_PREFIX/bin:$PATH" meson setup --prefix "$INSTALL_PREFIX" build 2>&1 | tee -a "$LOG_FILE")
    (cd "$BUILD_DIR/HyprPanel" && meson compile -C build 2>&1 | tee -a "$LOG_FILE")
    (cd "$BUILD_DIR/HyprPanel" && meson install -C build 2>&1 | tee -a "$LOG_FILE")

    log "[ISOLATED_BUILD] HyprPanel build complete!"
}
build_isolated_hyprpanel
`;
    }

    generateQuickshellIsolatedBuild(riceName) {
        const installPrefix = this.getQuickshellAdaptivePrefix(riceName);
        const isolationMode = this.getIsolationMode();
        const buildSuffix = isolationMode === 'per-rice' ? riceName : isolationMode;
        const { gitCloneCommand } = this.getGitCloneStrategy();

        return `
# ────────────────────────────────────────────────────────────────
# ISOLATED BUILD: Quickshell (isolated prefix)
# ────────────────────────────────────────────────────────────────
build_isolated_quickshell() {
    log "[ISOLATED_BUILD] Building Quickshell in isolation prefix..."

    local INSTALL_PREFIX="${installPrefix}"
    local BUILD_DIR="$HOME/.cache/lastlayer/quickshell-build-${buildSuffix}"
    local QUICKSHELL_REPO="https://git.outfoxxed.me/quickshell/quickshell.git"
    local SOURCE_DIR="$BUILD_DIR"
    ${gitCloneCommand}

    if [ -x "$INSTALL_PREFIX/bin/quickshell" ]; then
        log "[ISOLATED_BUILD] Quickshell already built in prefix: $INSTALL_PREFIX"
        return 0
    fi

    if ! command -v git &> /dev/null; then
        log "[ERROR] git not found. Cannot build Quickshell."
        return 1
    fi
    if ! command -v cmake &> /dev/null && ! command -v meson &> /dev/null; then
        log "[ERROR] cmake/meson not found. Cannot build Quickshell."
        return 1
    fi
    if ! command -v ninja &> /dev/null; then
        log "[ERROR] ninja not found. Cannot build Quickshell."
        return 1
    fi

    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    log "[ISOLATED_BUILD] Cloning Quickshell..."
    $GIT_SAFE_CLONE "$QUICKSHELL_REPO" "$BUILD_DIR" 2>&1 | tee -a "$LOG_FILE"
    if [ \${PIPESTATUS[0]} -ne 0 ]; then
        log "[WARN] git clone failed; attempting tarball download..."
        rm -rf "$BUILD_DIR"
        mkdir -p "$BUILD_DIR"
        local TARBALL_FILE="$BUILD_DIR/quickshell.tar.gz"
        local -a TARBALL_URLS=(
            "https://git.outfoxxed.me/quickshell/quickshell/archive/master.tar.gz"
            "https://git.outfoxxed.me/api/v1/repos/quickshell/quickshell/archive/master.tar.gz"
            "https://github.com/quickshell-mirror/quickshell/archive/refs/heads/master.tar.gz"
            "https://github.com/quickshell-mirror/quickshell/archive/refs/heads/main.tar.gz"
            "https://api.github.com/repos/quickshell-mirror/quickshell/tarball/HEAD"
        )
        local downloaded=0
        local url=""
        for url in "${'${TARBALL_URLS[@]}'}"; do
            rm -f "$TARBALL_FILE"
            if command -v curl &> /dev/null; then
                log "[ISOLATED_BUILD] Downloading tarball: $url"
                curl -fL --retry 3 --retry-delay 2 --connect-timeout 10 --max-time 600 \
                    "$url" -o "$TARBALL_FILE" 2>&1 | tee -a "$LOG_FILE"
                if [ \${PIPESTATUS[0]} -eq 0 ]; then
                    downloaded=1
                    break
                fi
            elif command -v wget &> /dev/null; then
                log "[ISOLATED_BUILD] Downloading tarball: $url"
                wget -O "$TARBALL_FILE" "$url" 2>&1 | tee -a "$LOG_FILE"
                if [ $? -eq 0 ]; then
                    downloaded=1
                    break
                fi
            else
                log "[ERROR] curl/wget not found. Cannot download Quickshell."
                return 1
            fi
        done
        if [ $downloaded -ne 1 ] || [ ! -f "$TARBALL_FILE" ]; then
            log "[ERROR] Failed to download Quickshell tarball from all sources"
            return 1
        fi
        if ! tar -tzf "$TARBALL_FILE" &>/dev/null; then
            log "[ERROR] Downloaded tarball is not a valid gzip archive"
            if command -v file &> /dev/null; then
                file "$TARBALL_FILE" 2>&1 | tee -a "$LOG_FILE"
            else
                head -c 200 "$TARBALL_FILE" | sed 's/[^[:print:]\t]/./g' | tee -a "$LOG_FILE"
            fi
            return 1
        fi
        tar -xzf "$TARBALL_FILE" -C "$BUILD_DIR" 2>&1 | tee -a "$LOG_FILE"
        SOURCE_DIR=$(find "$BUILD_DIR" -mindepth 1 -maxdepth 1 -type d -name "quickshell-*" 2>/dev/null | head -n 1)
        if [ -z "$SOURCE_DIR" ]; then
            log "[ERROR] Failed to locate extracted Quickshell sources"
            return 1
        fi
    fi

    cd "$SOURCE_DIR"
    if [ -f "meson.build" ]; then
        log "[ISOLATED_BUILD] Detected meson.build; using meson + ninja"
        meson setup build --prefix "$INSTALL_PREFIX" 2>&1 | tee -a "$LOG_FILE"
        if [ $? -ne 0 ]; then
            log "[ERROR] meson setup failed for Quickshell"
            cd /
            return 1
        fi
        ninja -C build 2>&1 | tee -a "$LOG_FILE"
        if [ $? -ne 0 ]; then
            log "[ERROR] ninja build failed for Quickshell"
            cd /
            return 1
        fi
        ninja -C build install 2>&1 | tee -a "$LOG_FILE"
        if [ ${'${PIPESTATUS[0]}'} -ne 0 ]; then
            log "[ERROR] ninja install failed for Quickshell"
            cd /
            return 1
        fi
    elif [ -f "CMakeLists.txt" ]; then
        log "[ISOLATED_BUILD] Detected CMakeLists.txt; using cmake + ninja"
        local build_dir="build"
        local -a cmake_args=(
            -S . -B "$build_dir"
            -DCMAKE_INSTALL_PREFIX="$INSTALL_PREFIX"
            -DCMAKE_BUILD_TYPE=Release
            -DINSTALL_QML_PREFIX=lib/qt6/qml
            -DDISTRIBUTOR="LastLayer (isolated)"
            -DDISTRIBUTOR_DEBUGINFO_AVAILABLE=NO
            -DCRASH_REPORTER=OFF
        )
        log "[ISOLATED_BUILD] Configuring (default flags)..."
        cmake "${'${cmake_args[@]}'}" 2>&1 | tee -a "$LOG_FILE"
        if [ $? -ne 0 ]; then
            log "[ERROR] cmake configure failed for Quickshell"
            cd /
            return 1
        fi
        cmake --build "$build_dir" 2>&1 | tee -a "$LOG_FILE"
        if [ ${'${PIPESTATUS[0]}'} -ne 0 ]; then
            log "[WARN] cmake build failed; retrying with LTO disabled"
            rm -rf "$build_dir"
            cmake "${'${cmake_args[@]}'}" -DCMAKE_INTERPROCEDURAL_OPTIMIZATION=OFF -DCMAKE_C_FLAGS="-O2 -pipe -fno-lto" -DCMAKE_CXX_FLAGS="-O2 -pipe -fno-lto" 2>&1 | tee -a "$LOG_FILE"
            if [ $? -ne 0 ]; then
                log "[ERROR] cmake configure failed (LTO disabled) for Quickshell"
                cd /
                return 1
            fi
            cmake --build "$build_dir" 2>&1 | tee -a "$LOG_FILE"
            if [ ${'${PIPESTATUS[0]}'} -ne 0 ]; then
                log "[ERROR] cmake build failed (LTO disabled) for Quickshell"
                cd /
                return 1
            fi
        fi
        cmake --install "$build_dir" 2>&1 | tee -a "$LOG_FILE"
        if [ ${'${PIPESTATUS[0]}'} -ne 0 ]; then
            log "[ERROR] cmake install failed for Quickshell"
            cd /
            return 1
        fi
    else
        log "[ERROR] No meson.build or CMakeLists.txt found for Quickshell"
        cd /
        return 1
    fi

    if [ ! -x "$INSTALL_PREFIX/bin/quickshell" ]; then
        log "[ERROR] Quickshell binary not found after install"
        cd /
        return 1
    fi

    cd /
    mkdir -p "$INSTALL_PREFIX"
    echo "$(date +%Y-%m-%d)" > "$INSTALL_PREFIX/.install_date"
    log "[ISOLATED_BUILD] Quickshell build complete!"
}
build_isolated_quickshell
`;
    }

    generatePythonPackageSection(widgetName, pythonConfig, venvPath) {
        const patches = pythonConfig.patches || [];
        const venvPipDeps = pythonConfig.venvPipDeps || [];

        const patchSections = patches.map(patch => {
            if (patch.type === 'glib_compat') {
                return this.generateGLibCompatPatchForVenv(widgetName);
            }
            if (patch.type === 'audio_service_graceful') {
                return this.generateAudioServiceGracefulPatch(widgetName);
            }
            if (patch.type === 'future_annotations') {
                return this.generateFutureAnnotationsPatch(widgetName);
            }
            return '';
        }).join('');

        const pipDepsInstall = venvPipDeps.length > 0
            ? `
        log "[ISOLATED_BUILD] Installing additional pip dependencies..."
        pip install ${venvPipDeps.join(' ')} 2>&1 | tee -a "$LOG_FILE"`
            : '';

        return `
    # Create venv and install Python package
    log "[ISOLATED_BUILD] Creating isolated venv for ${widgetName}..."
    mkdir -p "$VENV_PATH"
    python3 -m venv "$VENV_PATH" 2>&1 | tee -a "$LOG_FILE"

    if [ -f "$VENV_PATH/bin/activate" ]; then
        source "$VENV_PATH/bin/activate"

        log "[ISOLATED_BUILD] Installing ${widgetName} Python package in venv..."
        pip install --upgrade pip 2>&1 | tee -a "$LOG_FILE"
        pip install ${pythonConfig.pipInstall} 2>&1 | tee -a "$LOG_FILE"
${pipDepsInstall}
${patchSections}
        deactivate
        log "[SUCCESS] ${widgetName} installed in isolated venv"
    else
        log "[ERROR] Failed to create venv"
    fi`;
    }

    generateGLibCompatPatchForVenv(widgetName) {
        return `
        # Apply GLib 2.86+ compatibility patch to VENV ONLY (not system-wide!)
        log "[ISOLATED_BUILD] Applying GLib compatibility patch to venv..."
        local VENV_PKG="$VENV_PATH/lib/python*/site-packages/${widgetName}"

        for pkg_dir in $VENV_PKG; do
            if [ -d "$pkg_dir" ]; then
                log "[PATCH] Patching venv ${widgetName} at: $pkg_dir"

                # Patch all files that use Gio.DesktopAppInfo (using sed - compatible with bash -c)
                find "$pkg_dir" -name "*.py" -exec grep -l "Gio.DesktopAppInfo" {} \\; 2>/dev/null | while read file; do
                    if grep -q "GioUnix.DesktopAppInfo" "$file" 2>/dev/null; then
                        log "[PATCH] Already patched: $file"
                    else
                        log "[PATCH] Patching: $file"

                        # Add gi.require_version at the start if not present
                        if ! grep -q "gi.require_version.*GioUnix" "$file" 2>/dev/null; then
                            # Add import gi and require_version before first from gi.repository line
                            sed -i '0,/from gi.repository/{s/from gi.repository/import gi\\ngi.require_version("GioUnix", "2.0")\\nfrom gi.repository/}' "$file"
                        fi

                        # Add GioUnix to existing Gio import if not already there
                        # Handle: "from gi.repository import Gio" -> "from gi.repository import Gio, GioUnix"
                        # Handle: "from gi.repository import Gio  # comment" -> "from gi.repository import Gio, GioUnix  # comment"
                        # Handle: "from gi.repository import Gio, GLib" -> "from gi.repository import Gio, GioUnix, GLib"
                        if ! grep -q "import.*GioUnix" "$file" 2>/dev/null; then
                            # Pattern 1: Gio followed by non-comma, non-U char (space, #, etc)
                            sed -i 's/from gi.repository import Gio\\([^,U]\\)/from gi.repository import Gio, GioUnix\\1/g' "$file"
                            # Pattern 2: Gio at end of line
                            sed -i 's/from gi.repository import Gio$/from gi.repository import Gio, GioUnix/' "$file"
                            # Pattern 3: Gio followed by comma and space (Gio, GLib case)
                            sed -i 's/from gi.repository import Gio, /from gi.repository import Gio, GioUnix, /' "$file"
                        fi

                        # Replace Gio.DesktopAppInfo with GioUnix.DesktopAppInfo
                        sed -i "s/Gio\\.DesktopAppInfo/GioUnix.DesktopAppInfo/g" "$file"
                    fi
                done
            fi
        done`;
    }

    generateAudioServiceGracefulPatch(widgetName) {
        return `
        # Apply audio service graceful degradation patch (ignis-gvc may not build)
        log "[ISOLATED_BUILD] Applying audio service graceful patch to venv..."
        local VENV_PKG="$VENV_PATH/lib/python*/site-packages/${widgetName}"

        for pkg_dir in $VENV_PKG; do
            if [ -d "$pkg_dir" ]; then
                local AUDIO_IMPORTS="$pkg_dir/services/audio/_imports.py"
                local AUDIO_SERVICE="$pkg_dir/services/audio/service.py"
                local AUDIO_STREAM="$pkg_dir/services/audio/stream.py"

                # Patch _imports.py - graceful fallback when Gvc unavailable
                if [ -f "$AUDIO_IMPORTS" ]; then
                    if ! grep -q "GVC_AVAILABLE" "$AUDIO_IMPORTS" 2>/dev/null; then
                        log "[PATCH] Patching audio _imports.py for graceful Gvc fallback"
                        cat > "$AUDIO_IMPORTS" << 'AUDIO_IMPORTS_EOF'
import gi
from ignis import is_sphinx_build
import logging

Gvc = None
GVC_AVAILABLE = False

try:
    if not is_sphinx_build:
        gi.require_version("Gvc", "1.0")
    from gi.repository import Gvc  # type: ignore
    GVC_AVAILABLE = True
except (ImportError, ValueError):
    logging.warning("Gvc not found - audio service will be disabled. Install ignis-gvc for audio support.")
    Gvc = None
    GVC_AVAILABLE = False

__all__ = ["Gvc", "GVC_AVAILABLE"]
AUDIO_IMPORTS_EOF
                    fi
                fi

                # Patch service.py - add GVC_AVAILABLE check in __init__
                if [ -f "$AUDIO_SERVICE" ]; then
                    if ! grep -q "if not GVC_AVAILABLE:" "$AUDIO_SERVICE" 2>/dev/null; then
                        log "[PATCH] Patching audio service.py for GVC_AVAILABLE check"
                        # Add early return in __init__ when GVC unavailable
                        sed -i '/def __init__(self):/,/self._control = Gvc.MixerControl/ {
                            /self._control = Gvc.MixerControl/i\\
        if not GVC_AVAILABLE:\\
            self._control = None\\
            self._speaker = None\\
            self._microphone = None\\
            return
                        }' "$AUDIO_SERVICE"
                        # Remove Gvc type hints from method signatures (PyGObject fails on these)
                        sed -i 's/def __get_stream_type(self, stream: Gvc.MixerStream)/def __get_stream_type(self, stream)/g' "$AUDIO_SERVICE"
                        sed -i 's/def __add_stream(self, control: Gvc.MixerControl,/def __add_stream(self, control,/g' "$AUDIO_SERVICE"
                        # Add GVC check in __get_stream_type
                        sed -i '/def __get_stream_type/,/if isinstance/ {
                            /if isinstance/i\\
        if not GVC_AVAILABLE or not Gvc:\\
            return None
                        }' "$AUDIO_SERVICE"
                    fi
                fi

                # Patch stream.py - add GVC_AVAILABLE checks
                if [ -f "$AUDIO_STREAM" ]; then
                    if ! grep -q "GVC_AVAILABLE" "$AUDIO_STREAM" 2>/dev/null; then
                        log "[PATCH] Patching audio stream.py for GVC_AVAILABLE"
                        # Update import - handle with or without trailing content
                        sed -i 's/from \\._imports import Gvc\\([^,]\\|$\\)/from ._imports import Gvc, GVC_AVAILABLE\\1/' "$AUDIO_STREAM"
                        # Add checks in icon_name property (before isinstance checks)
                        sed -i '/def icon_name/,/isinstance.*Gvc.MixerSink/ {
                            /isinstance.*Gvc.MixerSink/i\\
        if not GVC_AVAILABLE or not Gvc:\\
            return "image-missing"
                        }' "$AUDIO_STREAM"
                        # Add checks in is_default property
                        sed -i '/def is_default/,/isinstance.*Gvc.MixerSink/ {
                            /isinstance.*Gvc.MixerSink/i\\
        if not GVC_AVAILABLE or not Gvc:\\
            return False
                        }' "$AUDIO_STREAM"
                    fi
                fi
            fi
        done`;
    }

    generateFutureAnnotationsPatch(widgetName) {
        return `
        # Apply future annotations patch (defer type hint evaluation)
        log "[ISOLATED_BUILD] Applying future annotations patch to venv..."
        local VENV_PKG="$VENV_PATH/lib/python*/site-packages/${widgetName}"

        for pkg_dir in $VENV_PKG; do
            if [ -d "$pkg_dir" ]; then
                # Files that need future annotations (use types not imported at runtime)
                local FILES_TO_PATCH=(
                    "$pkg_dir/services/audio/service.py"
                    "$pkg_dir/services/audio/stream.py"
                    "$pkg_dir/services/applications/action.py"
                    "$pkg_dir/services/applications/application.py"
                    "$pkg_dir/services/applications/service.py"
                )

                for file in "\${FILES_TO_PATCH[@]}"; do
                    if [ -f "$file" ]; then
                        if ! grep -q "from __future__ import annotations" "$file" 2>/dev/null; then
                            log "[PATCH] Adding future annotations to: $file"
                            # Add import at the very beginning of the file
                            sed -i '1i from __future__ import annotations' "$file"
                        fi
                    fi
                done
            fi
        done`;
    }


    isIsolationEnabled() {
        if (this.settingsManager) {
            const settings = this.settingsManager.getAll();
            return settings?.enable_dependency_isolation === true;
        }
        return false;
    }

    getIsolationMode() {
        if (this.settingsManager) {
            const settings = this.settingsManager.getAll();
            return settings?.isolation_grouping_mode || 'hybrid';
        }
        return 'hybrid';
    }

    getVenvPath(riceName) {
        const homeDir = GLib.get_home_dir();
        return `${homeDir}/.local/share/lastlayer/programs/rices/${riceName}/venv`;
    }

    isHyprpanelAdaptiveIsolationEnabled() {
        if (this.settingsManager) {
            const settings = this.settingsManager.getAll();
            return settings?.hyprpanel_adaptive_isolation === true;
        }
        return false;
    }

    getHyprpanelAdaptivePrefix(riceName) {
        const homeDir = GLib.get_home_dir();
        return `${homeDir}/.local/share/lastlayer/programs/rices/${riceName}`;
    }

    isQuickshellAdaptiveIsolationEnabled() {
        if (this.settingsManager) {
            const settings = this.settingsManager.getAll();
            return settings?.quickshell_adaptive_isolation === true;
        }
        return false;
    }

    normalizeHomePath(path) {
        if (!path) return path;
        const homeDir = GLib.get_home_dir();
        return path.startsWith(homeDir) ? `$HOME${path.slice(homeDir.length)}` : path;
    }

    getQuickshellAdaptivePrefix(riceName) {
        const homeDir = GLib.get_home_dir();
        const basePath = `${homeDir}/.local/share/lastlayer/programs`;
        const mode = this.getIsolationMode();

        switch (mode) {
            case 'per-rice':
                return `${basePath}/rices/${riceName}`;
            case 'per-program':
                return `${basePath}/quickshell/isolated`;
            case 'hybrid':
            default:
                return `${basePath}/shared/quickshell/isolated`;
        }
    }

    generateIsolationPrefixCheck(riceName) {
        const isolationEnabled = this.isIsolationEnabled();
        if (!isolationEnabled) return '';

        const mode = this.getIsolationMode();
        const homeDir = GLib.get_home_dir();
        const basePath = `${homeDir}/.local/share/lastlayer/programs`;

        return `
# ────────────────────────────────────────────────────────────────
# Check if program exists in isolation prefix
# ────────────────────────────────────────────────────────────────
ISOLATION_MODE="${mode}"
ISOLATION_BASE="${basePath}"
RICE_NAME="${riceName}"

check_isolated_program() {
    local prog="\$1"
    local check_path=""

    case "\$ISOLATION_MODE" in
        "per-rice")
            check_path="\$ISOLATION_BASE/rices/\$RICE_NAME/bin/\$prog"
            ;;
        "per-program")
            # Check any version directory
            for ver_dir in "\$ISOLATION_BASE/\$prog"/*; do
                if [ -x "\$ver_dir/bin/\$prog" ]; then
                    log "[ISOLATION] Found \$prog in prefix: \$ver_dir"
                    return 0
                fi
            done
            return 1
            ;;
        "hybrid"|*)
            # Check shared location
            for ver_dir in "\$ISOLATION_BASE/shared/\$prog"/*; do
                if [ -x "\$ver_dir/bin/\$prog" ]; then
                    log "[ISOLATION] Found \$prog in shared prefix: \$ver_dir"
                    return 0
                fi
            done
            return 1
            ;;
    esac

    if [ -x "\$check_path" ]; then
        log "[ISOLATION] Found \$prog at: \$check_path"
        return 0
    fi
    return 1
}
`;
    }

    generateStandardPipInstall() {
        const lines = [
            'if [ ${#PIP_PACKAGES[@]} -gt 0 ]; then',
            '    log ""',
            '    log "[PIP] Checking Python packages: ${PIP_PACKAGES[*]}"',
            '    if command -v pip &> /dev/null || command -v pip3 &> /dev/null; then',
            '        PIP_CMD="pip3"',
            '        command -v pip3 &> /dev/null || PIP_CMD="pip"',
            '        ',
            '        # Check which packages are already installed',
            '        MISSING_PIP=()',
            '        for pkg in "${PIP_PACKAGES[@]}"; do',
            '            if [ -z "$pkg" ]; then continue; fi',
            '            if $PIP_CMD show "$pkg" &>/dev/null; then',
            '                log "[PIP_INSTALLED] $pkg (already installed)"',
            '            else',
            '                MISSING_PIP+=("$pkg")',
            '                log "[PIP_MISSING] $pkg"',
            '            fi',
            '        done',
            '        ',
            '        if [ ${#MISSING_PIP[@]} -eq 0 ]; then',
            '            log "[SUCCESS] All pip packages already installed"',
            '        else',
            '            log "[PIP] Installing missing packages: ${MISSING_PIP[*]}"',
            '            for pkg in "${MISSING_PIP[@]}"; do',
            '                log "[PIP] Installing $pkg..."',
            '                $PIP_CMD install --user "$pkg" 2>&1 | tee -a "$LOG_FILE"',
            '            done',
            '        fi',
            '    else',
            '        log "[WARNING] pip not found. Install python-pip first."',
            '    fi',
            'fi'
        ];
        return lines.join('\n');
    }

    generateIsolatedPipInstall(riceName, pipPackages) {
        if (!pipPackages || pipPackages.length === 0) return '';

        const venvPath = this.getVenvPath(riceName);
        const pipPackageList = pipPackages.map(p => `"${p}"`).join(' ');

        return `
# ────────────────────────────────────────────────────────────────
# Install Python packages in isolated venv (per-rice isolation)
# ────────────────────────────────────────────────────────────────
VENV_PATH="${venvPath}"
PIP_PACKAGES=(${pipPackageList})

if [ \${#PIP_PACKAGES[@]} -gt 0 ]; then
    log ""
    log "[VENV] Setting up isolated Python environment for rice: ${riceName}"

    # Create venv if it doesn't exist
    if [ ! -d "\$VENV_PATH" ]; then
        log "[VENV] Creating virtual environment at \$VENV_PATH"
        python3 -m venv "\$VENV_PATH" 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
        if [ \$? -ne 0 ]; then
            log "[ERROR] Failed to create venv. Make sure python3-venv is installed."
            log "[CMD] sudo pacman -S python"
        fi
    fi

    # Activate venv and install packages
    if [ -f "\$VENV_PATH/bin/activate" ]; then
        log "[VENV] Activating virtual environment"
        source "\$VENV_PATH/bin/activate"

        log "[PIP] Checking packages in venv: \${PIP_PACKAGES[*]}"
        MISSING_PIP=()
        for pkg in "\${PIP_PACKAGES[@]}"; do
            if [ -z "\$pkg" ]; then continue; fi
            # Check if package is already installed in venv
            if pip show "\$pkg" &>/dev/null; then
                log "[PIP_INSTALLED] \$pkg (already in venv)"
            else
                MISSING_PIP+=("\$pkg")
                log "[PIP_MISSING] \$pkg"
            fi
        done

        if [ \${#MISSING_PIP[@]} -eq 0 ]; then
            log "[SUCCESS] All pip packages already installed in venv"
        else
            log "[PIP] Installing missing packages: \${MISSING_PIP[*]}"
            for pkg in "\${MISSING_PIP[@]}"; do
                log "[PIP] Installing \$pkg..."
                pip install "\$pkg" 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
            done
        fi

        deactivate
        log "[VENV] Packages installed in isolated environment"
    else
        log "[ERROR] Failed to activate venv at \$VENV_PATH"
    fi
fi
`;
    }


    packageManagers = {
        pacman: { cmd: 'pacman', queryCmd: 'pacman -Si', canQuery: true, isAUR: false },
        paru: { cmd: 'paru', queryCmd: 'paru -Si', canQuery: true, isAUR: true },
        yay: { cmd: 'yay', queryCmd: 'yay -Si', canQuery: true, isAUR: true },

        pip: { cmd: 'pip', canQuery: false, type: 'python' },
        pip3: { cmd: 'pip3', canQuery: false, type: 'python' },
        cargo: { cmd: 'cargo', canQuery: false, type: 'rust' },
        npm: { cmd: 'npm', canQuery: false, type: 'node' },
        go: { cmd: 'go', canQuery: false, type: 'go' },

        apt: { cmd: 'apt', queryCmd: 'apt-cache depends', canQuery: true, isAUR: false },
        'apt-get': { cmd: 'apt-get', queryCmd: 'apt-cache depends', canQuery: true, isAUR: false }
    };

    detectInstallMethods(sourcePath) {
        const methods = new Set();
        const packagesByMethod = new Map();

        const scriptPaths = ['install.sh', 'setup.sh', 'scripts/install.sh', 'INSTALL.md', 'README.md'];

        for (const scriptName of scriptPaths) {
            const scriptPath = `${sourcePath}/${scriptName}`;
            if (!GLib.file_test(scriptPath, GLib.FileTest.EXISTS)) continue;
            const text = this.readTextFile(scriptPath, `InstallScriptGenerator.detectInstallMethods:${scriptPath}`);
            if (!text) continue;

                const patterns = {
                    pacman: /pacman\s+-S[yu]*\s+(?:--noconfirm\s+)?(?:--needed\s+)?([^\n|&;]+)/gi,
                    paru: /paru\s+-S[yu]*\s+(?:--noconfirm\s+)?(?:--needed\s+)?([^\n|&;]+)/gi,
                    yay: /yay\s+-S[yu]*\s+(?:--noconfirm\s+)?(?:--needed\s+)?([^\n|&;]+)/gi,
                    pip: /pip3?\s+install\s+([^\n|&;]+)/gi,
                    cargo: /cargo\s+install\s+([^\n|&;]+)/gi,
                    npm: /npm\s+(?:install|i)\s+(?:-g\s+)?([^\n|&;]+)/gi,
                    go: /go\s+install\s+([^\n|&;]+)/gi,
                    apt: /apt(?:-get)?\s+install\s+(?:-y\s+)?([^\n|&;]+)/gi
                };

                for (const [method, pattern] of Object.entries(patterns)) {
                    let match;
                    while ((match = pattern.exec(text)) !== null) {
                        methods.add(method);
                        if (!packagesByMethod.has(method)) {
                            packagesByMethod.set(method, []);
                        }
                        const pkgs = match[1].trim().split(/\s+/).filter(p =>
                            p && !p.startsWith('-') && !p.startsWith('$')
                        );
                        packagesByMethod.get(method).push(...pkgs);
                    }
                }
        }

        return {
            methods: Array.from(methods),
            packages: packagesByMethod
        };
    }

    isPackageManagerAvailable(pmName) {
        return tryOrFalse(
            `InstallScriptGenerator.isPackageManagerAvailable:${pmName}`,
            () => Boolean(this.runCommand(`which ${pmName}`, `InstallScriptGenerator.which:${pmName}`)?.[0])
        );
    }

    getAvailableAURHelper() {
        if (this.isPackageManagerAvailable('paru')) return 'paru';
        if (this.isPackageManagerAvailable('yay')) return 'yay';
        return null;
    }

    queryPackageDependencies(packageName, preferredPM = null) {
        const deps = new Set();

        let pmToUse = preferredPM;
        if (!pmToUse || !this.isPackageManagerAvailable(pmToUse)) {
            if (this.isPackageManagerAvailable('pacman')) {
                pmToUse = 'pacman';
            }
            const aurHelper = this.getAvailableAURHelper();
            if (aurHelper) {
                pmToUse = aurHelper;
            }
        }

        if (!pmToUse) {
            this.log('No package manager available for dependency query');
            return deps;
        }

        return this.getDynamicDependencies(packageName);
    }

    getNonQueryableDeps(pmType, packageName) {
        if (pmType === 'pip') {
            const dynamicDeps = this.queryPipDependencies(packageName);
            if (dynamicDeps.length > 0) {
                return dynamicDeps;
            }
        }

        const pmDb = this.nonQueryableDeps[pmType];
        if (!pmDb) return [];

        const deps = pmDb[packageName] || [];
        const allDeps = [...deps];
        for (const dep of deps) {
            const subDeps = this.getNonQueryableDeps(pmType, dep);
            allDeps.push(...subDeps);
        }
        return [...new Set(allDeps)];
    }

    queryPipDependencies(packageName) {
        const deps = [];
        const pipOutput = this.runCommand(
            `pip show ${packageName} 2>/dev/null`,
            `InstallScriptGenerator.queryPipDependencies.pipShow:${packageName}`
        )?.[1];
        let output = pipOutput ? new TextDecoder().decode(pipOutput) : '';

        if (output.includes('Requires:')) {
            const match = output.match(/Requires:\s*([^\n]*)/i);
            if (match && match[1].trim()) {
                const reqList = match[1].split(',').map(r => r.trim().toLowerCase()).filter(r => r);
                deps.push(...reqList);
                this.log(`pip show ${packageName}: ${reqList.join(', ') || 'none'}`);
                return deps;
            }
        }

        const pypiOutput = this.runCommand(
            `curl -s --max-time 5 "https://pypi.org/pypi/${packageName}/json" 2>/dev/null`,
            `InstallScriptGenerator.queryPipDependencies.pypi:${packageName}`
        )?.[1];
        output = pypiOutput ? new TextDecoder().decode(pypiOutput) : '';

        if (output && output.includes('"requires_dist"')) {
            const json = tryOrNull(
                `InstallScriptGenerator.queryPipDependencies.parseJson:${packageName}`,
                () => JSON.parse(output)
            );
            const requiresDist = json?.info?.requires_dist || [];
            for (const req of requiresDist) {
                const pkgMatch = req.match(/^([a-zA-Z0-9_-]+)/);
                if (pkgMatch && !req.includes('extra ==') && !req.includes('extra==')) {
                    deps.push(pkgMatch[1].toLowerCase().replace(/_/g, '-'));
                }
            }
            deps.length > 0 && this.log(`PyPI ${packageName}: ${deps.join(', ')}`);
        }

        return [...new Set(deps)];
    }

    topologicalSortPackages(pmType, packages) {
        const pmDb = this.nonQueryableDeps[pmType] || {};
        const visited = new Set();
        const result = [];

        const visit = (pkg) => {
            if (visited.has(pkg)) return;
            visited.add(pkg);

            const deps = pmDb[pkg] || [];
            for (const dep of deps) {
                if (packages.includes(dep) || pmDb[dep]) {
                    visit(dep);
                }
            }

            result.push(pkg);
        };

        for (const pkg of packages) {
            visit(pkg);
        }

        return result;
    }

    getOrderedPackagesWithDeps(pmType, packages) {
        const allPackages = new Set(packages);

        for (const pkg of packages) {
            const deps = this.getNonQueryableDeps(pmType, pkg);
            deps.forEach(d => allPackages.add(d));
        }

        return this.topologicalSortPackages(pmType, Array.from(allPackages));
    }

    resolveAllDependencies(sourcePath) {
        const result = {
            archPackages: new Set(),
            aurPackages: new Set(),
            pipPackages: new Set(),
            cargoPackages: new Set(),
            npmPackages: new Set(),
            goPackages: new Set()
        };

        const { methods, packages } = this.detectInstallMethods(sourcePath);
        this.log(`Detected installation methods: ${methods.join(', ')}`);

        for (const [method, pkgList] of packages.entries()) {
            const pmInfo = this.packageManagers[method];
            if (!pmInfo) continue;

            for (const pkg of pkgList) {
                if (!pkg || pkg.length < 2) continue;

                if (pmInfo.canQuery) {
                    if (pmInfo.isAUR) {
                        result.aurPackages.add(pkg);
                    } else {
                        result.archPackages.add(pkg);
                    }

                    const deps = this.queryPackageDependencies(pkg, method);
                    deps.forEach(d => {
                        if (!this.blockedPackages.has(d)) {
                            result.archPackages.add(d);
                        }
                    });

                } else {
                    const type = pmInfo.type;

                    switch (type) {
                        case 'python':
                            result.pipPackages.add(pkg);
                            this.getNonQueryableDeps('pip', pkg).forEach(d => result.pipPackages.add(d));
                            break;
                        case 'rust':
                            result.cargoPackages.add(pkg);
                            break;
                        case 'node':
                            result.npmPackages.add(pkg);
                            this.getNonQueryableDeps('npm', pkg).forEach(d => result.npmPackages.add(d));
                            break;
                        case 'go':
                            result.goPackages.add(pkg);
                            break;
                    }
                }
            }
        }

        return result;
    }

    getDynamicDependencies(packageName) {
        const deps = new Set();
        const pacmanOutput = this.runCommand(
            `pacman -Si ${packageName}`,
            `InstallScriptGenerator.getDynamicDependencies.pacman:${packageName}`
        )?.[1];
        let output = pacmanOutput ? new TextDecoder().decode(pacmanOutput) : '';

        if (!output.includes('Depends On') || output.includes('error:')) {
            const paruOutput = this.runCommand(
                `paru -Si ${packageName} 2>/dev/null`,
                `InstallScriptGenerator.getDynamicDependencies.paru:${packageName}`
            )?.[1];
            output = paruOutput ? new TextDecoder().decode(paruOutput) : '';
        }

        const dependsMatch = output.match(/Depends On\s*:\s*([^\n]+)/i);
        if (dependsMatch) {
            const depList = dependsMatch[1].trim();
            if (depList !== 'None') {
                const depPkgs = depList.split(/\s+/).map(d => d.replace(/[<>=].*$/, '').trim());
                depPkgs.forEach(d => {
                    if (d && d !== 'None' && !d.startsWith('-')) {
                        deps.add(d);
                    }
                });
            }
        }

        if (packageName.startsWith('python-')) {
            const optMatch = output.match(/Optional Deps\s*:\s*([\s\S]*?)(?=\n[A-Z]|\n\n|$)/i);
            if (optMatch) {
                const optLines = optMatch[1].split('\n');
                for (const line of optLines) {
                    const pkgMatch = line.match(/^\s*([a-z0-9-]+)/i);
                    if (pkgMatch?.[1]?.startsWith('python-')) {
                        deps.add(pkgMatch[1]);
                    }
                }
            }
        }

        deps.size > 0 && this.log(`Dynamic deps for ${packageName}: ${Array.from(deps).join(', ')}`);

        return deps;
    }

    getAppDependencies(appName) {
        const app = appName.toLowerCase();
        const result = { regular: new Set(), aur: new Set() };

        const appToPackage = {
            ignis: 'python-ignis',
            ags: 'aylurs-gtk-shell',
            eww: 'eww',
            fabric: 'fabric-git',
            quickshell: 'quickshell-git',
            waybar: 'waybar',
            hyprpanel: 'hyprpanel-git'
        };

        const mainPkg = appToPackage[app];
        if (mainPkg) {
            const dynamicDeps = this.getDynamicDependencies(mainPkg);

            if (dynamicDeps.size > 0) {
                dynamicDeps.forEach(d => result.regular.add(d));
                if (mainPkg.endsWith('-git')) {
                    result.aur.add(mainPkg);
                } else {
                    result.regular.add(mainPkg);
                }
            } else {
                const staticDeps = this.knownAppDependencies[app];
                if (staticDeps) {
                    (staticDeps.regular || []).forEach(p => result.regular.add(p));
                    (staticDeps.aur || []).forEach(p => result.aur.add(p));
                }
            }
        }

        return {
            regular: Array.from(result.regular),
            aur: Array.from(result.aur)
        };
    }

    generate(themePath, themeName, options = {}) {
        return tryOrDefault('InstallScriptGenerator.generate', () => {
            const { detectedApps = [], hyprlandExecs = [], sourcePath = '' } = options;

            const packages = this.collectAllDependencies(sourcePath, detectedApps, hyprlandExecs);
            this.log(`Collected ${packages.length} arch/AUR dependencies`);

            const multiPmDeps = sourcePath ? this.resolveAllDependencies(sourcePath) : null;
            if (multiPmDeps) {
                this.log(`Multi-PM deps: pip=${multiPmDeps.pipPackages.size}, cargo=${multiPmDeps.cargoPackages.size}, npm=${multiPmDeps.npmPackages.size}`);
            }

            this.generateInstallScript(themePath, themeName, packages, multiPmDeps, detectedApps);
            this.generateSetAfterInstallScript(themePath, themeName, detectedApps);

            return { success: true };
        }, { success: false, error: 'Failed to generate install scripts' });
    }

    collectAllDependencies(sourcePath, detectedApps, hyprlandExecs) {
        const packages = new Set();

        for (const app of detectedApps) {
            const pkg = this.dependencyMap[app.toLowerCase()];
            if (pkg) packages.add(pkg);
        }

        for (const execCmd of hyprlandExecs) {
            if (!execCmd) continue;
            const cmdLower = execCmd.toLowerCase();

            for (const [pattern, pkg] of Object.entries(this.execDependencyMap)) {
                if (cmdLower.includes(pattern)) {
                    packages.add(pkg);
                }
            }
        }

        if (sourcePath) {
            const readmePackages = this.parseReadme(sourcePath);
            readmePackages.forEach(p => packages.add(p));
        }

        if (sourcePath) {
            const installPackages = this.parseInstallScript(sourcePath);
            installPackages.forEach(p => packages.add(p));
        }

        const knownDepPackages = new Set();
        for (const app of detectedApps) {
            const appDeps = this.getAppDependencies(app);

            for (const pkg of appDeps.regular) {
                packages.add(pkg);
                knownDepPackages.add(pkg);
            }
            for (const pkg of appDeps.aur) {
                packages.add(`aur:${pkg}`);
            }

            if (appDeps.regular.length > 0 || appDeps.aur.length > 0) {
                this.log(`Deps for ${app}: ${appDeps.regular.length} regular, ${appDeps.aur.length} AUR`);
            }
        }

        const blocked = [];
        for (const pkg of packages) {
            if (pkg.startsWith('aur:')) continue;

            if (knownDepPackages.has(pkg)) continue;

            if (this.blockedPackages.has(pkg)) {
                blocked.push(pkg);
                packages.delete(pkg);
            }
        }

        const excludePackages = [
            'git', 'sudo', 'curl', 'wget', 'make', 'cmake',
            'fonts', 'utility', 'tools', 'dependencies', 'required',
            'optional', 'theme', 'config', 'setup', 'install',
            'either', 'what', 'or'
        ];
        excludePackages.forEach(p => packages.delete(p));

        if (blocked.length > 0) {
            this.log(`Blocked dangerous packages: ${blocked.join(', ')}`);
        }

        return Array.from(packages).sort();
    }

    parseReadme(sourcePath) {
        const packages = new Set();
        const readmePaths = ['README.md', 'readme.md', 'README', 'INSTALL.md'];

        for (const readmeName of readmePaths) {
            const readmePath = `${sourcePath}/${readmeName}`;
            if (!GLib.file_test(readmePath, GLib.FileTest.EXISTS)) continue;
            const text = this.readTextFile(readmePath, `InstallScriptGenerator.parseReadme:${readmePath}`);
            if (!text) continue;

                for (const pattern of this.packagePatterns) {
                    pattern.lastIndex = 0;
                    let match;
                    while ((match = pattern.exec(text)) !== null) {
                        const pkg = match[1].toLowerCase().trim();
                        if (pkg.length > 2 && pkg.length < 50 && /^[a-z0-9-]+$/.test(pkg)) {
                            packages.add(pkg);
                        }
                    }
                }

                const depSection = text.match(/## (?:Dependencies|Requirements|Prerequisites)[\s\S]*?(?=##|$)/i);
                if (depSection) {
                    const lines = depSection[0].split('\n');
                    for (const line of lines) {
                        const pkgMatch = line.match(/[-*]\s*`?([a-z0-9-]+)`?/i);
                        if (pkgMatch) {
                            const pkg = pkgMatch[1].toLowerCase();
                            if (this.isValidPackageName(pkg)) {
                                packages.add(pkg);
                            }
                        }
                    }
                }
        }

        return packages;
    }

    parseInstallScript(sourcePath) {
        const packages = new Set();
        const aurPackages = new Set();
        const scriptPaths = ['install.sh', 'setup.sh', 'scripts/install.sh'];

        for (const scriptName of scriptPaths) {
            const scriptPath = `${sourcePath}/${scriptName}`;
            if (!GLib.file_test(scriptPath, GLib.FileTest.EXISTS)) continue;
            const text = this.readTextFile(scriptPath, `InstallScriptGenerator.parseInstallScript:${scriptPath}`);
            if (!text) continue;

                const arrayPattern = /(\w+_DEPS|\w+PACKAGES)\s*=\s*\(([\s\S]*?)\)/gi;
                let arrayMatch;
                while ((arrayMatch = arrayPattern.exec(text)) !== null) {
                    const arrayContent = arrayMatch[2];
                    const quotedPattern = /"([^"]+)"|'([^']+)'/g;
                    let quotedMatch;
                    while ((quotedMatch = quotedPattern.exec(arrayContent)) !== null) {
                        let pkg = quotedMatch[1] || quotedMatch[2];

                        if (pkg.startsWith('.AUR:')) {
                            aurPackages.add(pkg.substring(5));
                            continue;
                        }

                        if (pkg.startsWith('.')) continue;

                        if (this.isValidPackageName(pkg.toLowerCase())) {
                            packages.add(pkg.toLowerCase());
                        }
                    }

                    const unquotedPkgs = arrayContent
                        .replace(/"[^"]*"/g, '')
                        .replace(/'[^']*'/g, '')
                        .replace(/#[^\n]*/g, '')
                        .match(/[a-z][a-z0-9-]*/gi) || [];

                    for (const pkg of unquotedPkgs) {
                        if (this.isValidPackageName(pkg.toLowerCase())) {
                            packages.add(pkg.toLowerCase());
                        }
                    }
                }

                const pmPatterns = [
                    /(?:yay|paru|pacman)\s+-S[yu]*\s+(?:--noconfirm\s+)?(?:--needed\s+)?([^\n|&;]+)/gi,
                    /PACKAGES=\([^)]+\)/gi
                ];

                for (const pattern of pmPatterns) {
                    pattern.lastIndex = 0;
                    let match;
                    while ((match = pattern.exec(text)) !== null) {
                        const pkgList = match[1] || match[0];
                        const pkgs = pkgList.match(/[a-z0-9][a-z0-9-]*/gi) || [];
                        for (const pkg of pkgs) {
                            if (this.isValidPackageName(pkg.toLowerCase())) {
                                packages.add(pkg.toLowerCase());
                            }
                        }
                    }
                }
        }

        aurPackages.forEach(pkg => packages.add(`aur:${pkg}`));

        return packages;
    }

    isValidPackageName(name) {
        const invalidNames = ['the', 'and', 'for', 'with', 'your', 'this', 'that', 'from',
            'install', 'sudo', 'echo', 'then', 'else', 'true', 'false', 'null',
            'home', 'config', 'scripts', 'bin', 'usr', 'etc', 'var', 'tmp',
            'either', 'what', 'or'];
        return name.length > 2 &&
               name.length < 40 &&
               /^[a-z][a-z0-9-]*$/.test(name) &&
               !invalidNames.includes(name);
    }

    generateInstallScript(themePath, themeName, packages, multiPmDeps = null, detectedApps = []) {
        const isolationEnabled = this.isIsolationEnabled();
        const isolationMode = this.getIsolationMode();
        const hyprpanelIsolationEnabled = this.isHyprpanelAdaptiveIsolationEnabled();
        const hyprpanelDetected = detectedApps?.some(app => app.toLowerCase() === 'hyprpanel');
        const useHyprpanelIsolation = hyprpanelIsolationEnabled && hyprpanelDetected;
        const quickshellIsolationEnabled = this.isQuickshellAdaptiveIsolationEnabled();
        const quickshellDetected = detectedApps?.some(app => app.toLowerCase() === 'quickshell');
        const useQuickshellIsolation = quickshellIsolationEnabled && quickshellDetected;

        if (isolationEnabled) {
            this.log(`Isolation enabled, mode: ${isolationMode}`);
        }

        const regularPackages = [];
        let aurPackages = [];

        for (const pkg of packages) {
            if (pkg.startsWith('aur:')) {
                aurPackages.push(pkg.substring(4));
            } else {
                regularPackages.push(pkg);
            }
        }

        if (useHyprpanelIsolation) {
            const buildDeps = ['git', 'meson', 'ninja', 'nodejs', 'npm'];
            for (const dep of buildDeps) {
                if (!regularPackages.includes(dep)) {
                    regularPackages.push(dep);
                }
            }
            const beforeCount = aurPackages.length;
            aurPackages = aurPackages.filter(pkg => !['hyprpanel-git', 'ags'].includes(pkg));
            if (aurPackages.length !== beforeCount) {
                this.log('HyprPanel isolation: skipping system hyprpanel-git/ags install');
            }
        }

        if (useQuickshellIsolation) {
            const buildDeps = [
                'git', 'cmake', 'ninja', 'meson', 'curl',
                'spirv-tools', 'qt6-shadertools', 'wayland-protocols', 'cli11'
            ];
            for (const dep of buildDeps) {
                if (!regularPackages.includes(dep)) {
                    regularPackages.push(dep);
                }
            }
            const beforeCount = aurPackages.length;
            aurPackages = aurPackages.filter(pkg => !['quickshell-git'].includes(pkg));
            if (aurPackages.length !== beforeCount) {
                this.log('Quickshell isolation: skipping system quickshell-git install');
            }
        }

        const isolatedBuildPackages = new Set();
        for (const app of detectedApps) {
            const appLower = app.toLowerCase();
            const config = this.widgetSpecificConfig[appLower];
            const forceIsolation = appLower === 'quickshell' && useQuickshellIsolation;
            if (config?.isolatedBuild?.enabled && (isolationEnabled || forceIsolation)) {
                const packagesToReplace = config.isolatedBuild.aurPackagesToReplace || [];
                for (const pkg of packagesToReplace) {
                    isolatedBuildPackages.add(pkg);
                }
                this.log(`Isolated build enabled for: ${app}, replaces AUR: [${packagesToReplace.join(', ')}]`);
            }
        }

        let filteredRegularPackages = regularPackages;
        if (isolatedBuildPackages.size > 0) {
            const originalAurCount = aurPackages.length;
            const originalRegularCount = regularPackages.length;

            aurPackages = aurPackages.filter(pkg => !isolatedBuildPackages.has(pkg));
            filteredRegularPackages = regularPackages.filter(pkg => !isolatedBuildPackages.has(pkg));

            this.log(`Excluded from packages (isolated build): ${Array.from(isolatedBuildPackages).join(', ')}`);
            this.log(`AUR packages: ${originalAurCount} -> ${aurPackages.length}`);
            this.log(`Regular packages: ${originalRegularCount} -> ${filteredRegularPackages.length}`);
        }

        const regularPackageList = filteredRegularPackages.length > 0
            ? filteredRegularPackages.map(p => `    "${p}"`).join('\n')
            : '';
        const aurPackageList = aurPackages.length > 0
            ? aurPackages.map(p => `    "${p}"`).join('\n')
            : '';

        const pipPackages = multiPmDeps?.pipPackages
            ? this.getOrderedPackagesWithDeps('pip', multiPmDeps.pipPackages)
            : [];
        const cargoPackages = multiPmDeps?.cargoPackages
            ? Array.from(multiPmDeps.cargoPackages)
            : [];
        const npmPackages = multiPmDeps?.npmPackages
            ? this.getOrderedPackagesWithDeps('npm', multiPmDeps.npmPackages)
            : [];

        const pipPackageList = pipPackages.length > 0
            ? pipPackages.map(p => `    "${p}"`).join('\n')
            : '';
        const cargoPackageList = cargoPackages.length > 0
            ? cargoPackages.map(p => `    "${p}"`).join('\n')
            : '';
        const npmPackageList = npmPackages.length > 0
            ? npmPackages.map(p => `    "${p}"`).join('\n')
            : '';

        const pipInstallSection = isolationEnabled && pipPackages.length > 0
            ? this.generateIsolatedPipInstall(themeName, pipPackages)
            : this.generateStandardPipInstall();

        const isolationPrefixCheck = this.generateIsolationPrefixCheck(themeName);

        let isolatedWidgetBuilds = '';
        for (const app of detectedApps) {
            const appLower = app.toLowerCase();
            const config = this.widgetSpecificConfig[appLower];
            if (config?.isolatedBuild?.enabled && isolationEnabled && appLower !== 'quickshell') {
                isolatedWidgetBuilds += this.generateIsolatedWidgetBuild(app, themeName);
            }
        }

        const hyprpanelAdaptiveBuild = useHyprpanelIsolation
            ? this.generateHyprpanelIsolatedBuild(themeName)
            : '';
        const quickshellAdaptiveBuild = useQuickshellIsolation
            ? this.generateQuickshellIsolatedBuild(themeName)
            : '';

        const aurFlagsMap = {};
        for (const pkg of aurPackages) {
            const flags = this.getAURInstallFlags(pkg, detectedApps);
            if (flags.length > 0) {
                aurFlagsMap[pkg] = flags;
                this.log(`AUR flags for ${pkg}: ${flags.join(' ')}`);
            }
        }
        const aurFlagsCases = Object.entries(aurFlagsMap)
            .map(([pkg, flags]) => `        ${pkg}) echo "${flags.join(' ')}" ;;`)
            .join('\n');
        const aurFlagsDeclaration = Object.keys(aurFlagsMap).length > 0
            ? `\n# Widget-specific AUR flags function (case statement for xterm compatibility)
get_aur_flags() {
    local pkg="\\$1"
    case "\\$pkg" in
${aurFlagsCases}
    esac
}\n`
            : `\n# No special AUR flags needed
get_aur_flags() { echo ""; }\n`;

        const postInstallPatches = this.generatePostInstallPatches(detectedApps);

        const script = `#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  Theme: ${themeName.padEnd(52)}║
# ║  Install Dependencies                                        ║
# ║  Generated by llayer-plus                                    ║
# ╚══════════════════════════════════════════════════════════════╝

# Setup logging
LOG_DIR="$HOME/.cache/lastlayer/logs"
mkdir -p "\$LOG_DIR"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
LOG_FILE="\$LOG_DIR/install_${themeName}_\$TIMESTAMP.log"

# Write install script to temp file using heredoc (avoids single-quote escaping issues)
INSTALL_SCRIPT=\$(mktemp --suffix=_install_${themeName}.sh)
cat > "\$INSTALL_SCRIPT" << 'INSTALL_EOF'
#!/usr/bin/env bash
set +e

# Hide username in sudo prompts (for privacy/screencasts)
export SUDO_PROMPT="[sudo] password: "

# Log file path
LOG_DIR="\$HOME/.cache/lastlayer/logs"
mkdir -p "\$LOG_DIR"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
LOG_FILE="\$LOG_DIR/install_${themeName}_\$TIMESTAMP.log"

# Function to log with timestamp
log() {
    local msg="\$1"
    echo "\$msg"
    echo "[\$(date +%H:%M:%S)] \$msg" >> "\$LOG_FILE"
}

log_cmd() {
    local cmd="\$1"
    log "[CMD] \$cmd"
    eval "\$cmd" 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
    local exit_code=\${PIPESTATUS[0]}
    log "[EXIT_CODE] \$exit_code"
    return \$exit_code
}

# Sanitize output to hide username for privacy
sanitize_output() {
    sed -e "s|/home/\$USER/|~/|g" \\
        -e "s|/home/\$(whoami)/|~/|g" \\
        -e "s|password for \$USER:|password for <user>:|g" \\
        -e "s|password for \$(whoami):|password for <user>:|g" \\
        -e "s|\$USER@|<user>@|g" \\
        -e "s|\$(whoami)@|<user>@|g"
}

echo "═══════════════════════════════════════════════════════════════" | tee -a "\$LOG_FILE"
log "  Installing dependencies for: ${themeName}"
log "  Log file: ~/.cache/lastlayer/logs/..."
echo "═══════════════════════════════════════════════════════════════" | tee -a "\$LOG_FILE"

# System info (username hidden for privacy)
log "[SYSTEM_INFO] Date: \$(date)"
log "[SYSTEM_INFO] PWD: \$(pwd | sed "s|\$HOME|~|g")"

# Detect package manager
detect_pm() {
    if command -v yay &> /dev/null; then
        echo "yay"
    elif command -v paru &> /dev/null; then
        echo "paru"
    elif command -v pacman &> /dev/null; then
        echo "pacman"
    else
        echo "unknown"
    fi
}

PM=\$(detect_pm)
log "[PACKAGE_MANAGER] \$PM"
${aurFlagsDeclaration}${isolationPrefixCheck}
# Package lists (regular and AUR)
PACKAGES=(
${regularPackageList}
)

AUR_PACKAGES=(
${aurPackageList}
)

log "[PACKAGES_REQUESTED] Regular: \${PACKAGES[*]}"
log "[AUR_PACKAGES_REQUESTED] AUR: \${AUR_PACKAGES[*]}"

# Install regular packages first
if [ \${#PACKAGES[@]} -gt 0 ]; then
    log "Installing regular packages: \${PACKAGES[*]}"

    # Check which packages are already installed
    log "[CHECK] Checking already installed packages..."
    MISSING_PACKAGES=()
    for pkg in "\${PACKAGES[@]}"; do
        if ! pacman -Qi "\$pkg" &>/dev/null; then
            MISSING_PACKAGES+=("\$pkg")
            log "[MISSING] \$pkg"
        else
            log "[INSTALLED] \$pkg (already installed)"
        fi
    done

    if [ \${#MISSING_PACKAGES[@]} -eq 0 ]; then
        log "[SUCCESS] All regular packages already installed"
    else
        # Filter out packages that conflict with already-installed alternatives
        # E.g., skip pipewire-jack if jack2 is installed (they conflict)
        FILTERED_PACKAGES=()

        # Function to get conflicting package (avoids associative array issues in bash -c)
        get_conflict() {
            case "\$1" in
                pipewire-jack) echo "jack2" ;;
                jack2) echo "pipewire-jack" ;;
                *) echo "" ;;
            esac
        }

        for pkg in "\${MISSING_PACKAGES[@]}"; do
            conflict=\$(get_conflict "\$pkg")
            if [ -n "\$conflict" ] && pacman -Qi "\$conflict" &>/dev/null; then
                log "[SKIPPED] \$pkg - conflicts with installed \$conflict"
            else
                FILTERED_PACKAGES+=("\$pkg")
            fi
        done

        if [ \${#FILTERED_PACKAGES[@]} -eq 0 ]; then
            log "[SUCCESS] All packages installed or skipped due to conflicts"
        else
            log "[INSTALLING] \${FILTERED_PACKAGES[*]}"

            case \$PM in
                yay)
                    log "[CMD] yay -S --noconfirm --needed \${FILTERED_PACKAGES[*]}"
                    yay -S --noconfirm --needed "\${FILTERED_PACKAGES[@]}" < /dev/null 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
                    log "[EXIT_CODE] \${PIPESTATUS[0]}"
                    ;;
                paru)
                    log "[CMD] paru -S --noconfirm --needed \${FILTERED_PACKAGES[*]}"
                    paru -S --noconfirm --needed "\${FILTERED_PACKAGES[@]}" < /dev/null 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
                    log "[EXIT_CODE] \${PIPESTATUS[0]}"
                    ;;
                pacman)
                    log "[CMD] sudo pacman -S --noconfirm --needed \${FILTERED_PACKAGES[*]}"
                    sudo pacman -S --noconfirm --needed "\${FILTERED_PACKAGES[@]}" < /dev/null 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
                    log "[EXIT_CODE] \${PIPESTATUS[0]}"
                    ;;
                *)
                    log "[ERROR] Unknown package manager. Please install manually:"
                    printf "%s\\n" "\${FILTERED_PACKAGES[@]}" | tee -a "\$LOG_FILE"
                    ;;
            esac
        fi
    fi
else
    log "No regular packages required."
fi

# Install AUR packages (requires yay or paru)
if [ \${#AUR_PACKAGES[@]} -gt 0 ]; then
    log ""
    log "[AUR] Installing AUR packages: \${AUR_PACKAGES[*]}"

    # Check if we have an AUR helper
    if [[ "\$PM" != "yay" && "\$PM" != "paru" ]]; then
        log "[WARNING] No AUR helper found. Installing paru first..."
        if command -v pacman &> /dev/null; then
            log "[CMD] Installing paru dependencies..."
            sudo pacman -S --needed --noconfirm base-devel git < /dev/null 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
            if [ ! -d "/tmp/paru-bin" ]; then
                git clone https://aur.archlinux.org/paru-bin.git /tmp/paru-bin 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
            fi
            cd /tmp/paru-bin
            makepkg -si --noconfirm < /dev/null 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
            cd -
            PM="paru"
        else
            log "[ERROR] Cannot install AUR helper. Please install yay or paru manually."
        fi
    fi

    # Check which AUR packages are already installed
    # Also check isolation prefix for buildable programs
    MISSING_AUR=()
    BUILDABLE_PROGS="ags eww quickshell fabric goignis hyprpanel"
    for pkg in "\${AUR_PACKAGES[@]}"; do
        if pacman -Qi "\$pkg" &>/dev/null; then
            log "[AUR_INSTALLED] \$pkg (pacman)"
        else
            # For buildable programs, also check isolation prefix
            prog_name=\$(echo "\$pkg" | sed "s/-git\\\$//" | sed "s/^aylurs-gtk-shell\\\$/ags/" | sed "s/^python-ignis\\\$/goignis/")
            if echo "\$BUILDABLE_PROGS" | grep -qw "\$prog_name" && type check_isolated_program &>/dev/null && check_isolated_program "\$prog_name"; then
                log "[AUR_INSTALLED] \$pkg (isolation prefix: \$prog_name)"
            else
                MISSING_AUR+=("\$pkg")
                log "[AUR_MISSING] \$pkg"
            fi
        fi
    done

    if [ \${#MISSING_AUR[@]} -eq 0 ]; then
        log "[SUCCESS] All AUR packages already installed"
    else
        log "[AUR_INSTALLING] \${MISSING_AUR[*]}"

        # Check if any packages have special flags (install those separately)
        SPECIAL_FLAG_PKGS=()
        NORMAL_PKGS=()
        for pkg in "\${MISSING_AUR[@]}"; do
            pkg_flags=\$(get_aur_flags "\$pkg")
            if [ -n "\$pkg_flags" ]; then
                SPECIAL_FLAG_PKGS+=("\$pkg")
            else
                NORMAL_PKGS+=("\$pkg")
            fi
        done

        # Install packages with special flags one by one
        for pkg in "\${SPECIAL_FLAG_PKGS[@]}"; do
            flags=\$(get_aur_flags "\$pkg")
            log "[AUR] Installing \$pkg with special flags: \$flags"
            case \$PM in
                yay)
                    log "[CMD] yay -S --noconfirm --needed \$flags \$pkg"
                    yay -S --noconfirm --needed \$flags "\$pkg" < /dev/null 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
                    log "[EXIT_CODE] \${PIPESTATUS[0]}"
                    ;;
                paru)
                    log "[CMD] paru -S --noconfirm --needed \$flags \$pkg"
                    paru -S --noconfirm --needed \$flags "\$pkg" < /dev/null 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
                    log "[EXIT_CODE] \${PIPESTATUS[0]}"
                    ;;
            esac
        done

        # Install remaining packages normally (batch)
        if [ \${#NORMAL_PKGS[@]} -gt 0 ]; then
            case \$PM in
                yay)
                    log "[CMD] yay -S --noconfirm --needed \${NORMAL_PKGS[*]}"
                    yay -S --noconfirm --needed "\${NORMAL_PKGS[@]}" < /dev/null 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
                    log "[EXIT_CODE] \${PIPESTATUS[0]}"
                    ;;
                paru)
                    log "[CMD] paru -S --noconfirm --needed \${NORMAL_PKGS[*]}"
                    paru -S --noconfirm --needed "\${NORMAL_PKGS[@]}" < /dev/null 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
                    log "[EXIT_CODE] \${PIPESTATUS[0]}"
                    ;;
                *)
                    log "[ERROR] Cannot install AUR packages without yay or paru."
                    log "[ERROR] Please install these packages manually:"
                    printf "%s\\n" "\${NORMAL_PKGS[@]}" | tee -a "\$LOG_FILE"
                    ;;
            esac
        fi
    fi
fi

# ────────────────────────────────────────────────────────────────
# Install Python packages (pip)
# ────────────────────────────────────────────────────────────────
PIP_PACKAGES=(
${pipPackageList}
)

${pipInstallSection}

# ────────────────────────────────────────────────────────────────
# Install Rust packages (cargo)
# ────────────────────────────────────────────────────────────────
CARGO_PACKAGES=(
${cargoPackageList}
)

if [ \${#CARGO_PACKAGES[@]} -gt 0 ]; then
    log ""
    log "[CARGO] Checking Rust packages: \${CARGO_PACKAGES[*]}"
    if command -v cargo &> /dev/null; then
        # Get list of installed cargo packages
        INSTALLED_CARGO=\$(cargo install --list 2>/dev/null | grep -E "^[a-z]" | cut -d" " -f1)

        MISSING_CARGO=()
        for pkg in "\${CARGO_PACKAGES[@]}"; do
            if [ -z "\$pkg" ]; then continue; fi
            if echo "\$INSTALLED_CARGO" | grep -qx "\$pkg"; then
                log "[CARGO_INSTALLED] \$pkg (already installed)"
            else
                MISSING_CARGO+=("\$pkg")
                log "[CARGO_MISSING] \$pkg"
            fi
        done

        if [ \${#MISSING_CARGO[@]} -eq 0 ]; then
            log "[SUCCESS] All cargo packages already installed"
        else
            log "[CARGO] Installing missing packages: \${MISSING_CARGO[*]}"
            for pkg in "\${MISSING_CARGO[@]}"; do
                log "[CARGO] Installing \$pkg..."
                cargo install "\$pkg" 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
            done
        fi
    else
        log "[WARNING] cargo not found. Install rust first."
    fi
fi

# ────────────────────────────────────────────────────────────────
# Install Node packages (npm)
# ────────────────────────────────────────────────────────────────
NPM_PACKAGES=(
${npmPackageList}
)

if [ \${#NPM_PACKAGES[@]} -gt 0 ]; then
    log ""
    log "[NPM] Checking Node packages: \${NPM_PACKAGES[*]}"
    if command -v npm &> /dev/null; then
        MISSING_NPM=()
        for pkg in "\${NPM_PACKAGES[@]}"; do
            if [ -z "\$pkg" ]; then continue; fi
            # Check if package is installed globally
            if npm list -g "\$pkg" &>/dev/null; then
                log "[NPM_INSTALLED] \$pkg (already installed globally)"
            else
                MISSING_NPM+=("\$pkg")
                log "[NPM_MISSING] \$pkg"
            fi
        done

        if [ \${#MISSING_NPM[@]} -eq 0 ]; then
            log "[SUCCESS] All npm packages already installed"
        else
            log "[NPM] Installing missing packages: \${MISSING_NPM[*]}"
            for pkg in "\${MISSING_NPM[@]}"; do
                log "[NPM] Installing \$pkg globally..."
                sudo npm install -g "\$pkg" 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
            done
        fi
    else
        log "[WARNING] npm not found. Install nodejs first."
    fi
fi
${isolatedWidgetBuilds}${hyprpanelAdaptiveBuild}${quickshellAdaptiveBuild}${postInstallPatches}
# Verify installation of all packages
ALL_PACKAGES=("\${PACKAGES[@]}" "\${AUR_PACKAGES[@]}")
if [ \${#ALL_PACKAGES[@]} -gt 0 ]; then
    log ""
    log "[VERIFY] Checking installation results..."
    FAILED_PACKAGES=()
    for pkg in "\${ALL_PACKAGES[@]}"; do
        if [ -z "\$pkg" ]; then continue; fi
        if ! pacman -Qi "\$pkg" &>/dev/null && ! pacman -Qi "\${pkg%-git}" &>/dev/null; then
            # Also check if command exists (for -git packages)
            cmd_name=\$(echo "\$pkg" | sed "s/-git\$//" | sed "s/-bin\$//")
            if ! command -v "\$cmd_name" &>/dev/null; then
                FAILED_PACKAGES+=("\$pkg")
                log "[FAILED] \$pkg - not installed"
            else
                log "[OK] \$pkg - command found: \$cmd_name"
            fi
        else
            log "[OK] \$pkg"
        fi
    done

    if [ \${#FAILED_PACKAGES[@]} -gt 0 ]; then
        log "[WARNING] Failed to install: \${FAILED_PACKAGES[*]}"
    fi
fi

echo "═══════════════════════════════════════════════════════════════" | tee -a "\$LOG_FILE"
log "  Installation complete!"
log "  Log saved to: ~/.cache/lastlayer/logs/..."
echo "═══════════════════════════════════════════════════════════════" | tee -a "\$LOG_FILE"

echo ""
echo "Press Enter to close this terminal..."
read -r
INSTALL_EOF

# Make the temp script executable and run it in xterm
chmod +x "\$INSTALL_SCRIPT"

# Read xterm settings from settings.json
SETTINGS_FILE="\$HOME/.config/lastlayer/settings.json"
if [ -f "\$SETTINGS_FILE" ] && command -v jq &>/dev/null; then
    XTERM_BG=\$(jq -r '.xterm_bg // "#2e3440"' "\$SETTINGS_FILE")
    XTERM_FG=\$(jq -r '.xterm_fg // "#d8dee9"' "\$SETTINGS_FILE")
    XTERM_FONT=\$(jq -r '.xterm_font // "Monospace"' "\$SETTINGS_FILE")
    XTERM_FONT_SIZE=\$(jq -r '.xterm_font_size // 11' "\$SETTINGS_FILE")
    XTERM_WIDTH=\$(jq -r '.xterm_width // 80' "\$SETTINGS_FILE")
    XTERM_HEIGHT=\$(jq -r '.xterm_height // 20' "\$SETTINGS_FILE")
else
    XTERM_BG="#2e3440"
    XTERM_FG="#d8dee9"
    XTERM_FONT="Monospace"
    XTERM_FONT_SIZE=11
    XTERM_WIDTH=80
    XTERM_HEIGHT=20
fi

xterm -title "Installing ${themeName}" \\
    -bg "\$XTERM_BG" -fg "\$XTERM_FG" \\
    -fa "\$XTERM_FONT" -fs "\$XTERM_FONT_SIZE" \\
    -geometry "\${XTERM_WIDTH}x\${XTERM_HEIGHT}" \\
    -e "\$INSTALL_SCRIPT"

# Clean up temp script after xterm closes
rm -f "\$INSTALL_SCRIPT"

# Signal completion (outside xterm)
SCRIPT_COMPLETION_FLAG="/tmp/lastlayer_script_completed_${themeName}_\$(date +%s).flag"
echo "SCRIPT_COMPLETED" > "\$SCRIPT_COMPLETION_FLAG"

exit 0
`;

        const scriptPath = `${themePath}/start-scripts/install_theme_apps.sh`;
        this.writeFile(scriptPath, script);
        this.makeExecutable(scriptPath);
    }

    generateSetAfterInstallScript(themePath, themeName, detectedApps) {
        const isolationEnabled = this.isIsolationEnabled();
        const venvPath = this.getVenvPath(themeName);
        const hyprpanelIsolationEnabled = this.isHyprpanelAdaptiveIsolationEnabled();
        const hyprpanelDetected = detectedApps?.some(app => app.toLowerCase() === 'hyprpanel');
        const useHyprpanelIsolation = hyprpanelIsolationEnabled && hyprpanelDetected;
        const quickshellIsolationEnabled = this.isQuickshellAdaptiveIsolationEnabled();
        const quickshellDetected = detectedApps?.some(app => app.toLowerCase() === 'quickshell');
        const useQuickshellIsolation = quickshellIsolationEnabled && quickshellDetected;
        const quickshellPrefix = this.normalizeHomePath(this.getQuickshellAdaptivePrefix(themeName));
        const hyprpanelPathSetup = useHyprpanelIsolation
            ? `HYPRPANEL_PREFIX="$HOME/.local/share/lastlayer/programs/rices/${themeName}"
export PATH="$HYPRPANEL_PREFIX/bin:$PATH"
`
            : '';
        const quickshellPathSetup = useQuickshellIsolation
            ? `QUICKSHELL_PREFIX="${quickshellPrefix}"
export PATH="$QUICKSHELL_PREFIX/bin:$PATH"
`
            : '';

        const killConflictingServices = this.generateKillConflictingServices(detectedApps);

        let barStartCommand = this.generateBarStartCommand(detectedApps, isolationEnabled, venvPath);

        const script = `#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  Theme: ${themeName.padEnd(52)}║
# ║  Post-Installation Actions                                   ║
# ║  Generated by llayer-plus                                    ║
# ╚══════════════════════════════════════════════════════════════╝

set +e  # Don't exit on errors

# Hide username in sudo prompts (for privacy/screencasts)
export SUDO_PROMPT="[sudo] password: "

# ────────────────────────────────────────────────────────────────
# Logging setup
# ────────────────────────────────────────────────────────────────
LOG_DIR="$HOME/.cache/lastlayer/logs"
mkdir -p "\$LOG_DIR"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
LOG_FILE="\$LOG_DIR/apply_${themeName}_\$TIMESTAMP.log"

log() {
    local msg="\$1"
    echo "\$msg"
    echo "[\$(date +%H:%M:%S)] \$msg" >> "\$LOG_FILE"
}

log_cmd() {
    local desc="\$1"
    shift
    log "[CMD] \$desc: \$*"
    "\$@" 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
    local exit_code=\${PIPESTATUS[0]}
    log "[EXIT_CODE] \$exit_code"
    return \$exit_code
}

# Sanitize output to hide username for privacy
sanitize_output() {
    sed -e "s|/home/\$USER/|~/|g" \\
        -e "s|/home/\$(whoami)/|~/|g" \\
        -e "s|password for \$USER:|password for <user>:|g" \\
        -e "s|password for \$(whoami):|password for <user>:|g" \\
        -e "s|\$USER@|<user>@|g" \\
        -e "s|\$(whoami)@|<user>@|g"
}

log "═══════════════════════════════════════════════════════════════"
log "  Applying theme: ${themeName}"
log "  Log file: ~/.cache/lastlayer/logs/..."
log "═══════════════════════════════════════════════════════════════"

# System info (username hidden for privacy)
log "[SYSTEM_INFO] Date: \$(date)"
log "[SYSTEM_INFO] DISPLAY: \$DISPLAY"
log "[SYSTEM_INFO] WAYLAND_DISPLAY: \$WAYLAND_DISPLAY"
log "[SYSTEM_INFO] XDG_RUNTIME_DIR: \$XDG_RUNTIME_DIR"

# Environment setup
export XDG_RUNTIME_DIR="\${XDG_RUNTIME_DIR:-/run/user/\$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="\${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/\$(id -u)/bus}"
export WAYLAND_DISPLAY="\${WAYLAND_DISPLAY:-wayland-0}"

THEME_DIR="$HOME/.config/themes/${themeName}"
log "[THEME_DIR] \$THEME_DIR"
${hyprpanelPathSetup}
${quickshellPathSetup}

# ────────────────────────────────────────────────────────────────
# 1. Safe copy of config files using rsync
# ────────────────────────────────────────────────────────────────
copy_theme_configs() {
    local SRC_DIR="\$THEME_DIR/config"
    local DEST_DIR="$HOME/.config"

    if [ ! -d "\$SRC_DIR" ]; then
        log "[SKIP] No config directory found at \$SRC_DIR"
        return
    fi

    log "[COPY_CONFIG] Starting config copy from \$SRC_DIR"
    mkdir -p "\$DEST_DIR"

    for item in "\$SRC_DIR"/*; do
        [ -e "\$item" ] || continue
        local name=\$(basename "\$item")
        local dest="\$DEST_DIR/\$name"

        if [ -d "\$item" ]; then
            log "[COPY] Directory: \$name -> \$dest"
            if command -v rsync &> /dev/null; then
                mkdir -p "\$dest"
                rsync -a --checksum "\$item/" "\$dest/" 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || cp -rf "\$item"/* "\$dest/" 2>&1 | sanitize_output | tee -a "\$LOG_FILE"
            else
                mkdir -p "\$dest"
                cp -rf "\$item"/* "\$dest/" 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || true
            fi
        else
            log "[COPY] File: \$name"
            cp -f "\$item" "\$DEST_DIR/" 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || true
        fi
    done
    log "[DONE] Config files copied"
}
copy_theme_configs

# ────────────────────────────────────────────────────────────────
# 2. Copy hyprland configs
# ────────────────────────────────────────────────────────────────
copy_hypr_configs() {
    local SRC="\$THEME_DIR/hyprland"
    local DEST="$HOME/.config/hypr"

    if [ ! -d "\$SRC" ]; then
        log "[SKIP] No hyprland directory found at \$SRC"
        return
    fi

    log "[COPY_HYPR] Starting hyprland config copy"
    mkdir -p "\$DEST"

    if command -v rsync &> /dev/null; then
        log "[RSYNC] Using rsync for hyprland configs"
        rsync -av --checksum \\
            --exclude 'hyprland.conf' \\
            --exclude 'general.conf' \\
            --exclude 'keybinds.conf' \\
            --exclude 'rules.conf' \\
            --exclude 'colors.conf' \\
            --exclude 'execs.conf' \\
            --exclude 'env.conf' \\
            "\$SRC/" "\$DEST/" 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || true

        for conf in general.conf keybinds.conf rules.conf colors.conf execs.conf env.conf; do
            if [ -f "\$SRC/\$conf" ] && [ ! -f "\$DEST/\$conf" ]; then
                log "[COPY] Modular config: \$conf"
                cp -f "\$SRC/\$conf" "\$DEST/"
            fi
        done

        if [ -f "\$SRC/hyprland.conf" ]; then
            log "[COPY] Reference config: hyprland.conf.theme"
            cp -f "\$SRC/hyprland.conf" "\$DEST/hyprland.conf.theme" 2>/dev/null || true
        fi
    else
        log "[FALLBACK] Using cp for hyprland configs"
        cp -rn "\$SRC"/* "\$DEST/" 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || true
    fi
    log "[DONE] Hyprland configs copied"
}
copy_hypr_configs

# ────────────────────────────────────────────────────────────────
# 3. Apply wallpaper
# ────────────────────────────────────────────────────────────────
apply_wallpaper() {
    local WP=""

    # First check for gowall-transformed wallpaper (color scheme applied)
    for ext in png jpg jpeg webp; do
        if [ -f "\$THEME_DIR/.gowall-transformed.\$ext" ]; then
            WP="\$THEME_DIR/.gowall-transformed.\$ext"
            log "[WALLPAPER] Using gowall-transformed: \$WP"
            break
        fi
    done

    # Fall back to original wallpaper if no transformed version exists
    if [ -z "\$WP" ]; then
        for ext in png jpg jpeg webp; do
            if [ -f "\$THEME_DIR/wallpaper.\$ext" ]; then
                WP="\$THEME_DIR/wallpaper.\$ext"
                break
            fi
        done
    fi

    if [ -z "\$WP" ]; then
        log "[SKIP] No wallpaper found"
        return
    fi

    log "[WALLPAPER] Found: \$WP"

    if command -v swww &> /dev/null; then
        log "[WALLPAPER] Using swww"
        swww query &>/dev/null || { log "[WALLPAPER] Starting swww-daemon"; swww-daemon & }
        sleep 0.3
        swww img "\$WP" --transition-type fade --transition-duration 1 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || true
    elif command -v hyprctl &> /dev/null && hyprctl hyprpaper listactive &>/dev/null; then
        log "[WALLPAPER] Using hyprpaper"
        hyprctl hyprpaper wallpaper ",\$WP" 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || true
    elif command -v swaybg &> /dev/null; then
        log "[WALLPAPER] Using swaybg"
        pkill swaybg 2>/dev/null || true
        setsid swaybg -i "\$WP" -m fill >/dev/null 2>&1 < /dev/null &
    else
        log "[WARNING] No wallpaper tool found (swww, hyprpaper, swaybg)"
    fi
}
apply_wallpaper

# ────────────────────────────────────────────────────────────────
# 4. Reset cursor to default
# ────────────────────────────────────────────────────────────────
reset_cursor() {
    if command -v hyprctl &> /dev/null; then
        local cursor_name="Bibata-Modern-Classic"
        local cursor_size="24"
        log "[CURSOR] Setting cursor: \$cursor_name size \$cursor_size"
        hyprctl setcursor "\$cursor_name" "\$cursor_size" 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || \\
        hyprctl setcursor "Adwaita" 24 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || true
    fi
}
reset_cursor
${killConflictingServices}${barStartCommand}

# ────────────────────────────────────────────────────────────────
# 6. Reload Hyprland configuration
# ────────────────────────────────────────────────────────────────
if command -v hyprctl &> /dev/null; then
    log "[HYPRLAND] Reloading configuration..."
    hyprctl reload 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || true
fi

log "═══════════════════════════════════════════════════════════════"
log "  Theme applied successfully!"
log "  Log saved to: ~/.cache/lastlayer/logs/..."
log "═══════════════════════════════════════════════════════════════"
exit 0
`;

        const scriptPath = `${themePath}/start-scripts/set_after_install_actions.sh`;
        this.writeFile(scriptPath, script);
        this.makeExecutable(scriptPath);
    }

    generateBarStartCommand(detectedApps, isolationEnabled = false, venvPath = '') {
        const apps = detectedApps.map(a => a.toLowerCase());

        const venvActivation = isolationEnabled && venvPath ? `
    # Activate isolated venv for Python dependencies
    VENV_PATH="${venvPath}"
    if [ -f "\$VENV_PATH/bin/activate" ]; then
        log "[VENV] Activating isolated environment at \$VENV_PATH"
        source "\$VENV_PATH/bin/activate"
    fi
` : '';
        const hasDock = apps.includes('nwg-dock-hyprland');
        const dockStartScript = hasDock ? `
# ────────────────────────────────────────────────────────────────
# 6. Start Nwg Dock (bottom dock)
# ────────────────────────────────────────────────────────────────
start_nwg_dock() {
    log "[BAR] Attempting to start nwg-dock-hyprland"
    if command -v nwg-dock-hyprland &> /dev/null; then
        log "[BAR] nwg-dock-hyprland found at: \$(which nwg-dock-hyprland)"
        pkill -f nwg-dock-hyprland 2>/dev/null || true
        sleep 0.3
        local dock_cmd="nwg-dock-hyprland -p bottom -l overlay -x -mb 6"
        local launcher="\$THEME_DIR/config/rofi/launchers/type-3/grid/grid-launcher.sh"
        if [ -x "\$launcher" ]; then
            dock_cmd="\$dock_cmd -c \$launcher"
        fi
        # Nwg-dock reads CSS from $XDG_CONFIG_HOME/nwg-dock-hyprland/style.css.
        # Do NOT override XDG_CONFIG_HOME: on Wayland it can break GTK settings/icon theme resolution,
        # causing missing icons (orange X) for running apps. Instead, sync per-theme CSS into the global dir.
        if [ -f "\$THEME_DIR/config/nwg-dock-hyprland/style.css" ]; then
            mkdir -p "\$HOME/.config/nwg-dock-hyprland" 2>/dev/null || true
            cp -f "\$THEME_DIR/config/nwg-dock-hyprland/style.css" "\$HOME/.config/nwg-dock-hyprland/style.css" 2>/dev/null || true
        fi

        # Some parts of LastLayer temporarily override XDG_CONFIG_HOME during apply.
        # Ensure the dock always starts with the user's normal GTK settings/icon theme.
        # Also drop GDK_BACKEND=x11 if it was set globally so layer-shell works on Wayland.
        dock_cmd="env -u XDG_CONFIG_HOME -u GDK_BACKEND \$dock_cmd"
        log "[BAR] Starting nwg-dock-hyprland..."
        if command -v hyprctl &> /dev/null; then
            hyprctl dispatch exec "\$dock_cmd"
            local pid=""
        else
            setsid bash -c "\$dock_cmd" >/dev/null 2>&1 < /dev/null &
            local pid=\$!
        fi
        sleep 1
        if [ -n "\$pid" ] && kill -0 \$pid 2>/dev/null; then
            log "[BAR] nwg-dock-hyprland started successfully (PID: \$pid)"
        else
            if pgrep -f nwg-dock-hyprland &>/dev/null; then
                log "[BAR] nwg-dock-hyprland started successfully"
            else
                log "[ERROR] nwg-dock-hyprland failed to start"
            fi
        fi
    else
        log "[WARNING] nwg-dock-hyprland not found in PATH"
        log "[WARNING] Install with: yay -S nwg-dock-hyprland"
    fi
}
start_nwg_dock
` : '';
        const agsStartHelpers = `
resolve_ags_dir() {
    local dir=""
    for dir in \
        "$THEME_DIR/ags" \
        "$THEME_DIR/config/ags" \
        "$THEME_DIR/components/ags" \
        "$THEME_DIR/base/ags"
    do
        [ -d "$dir" ] && { echo "$dir"; return 0; }
    done
    return 1
}

resolve_ags_bin() {
    local mode="\${1:-auto}"
    local candidates=()
    local candidate=""

    case "$mode" in
        v1)
            candidates=(
                "$HOME/.local/bin/agsv1"
                "$HOME/.local/bin/ags-1.8.2"
                "$HOME/.local/bin/ags"
            )
            ;;
        v2)
            candidates=(
                "$HOME/.local/bin/ags-v2.3.0"
                "$HOME/.local/bin/ags-2.0.0"
                "$HOME/.local/bin/ags"
            )
            ;;
        *)
            candidates=(
                "$HOME/.local/bin/ags"
                "$HOME/.local/bin/agsv1"
                "$HOME/.local/bin/ags-v2.3.0"
                "$HOME/.local/bin/ags-2.0.0"
                "$HOME/.local/bin/ags-1.8.2"
            )
            ;;
    esac

    for candidate in "\${candidates[@]}"; do
        [ -x "$candidate" ] && { echo "$candidate"; return 0; }
    done

    case "$mode" in
        v1)
            command -v agsv1 2>/dev/null || command -v ags 2>/dev/null || true
            ;;
        *)
            command -v ags 2>/dev/null || command -v agsv1 2>/dev/null || true
            ;;
    esac
}

build_ags_start_cmd() {
    local preferred="\${1:-auto}"
    local ags_dir=""
    ags_dir="$(resolve_ags_dir)" || return 1

    local mode=""
    case "$preferred" in
        agsv1|v1) mode="v1" ;;
        ags|v2) mode="v2" ;;
    esac

    [ -f "$ags_dir/config.js" ] && mode="v1"
    [ -f "$ags_dir/app.ts" ] && mode="v2"

    case "$mode" in
        "")
            case "$preferred" in
                agsv1|v1) mode="v1" ;;
                *) mode="v2" ;;
            esac
            ;;
    esac

    local ags_bin=""
    ags_bin="$(resolve_ags_bin "$mode")"
    [ -n "$ags_bin" ] || return 1

    case "$mode" in
        v1)
            if [ -f "$ags_dir/config.js" ]; then
                printf '"%s" -c "%s"' "$ags_bin" "$ags_dir/config.js"
            else
                printf '"%s"' "$ags_bin"
            fi
            ;;
        v2)
            if [ -x "$ags_dir/themes/init.sh" ]; then
                printf '"%s" >/dev/null 2>&1 || true; "%s" run -d "%s"' "$ags_dir/themes/init.sh" "$ags_bin" "$ags_dir"
            else
                printf '"%s" run -d "%s"' "$ags_bin" "$ags_dir"
            fi
            ;;
    esac
}

start_ags() {
    local preferred="\${1:-auto}"
    log "[BAR] Attempting to start ags"
    local start_cmd=""
    start_cmd="$(build_ags_start_cmd "$preferred")"
    if [ -z "$start_cmd" ]; then
        log "[WARNING] ags runtime/config not found for this theme"
        return 1
    fi

    pkill -TERM -x ags 2>/dev/null || true
    pkill -TERM -x agsv1 2>/dev/null || true
    pkill -TERM -x ags-1.8.2 2>/dev/null || true
    pkill -TERM -x ags-2.0.0 2>/dev/null || true
    pkill -TERM -x ags-v2.3.0 2>/dev/null || true
    pkill -TERM -f "/run/user/$(id -u)/.*ags\\.js" 2>/dev/null || true
    pkill -TERM -f "gjs.*(ags|Aylur)" 2>/dev/null || true
    sleep 0.5

    log "[BAR] Starting ags with: $start_cmd"
    setsid bash -lc "$start_cmd" >/dev/null 2>&1 < /dev/null &
    local pid=$!
    timeout 5 busctl --user wait com.github.Aylur.ags 2>/dev/null || true
    sleep 1

    if kill -0 $pid 2>/dev/null || pgrep -x ags &>/dev/null || pgrep -x agsv1 &>/dev/null; then
        log "[BAR] ags started successfully"
    else
        log "[ERROR] ags failed to start"
    fi
}
`;

        if (apps.includes('quickshell')) {
            return `
# ────────────────────────────────────────────────────────────────
# 5. Start Quickshell (background, detached from terminal)
# ────────────────────────────────────────────────────────────────
start_quickshell() {
    log "[BAR] Attempting to start quickshell"
    local resolved_bin=""
    if [ -n "\$QUICKSHELL_PREFIX" ] && [ -x "\$QUICKSHELL_PREFIX/bin/quickshell" ]; then
        resolved_bin="\$QUICKSHELL_PREFIX/bin/quickshell"
    else
        local any_bin=""
        any_bin=\$(find "\$HOME/.local/share/lastlayer/programs/rices" -maxdepth 3 -type f -name quickshell -path "*/bin/quickshell" -executable 2>/dev/null | head -n 1)
        if [ -z "\$any_bin" ]; then
            any_bin=\$(find "\$HOME/.local/share/lastlayer/programs/shared/quickshell" -maxdepth 3 -type f -name quickshell -path "*/bin/quickshell" -executable 2>/dev/null | head -n 1)
        fi
        if [ -z "\$any_bin" ]; then
            any_bin=\$(find "\$HOME/.local/share/lastlayer/programs/quickshell" -maxdepth 3 -type f -name quickshell -path "*/bin/quickshell" -executable 2>/dev/null | head -n 1)
        fi
        if [ -n "\$any_bin" ] && [ -x "\$any_bin" ]; then
            resolved_bin="\$any_bin"
        fi
    fi

    if [ -z "\$resolved_bin" ] && command -v quickshell &> /dev/null; then
        resolved_bin="\$(command -v quickshell)"
    fi

    if [ -n "\$resolved_bin" ]; then
        log "[BAR] quickshell found at: \$resolved_bin"
        pkill -x quickshell 2>/dev/null || true
        sleep 0.5
        local shell_path=""
        if [ -f "\$THEME_DIR/common/quickshell/shell.qml" ]; then
            shell_path="\$THEME_DIR/common/quickshell/shell.qml"
        fi
        log "[BAR] Starting quickshell..."
        if [ -n "\$shell_path" ]; then
            setsid "\$resolved_bin" -p "\$shell_path" >/dev/null 2>&1 < /dev/null &
        else
            setsid "\$resolved_bin" >/dev/null 2>&1 < /dev/null &
        fi
        local pid=\$!
        sleep 1
        if kill -0 \$pid 2>/dev/null; then
            log "[BAR] quickshell started successfully (PID: \$pid)"
        else
            log "[ERROR] quickshell failed to start"
        fi
    else
        log "[WARNING] quickshell not found in PATH"
        log "[WARNING] Install with: yay -S quickshell-git"
    fi
}
start_quickshell
${dockStartScript}`;
        }

        if (apps.includes('fabric')) {
            return `
# ────────────────────────────────────────────────────────────────
# 5. Start Fabric (background, detached from terminal)
# ────────────────────────────────────────────────────────────────
start_fabric() {
    log "[BAR] Attempting to start fabric"
${venvActivation}
    if command -v fabric &> /dev/null; then
        log "[BAR] fabric found at: \$(which fabric)"
        pkill -x fabric 2>/dev/null || true
        sleep 0.5
        log "[BAR] Starting fabric..."
        setsid fabric >/dev/null 2>&1 < /dev/null &
        local pid=\$!
        sleep 1
        if kill -0 \$pid 2>/dev/null; then
            log "[BAR] fabric started successfully (PID: \$pid)"
        else
            log "[ERROR] fabric failed to start"
        fi
    else
        log "[WARNING] fabric not found in PATH"
        log "[WARNING] Install with: yay -S fabric-git"
    fi
}
start_fabric
${dockStartScript}`;
        }

        if (apps.includes('hyprpanel') && apps.includes('ags')) {
            return `
# ────────────────────────────────────────────────────────────────
# 5. Start HyprPanel or AGS (prefer HyprPanel if AGS config is empty)
# ────────────────────────────────────────────────────────────────
start_hyprpanel() {
    log "[BAR] Attempting to start hyprpanel"
    local resolved_bin=""
    if [ -n "\$HYPRPANEL_PREFIX" ] && [ -x "\$HYPRPANEL_PREFIX/bin/hyprpanel" ]; then
        resolved_bin="\$HYPRPANEL_PREFIX/bin/hyprpanel"
    else
        local any_bin=""
        any_bin=\$(find "\$HOME/.local/share/lastlayer/programs/rices" -maxdepth 3 -type f -name hyprpanel -path "*/bin/hyprpanel" -executable 2>/dev/null | head -n 1)
        if [ -n "\$any_bin" ] && [ -x "\$any_bin" ]; then
            resolved_bin="\$any_bin"
        fi
    fi

    if [ -z "\$resolved_bin" ] && command -v hyprpanel &> /dev/null; then
        local path_bin=""
        path_bin="\$(command -v hyprpanel)"
        # /usr/bin/hyprpanel is sometimes a different Go project; it can't read HyprPanel rice configs.
        if [ -n "\$path_bin" ] && "\$path_bin" --version 2>/dev/null | grep -qi "built with go"; then
            log "[WARNING] hyprpanel on PATH looks like Go binary; skipping"
        else
            resolved_bin="\$path_bin"
        fi
    fi
    if [ -n "\$resolved_bin" ]; then
        log "[BAR] hyprpanel found at: \$resolved_bin"
        pkill -x hyprpanel 2>/dev/null || true
        pkill -f "hyprpanel-app" 2>/dev/null || true
        # HyprPanel fails hard if mako is already running (it bundles its own notification daemon).
        if command -v systemctl &>/dev/null; then
            systemctl --user stop mako.service 2>/dev/null || true
        fi
        pkill -x mako 2>/dev/null || true
        sleep 0.5
        log "[BAR] Starting hyprpanel..."
        env GDK_BACKEND=wayland XDG_SESSION_TYPE=wayland setsid "\$resolved_bin" >/dev/null 2>&1 < /dev/null &
        local pid=\$!
        sleep 1
        if kill -0 \$pid 2>/dev/null; then
            log "[BAR] hyprpanel started successfully (PID: \$pid)"
        else
            log "[ERROR] hyprpanel failed to start"
        fi
    else
        log "[WARNING] hyprpanel not found in PATH"
        log "[WARNING] Install with: yay -S hyprpanel-git"
    fi
}
${agsStartHelpers}

has_ags_config="false"
ags_dir="$(resolve_ags_dir 2>/dev/null || true)"
if [ -n "$ags_dir" ] && find "$ags_dir" -type f -print -quit 2>/dev/null | grep -q .; then
    has_ags_config="true"
fi

if [ "$has_ags_config" = "true" ]; then
    start_ags auto
else
    start_hyprpanel
fi
${dockStartScript}`;
        }

        if (apps.includes('hyprpanel')) {
            return `
# ────────────────────────────────────────────────────────────────
# 5. Start HyprPanel (background, detached from terminal)
# ────────────────────────────────────────────────────────────────
start_hyprpanel() {
    log "[BAR] Attempting to start hyprpanel"
    local resolved_bin=""
    if [ -n "\$HYPRPANEL_PREFIX" ] && [ -x "\$HYPRPANEL_PREFIX/bin/hyprpanel" ]; then
        resolved_bin="\$HYPRPANEL_PREFIX/bin/hyprpanel"
    else
        local any_bin=""
        any_bin=\$(find "\$HOME/.local/share/lastlayer/programs/rices" -maxdepth 3 -type f -name hyprpanel -path "*/bin/hyprpanel" -executable 2>/dev/null | head -n 1)
        if [ -n "\$any_bin" ] && [ -x "\$any_bin" ]; then
            resolved_bin="\$any_bin"
        fi
    fi

    if [ -z "\$resolved_bin" ] && command -v hyprpanel &> /dev/null; then
        local path_bin=""
        path_bin="\$(command -v hyprpanel)"
        if [ -n "\$path_bin" ] && "\$path_bin" --version 2>/dev/null | grep -qi "built with go"; then
            log "[WARNING] hyprpanel on PATH looks like Go binary; skipping"
        else
            resolved_bin="\$path_bin"
        fi
    fi
    if [ -n "\$resolved_bin" ]; then
        log "[BAR] hyprpanel found at: \$resolved_bin"
        pkill -x hyprpanel 2>/dev/null || true
        pkill -f "hyprpanel-app" 2>/dev/null || true
        if command -v systemctl &>/dev/null; then
            systemctl --user stop mako.service 2>/dev/null || true
        fi
        pkill -x mako 2>/dev/null || true
        sleep 0.5
        log "[BAR] Starting hyprpanel..."
        env GDK_BACKEND=wayland XDG_SESSION_TYPE=wayland setsid "\$resolved_bin" >/dev/null 2>&1 < /dev/null &
        local pid=\$!
        sleep 1
        if kill -0 \$pid 2>/dev/null; then
            log "[BAR] hyprpanel started successfully (PID: \$pid)"
        else
            log "[ERROR] hyprpanel failed to start"
        fi
    else
        log "[WARNING] hyprpanel not found in PATH"
        log "[WARNING] Install with: yay -S hyprpanel-git"
    fi
}
start_hyprpanel
${dockStartScript}`;
        }



        if (apps.includes('ags')) {
            return `
# ────────────────────────────────────────────────────────────────
# 5. Start AGS (background, detached from terminal)
# ────────────────────────────────────────────────────────────────
${agsStartHelpers}
start_ags auto
${dockStartScript}`;
        }

        if (apps.includes('eww')) {
            return `
# ────────────────────────────────────────────────────────────────
# 5. Start EWW (background, detached from terminal)
# ────────────────────────────────────────────────────────────────
start_eww() {
    log "[BAR] Attempting to start eww"
    if command -v eww &> /dev/null; then
        log "[BAR] eww found at: \$(which eww)"
        pkill -x eww 2>/dev/null || true
        sleep 0.5
        log "[BAR] Starting eww daemon..."
        setsid eww daemon >/dev/null 2>&1 < /dev/null &
        sleep 0.5
        log "[BAR] Opening eww bar..."
        eww open bar 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || eww open-many bar 2>&1 | sanitize_output | tee -a "\$LOG_FILE" || true
        log "[BAR] eww started"
    else
        log "[WARNING] eww not found in PATH"
        log "[WARNING] Install with: yay -S eww"
    fi
}
start_eww
${dockStartScript}`;
        }

        if (apps.includes('ignis')) {
            const isolationPath = isolationEnabled
                ? `\$HOME/.local/share/lastlayer/programs/shared/ignis/isolated/bin`
                : '';

            const goignisBinDetection = isolationEnabled
                ? `# Check isolation prefix first, then system PATH
    local GOIGNIS_BIN=""
    if [ -x "${isolationPath}/goignis" ]; then
        GOIGNIS_BIN="${isolationPath}/goignis"
        log "[BAR] Using isolated goignis: \$GOIGNIS_BIN"
    elif command -v goignis &> /dev/null; then
        GOIGNIS_BIN="\$(which goignis)"
        log "[BAR] Using system goignis: \$GOIGNIS_BIN"
    fi`
                : `# Check system PATH for goignis
    local GOIGNIS_BIN=""
    if command -v goignis &> /dev/null; then
        GOIGNIS_BIN="\$(which goignis)"
        log "[BAR] Using system goignis: \$GOIGNIS_BIN"
    fi`;

            return `
# ────────────────────────────────────────────────────────────────
# 5. Start Ignis (background, detached from terminal)
# ────────────────────────────────────────────────────────────────
start_ignis() {
    log "[BAR] Attempting to start ignis"

    # Kill conflicting notification daemons (ignis provides notification daemon)
    log "[BAR] Stopping conflicting notification daemons..."
    for daemon in swaync mako dunst fnott deadd-notification-center; do
        pkill -x "\$daemon" 2>/dev/null && log "[BAR] Stopped \$daemon" || true
    done

    # Kill existing goignis/ignis processes
    pkill -f "goignis|python.*ignis" 2>/dev/null || true
    sleep 0.5

    # Clean up stale DBus service registration
    if command -v dbus-send &> /dev/null; then
        dbus-send --session --dest=com.github.linkfrg.ignis --type=method_call \\
            /com/github/linkfrg/ignis com.github.linkfrg.ignis.Quit 2>/dev/null || true
    fi
${venvActivation}
    ${goignisBinDetection}

    if [ -n "\$GOIGNIS_BIN" ]; then
        log "[BAR] Starting goignis..."

        # Use hyprctl dispatch exec for proper Wayland access (if available)
        if command -v hyprctl &> /dev/null; then
            log "[BAR] Starting goignis via hyprctl dispatch..."
            # Launch goignis through hyprctl for proper Wayland context
            # PATH setup needed for venv activation${isolationEnabled && venvPath ? `
            hyprctl dispatch exec "PATH=${venvPath}/bin:\$PATH \$GOIGNIS_BIN init"` : `
            hyprctl dispatch exec "\$GOIGNIS_BIN init"`}
            sleep 2

            # Check if ignis started by looking at hyprland layers
            if hyprctl layers 2>/dev/null | grep -q "ignis"; then
                log "[BAR] ignis started successfully (visible in hyprland layers)"
            else
                log "[WARNING] ignis may not have started - check hyprctl layers"
            fi
        else
            # Fallback: direct start (may fail if not in Wayland session)
            setsid "\$GOIGNIS_BIN" init >/dev/null 2>&1 < /dev/null &
            local pid=\$!
            sleep 1
            if kill -0 \$pid 2>/dev/null; then
                log "[BAR] ignis started successfully (PID: \$pid)"
            else
                log "[ERROR] ignis failed to start"
            fi
        fi
    else
        log "[WARNING] goignis not found in isolation prefix or PATH"
        log "[WARNING] Install with: yay -S python-ignis goignis"
    fi
}
start_ignis
${dockStartScript}`;
        }

        if (apps.includes('waybar')) {
            return `
# ────────────────────────────────────────────────────────────────
# 5. Start Waybar (background, detached from terminal)
# ────────────────────────────────────────────────────────────────
start_waybar() {
    log "[BAR] Attempting to start waybar"
    if command -v waybar &> /dev/null; then
        log "[BAR] waybar found at: \$(which waybar)"
        pkill -x waybar 2>/dev/null || true
        sleep 0.5
        log "[BAR] Starting waybar..."
        setsid waybar >/dev/null 2>&1 < /dev/null &
        local pid=\$!
        sleep 1
        if kill -0 \$pid 2>/dev/null; then
            log "[BAR] waybar started successfully (PID: \$pid)"
        else
            log "[ERROR] waybar failed to start"
        fi
    else
        log "[WARNING] waybar not found in PATH"
        log "[WARNING] Install with: yay -S waybar"
    fi
}
start_waybar
${dockStartScript}`;
        }

        if (hasDock) {
            return dockStartScript;
        }

        return '';
    }

    writeFile(path, content) {
        const written = tryRun(`InstallScriptGenerator.writeFile:${path}`, () => {
            const dir = path.substring(0, path.lastIndexOf('/'));
            const dirFile = Gio.File.new_for_path(dir);
            if (!dirFile.query_exists(null)) {
                dirFile.make_directory_with_parents(null);
            }
            GLib.file_set_contents(path, content);
        });
        !written && this.log('Failed to write file:', path);
    }

    makeExecutable(path) {
        tryRun(`InstallScriptGenerator.makeExecutable:${path}`, () => {
            GLib.spawn_command_line_sync(`chmod +x "${path}"`);
        });
    }
}
