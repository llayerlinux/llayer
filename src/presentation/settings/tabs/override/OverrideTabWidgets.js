import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {addPointerCursor} from '../../../common/ViewUtils.js';
import {SettingsService} from '../../../../infrastructure/settings/SettingsService.js';
import {AIProviderService} from '../../../../infrastructure/ai/AIProviderService.js';
import { tryOrFalse, tryOrNull, tryRun } from '../../../../infrastructure/utils/ErrorUtils.js';

const IMAGE_TOOLS = [
    { id: 'imagemagick', name: 'ImageMagick', commands: ['convert', 'magick', 'mogrify', 'identify'], package: 'imagemagick' },
    { id: 'ffmpeg', name: 'FFmpeg', commands: ['ffmpeg'], package: 'ffmpeg' },
    { id: 'gowall', name: 'Gowall', commands: ['gowall'], package: 'gowall', aur: true },
    { id: 'gimp', name: 'GIMP (CLI)', commands: ['gimp'], package: 'gimp' }
];

const PREINSTALL_COMPONENT_SETS = {
    'hyprpanel-rices': {
        name: 'HyprPanel Rices',
        description: 'Components for rices using HyprPanel bar (e.g., im-addicted, end-4)',
        components: [
            {
                id: 'hyprpanel-deps',
                name: 'HyprPanel Dependencies',
                packages: ['pipewire', 'libgtop', 'bluez', 'bluez-utils', 'btop', 'networkmanager', 'dart-sass', 'wl-clipboard', 'brightnessctl', 'swww', 'python', 'gnome-bluetooth-3.0', 'pacman-contrib', 'power-profiles-daemon', 'gvfs'],
                aur: false,
                checkCmd: 'pacman -Qi libgtop &>/dev/null && pacman -Qi dart-sass &>/dev/null',
                installTime: '2-3 min',
                description: 'System dependencies required by HyprPanel'
            },
            {
                id: 'hyprpanel-aur',
                name: 'HyprPanel AUR Dependencies',
                packages: ['grimblast-git', 'gpu-screen-recorder', 'hyprpicker', 'matugen-bin', 'python-gpustat'],
                aur: true,
                checkCmd: 'pacman -Qi grimblast-git &>/dev/null',
                installTime: '3-5 min',
                description: 'AUR packages for HyprPanel functionality'
            },
            {
                id: 'aylurs-gtk-shell',
                name: 'AGS (Aylurs GTK Shell)',
                packages: ['aylurs-gtk-shell'],
                aur: true,
                checkCmd: 'command -v ags &>/dev/null',
                installTime: '3-5 min',
                description: 'GTK shell framework that HyprPanel is built on'
            },
            {
                id: 'bun-runtime',
                name: 'Bun JavaScript Runtime',
                packages: ['bun'],
                aur: false,
                checkCmd: 'command -v bun &>/dev/null',
                installTime: '1 min',
                description: 'Fast JavaScript runtime required to build HyprPanel'
            },
            {
                id: 'meson-build',
                name: 'Meson Build System',
                packages: ['meson', 'ninja', 'typescript', 'npm'],
                aur: false,
                checkCmd: 'command -v meson &>/dev/null && command -v npm &>/dev/null',
                installTime: '1 min',
                description: 'Build tools required to compile HyprPanel'
            },
            {
                id: 'ags-hyprpanel-git',
                name: 'HyprPanel (AGS-based)',
                packages: ['ags-hyprpanel-git'],
                aur: true,
                conflicts: ['hyprpanel', 'hyprpanel-bin', 'aylurs-gtk-shell'],
                checkCmd: 'pacman -Qi ags-hyprpanel-git &>/dev/null',
                installTime: '5-8 min',
                description: 'Pre-built HyprPanel bar (replaces AGS, use this OR let rice build during Install)'
            }
        ]
    },
    'quickshell-rices': {
        name: 'Quickshell Rices',
        description: 'Components for rices using Quickshell bar',
        components: [
            {
                id: 'quickshell-runtime',
                name: 'Quickshell Runtime (Qt6 + Wayland)',
                packages: ['qt6-base', 'qt6-declarative', 'qt6-wayland', 'qt6-svg', 'qt6-shadertools', 'spirv-tools', 'wayland-protocols', 'pipewire', 'wireplumber', 'cli11'],
                aur: false,
                checkCmd: 'pacman -Qi qt6-base &>/dev/null && pacman -Qi qt6-declarative &>/dev/null && pacman -Qi qt6-wayland &>/dev/null',
                installTime: '2-4 min',
                description: 'Qt6/QML runtime and Wayland deps required by Quickshell'
            },
            {
                id: 'quickshell-build-tools',
                name: 'Quickshell Build Tools',
                packages: ['git', 'cmake', 'ninja', 'meson', 'curl'],
                aur: false,
                checkCmd: 'command -v git &>/dev/null && command -v cmake &>/dev/null && command -v ninja &>/dev/null',
                installTime: '1-2 min',
                description: 'Toolchain for building Quickshell in an isolated prefix'
            },
            {
                id: 'quickshell-isolated-build',
                name: 'Quickshell (isolated prefix build)',
                packages: [],
                aur: false,
                customInstall: true,
                checkCmd: function() {
                    const prefix = this.getQuickshellAdaptivePrefixAbsolute(this.settings?.theme);
                    return `[ -x "${prefix}/bin/quickshell" ]`;
                },
                installTime: '5-10 min',
                description: 'Builds Quickshell into the isolated prefix for reuse across reimports',
                installScript: function() {
                    const prefix = this.getQuickshellAdaptivePrefixAbsolute(this.settings?.theme);
                    const mode = this.getIsolationGroupingMode();
                    const themeName = this.settings?.theme || 'default';
                    const buildSuffix = mode === 'per-rice' ? themeName : mode;
                    return `
build_quickshell() {
INSTALL_PREFIX="${prefix}"
BUILD_DIR="$HOME/.cache/lastlayer/quickshell-build-${buildSuffix}"
QUICKSHELL_REPO="https://git.outfoxxed.me/quickshell/quickshell.git"

if [ -x "$INSTALL_PREFIX/bin/quickshell" ]; then
    echo "Quickshell already built in prefix: $INSTALL_PREFIX"
    return 0
fi

if ! command -v git &>/dev/null; then
    echo "git not found. Install git first."
    return 1
fi
if ! command -v cmake &>/dev/null && ! command -v meson &>/dev/null; then
    echo "cmake/meson not found. Install build tools first."
    return 1
fi
if ! command -v ninja &>/dev/null; then
    echo "ninja not found. Install ninja first."
    return 1
fi

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "Cloning Quickshell..."
GIT_SAFE_CLONE="env GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null GIT_TERMINAL_PROMPT=0 git clone --depth 1"
$GIT_SAFE_CLONE "$QUICKSHELL_REPO" "$BUILD_DIR"
if [ $? -ne 0 ]; then
    echo "git clone failed; attempting tarball download..."
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    TARBALL_FILE="$BUILD_DIR/quickshell.tar.gz"
    downloaded=0
    for url in \\
        "https://git.outfoxxed.me/quickshell/quickshell/archive/master.tar.gz" \\
        "https://git.outfoxxed.me/api/v1/repos/quickshell/quickshell/archive/master.tar.gz" \\
        "https://github.com/quickshell-mirror/quickshell/archive/refs/heads/master.tar.gz" \\
        "https://github.com/quickshell-mirror/quickshell/archive/refs/heads/main.tar.gz" \\
        "https://api.github.com/repos/quickshell-mirror/quickshell/tarball/HEAD"
    do
        rm -f "$TARBALL_FILE"
        if command -v curl &>/dev/null; then
            echo "Downloading: $url"
            curl -fL --retry 3 --retry-delay 2 --connect-timeout 10 --max-time 600 "$url" -o "$TARBALL_FILE"
            if [ $? -eq 0 ]; then
                downloaded=1
                break
            fi
        elif command -v wget &>/dev/null; then
            echo "Downloading: $url"
            wget -O "$TARBALL_FILE" "$url"
            if [ $? -eq 0 ]; then
                downloaded=1
                break
            fi
        else
            echo "curl/wget not found. Cannot download Quickshell."
            return 1
        fi
    done
    if [ "$downloaded" -ne 1 ] || [ ! -f "$TARBALL_FILE" ]; then
        echo "Failed to download Quickshell tarball from all sources"
        return 1
    fi
    if ! tar -tzf "$TARBALL_FILE" &>/dev/null; then
        echo "Downloaded tarball is not a valid gzip archive"
        return 1
    fi
    tar -xzf "$TARBALL_FILE" -C "$BUILD_DIR"
    SOURCE_DIR=$(find "$BUILD_DIR" -mindepth 1 -maxdepth 1 -type d -name "quickshell-*" 2>/dev/null | head -n 1)
    if [ -z "$SOURCE_DIR" ]; then
        echo "Failed to locate extracted Quickshell sources"
        return 1
    fi
else
    SOURCE_DIR="$BUILD_DIR"
fi

cd "$SOURCE_DIR"
if [ -f "meson.build" ]; then
    echo "Detected meson.build; using meson + ninja"
    meson setup build --prefix "$INSTALL_PREFIX"
    if [ $? -ne 0 ]; then
        echo "meson setup failed for Quickshell"
        return 1
    fi
    ninja -C build
    if [ $? -ne 0 ]; then
        echo "ninja build failed for Quickshell"
        return 1
    fi
    ninja -C build install
    if [ $? -ne 0 ]; then
        echo "ninja install failed for Quickshell"
        return 1
    fi
elif [ -f "CMakeLists.txt" ]; then
    echo "Detected CMakeLists.txt; using cmake + ninja"
    build_dir="build"
    cmake -S . -B "$build_dir" \\
        -DCMAKE_INSTALL_PREFIX="$INSTALL_PREFIX" \\
        -DCMAKE_BUILD_TYPE=Release \\
        -DINSTALL_QML_PREFIX=lib/qt6/qml \\
        -DDISTRIBUTOR="LastLayer (isolated)" \\
        -DDISTRIBUTOR_DEBUGINFO_AVAILABLE=NO \\
        -DCRASH_REPORTER=OFF
    if [ $? -ne 0 ]; then
        echo "cmake configure failed for Quickshell"
        return 1
    fi
    cmake --build "$build_dir"
    if [ $? -ne 0 ]; then
        echo "cmake build failed; retrying with LTO disabled"
        rm -rf "$build_dir"
        cmake -S . -B "$build_dir" \\
            -DCMAKE_INSTALL_PREFIX="$INSTALL_PREFIX" \\
            -DCMAKE_BUILD_TYPE=Release \\
            -DINSTALL_QML_PREFIX=lib/qt6/qml \\
            -DDISTRIBUTOR="LastLayer (isolated)" \\
            -DDISTRIBUTOR_DEBUGINFO_AVAILABLE=NO \\
            -DCRASH_REPORTER=OFF \\
            -DCMAKE_INTERPROCEDURAL_OPTIMIZATION=OFF \\
            -DCMAKE_C_FLAGS="-O2 -pipe -fno-lto" \\
            -DCMAKE_CXX_FLAGS="-O2 -pipe -fno-lto"
        if [ $? -ne 0 ]; then
            echo "cmake configure failed (LTO disabled) for Quickshell"
            return 1
        fi
        cmake --build "$build_dir"
        if [ $? -ne 0 ]; then
            echo "cmake build failed (LTO disabled) for Quickshell"
            return 1
        fi
    fi
    cmake --install "$build_dir"
    if [ $? -ne 0 ]; then
        echo "cmake install failed for Quickshell"
        return 1
    fi
else
    echo "No meson.build or CMakeLists.txt found for Quickshell"
    return 1
fi

if [ ! -x "$INSTALL_PREFIX/bin/quickshell" ]; then
    echo "Quickshell binary not found after install"
    return 1
fi

mkdir -p "$INSTALL_PREFIX"
echo "$(date +%Y-%m-%d)" > "$INSTALL_PREFIX/.install_date"
echo "Quickshell build complete!"
}
build_quickshell
`;
                }
            }
        ]
    },
    'hypr-dots': {
        name: 'Hypr-Dots',
        description: 'Components for hypr-dots rice (sansroot)',
        components: [
            {
                id: 'waybar-cava',
                name: 'Waybar with Cava',
                packages: ['waybar-cava', 'fftw'],
                aur: true,
                conflicts: ['waybar'],
                checkCmd: 'pacman -Qi waybar-cava &>/dev/null',
                installTime: '3-5 min',
                description: 'Waybar with built-in Cava audio visualizer support'
            },
            {
                id: 'papirus-catppuccin',
                name: 'Papirus Catppuccin Icons',
                packages: ['papirus-folders-catppuccin-git'],
                aur: true,
                conflicts: ['papirus-folders-git'],
                checkCmd: 'pacman -Qi papirus-folders-catppuccin-git &>/dev/null',
                installTime: '1-2 min',
                description: 'Catppuccin-themed Papirus icon folders'
            },
            {
                id: 'cava',
                name: 'Cava Audio Visualizer',
                packages: ['cava'],
                aur: false,
                checkCmd: 'command -v cava',
                installTime: '1 min',
                description: 'Console-based audio visualizer'
            },
            {
                id: 'hyprshot',
                name: 'Hyprshot',
                packages: ['hyprshot'],
                aur: true,
                checkCmd: 'command -v hyprshot',
                installTime: '< 1 min',
                description: 'Screenshot utility for Hyprland'
            },
            {
                id: 'nerd-fonts',
                name: 'Nerd Fonts Bundle',
                packages: ['ttf-jetbrains-mono-nerd', 'otf-font-awesome', 'ttf-font-awesome', 'awesome-terminal-fonts'],
                aur: false,
                checkCmd: 'pacman -Qi ttf-jetbrains-mono-nerd',
                installTime: '2-3 min',
                description: 'Essential Nerd Fonts for terminal and UI'
            },
            {
                id: 'oh-my-zsh',
                name: 'Oh My Zsh + P10k',
                packages: [],
                aur: false,
                customInstall: true,
                checkCmd: '[ -d "$HOME/.oh-my-zsh" ]',
                installTime: '1-2 min',
                description: 'Zsh framework with Powerlevel10k theme',
                installScript: `
                    if [ ! -d "$HOME/.oh-my-zsh" ]; then
                        sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
                    fi
                    if [ ! -d "\${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k" ]; then
                        git clone --depth=1 https://github.com/romkatv/powerlevel10k.git \${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k
                    fi
                    if [ ! -d "\${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions" ]; then
                        git clone https://github.com/zsh-users/zsh-autosuggestions \${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
                    fi
                    if [ ! -d "\${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting" ]; then
                        git clone https://github.com/zsh-users/zsh-syntax-highlighting.git \${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
                    fi
                `
            }
        ]
    }
};

function ensureGowallConfig() {
    return tryOrFalse('OverrideTabWidgets.ensureGowallConfig', () => {
        const configDir = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'gowall']);
        const configPath = GLib.build_filenamev([configDir, 'config.yml']);

        if (!GLib.file_test(configDir, GLib.FileTest.IS_DIR)) {
            GLib.mkdir_with_parents(configDir, 0o755);
        }

        if (GLib.file_test(configPath, GLib.FileTest.EXISTS)) {
            const [ok, contents] = GLib.file_get_contents(configPath);
            if (ok) {
                const configText = new TextDecoder().decode(contents);
                if (configText.includes('EnableImagePreviewing')) {
                    return true;
                }
                const newConfig = configText.trim() + '\nEnableImagePreviewing: false\n';
                GLib.file_set_contents(configPath, newConfig);
                return true;
            }
        }

        GLib.file_set_contents(configPath, 'EnableImagePreviewing: false\n');
        return true;
    });
}

export function applyOverrideTabWidgets(prototype) {

    prototype.getSpecialWidgets = function() {
        return [
            {
                name: 'ignis',
                displayName: 'Ignis',
                hasSpecialInstall: true,
                description: this.t('IGNIS_DESC') === 'IGNIS_DESC'
                    ? 'Python bar with isolated venv build'
                    : this.t('IGNIS_DESC'),
                details: {
                    buildType: 'Isolated Build (venv)',
                    specialFeatures: [
                        'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎвЂќ python-ignis installed in isolated venv',
                        'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎвЂќ goignis built from source (go build .)',
                        'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎвЂќ AUR packages NOT installed (replaced)',
                        'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎвЂќ Patches applied only to venv copy'
                    ],
                    prerequisites: ['go', 'python3', 'pip', 'gtk4', 'gtk4-layer-shell'],
                    technicalSteps: [
                        '1. Clone https://github.com/linkfrg/ignis.git',
                        '2. Create venv: python -m venv ~/.local/share/ignis-venv',
                        '3. pip install . (in venv)',
                        '4. Patch site-packages/ignis/*.py:',
                        '   - Add "from __future__ import annotations"',
                        '   - Replace Gio.DesktopAppInfo Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє GioUnix.DesktopAppInfo',
                        '   - Wrap audio service init in try/except',
                        '5. Clone https://github.com/ignis-sh/goignis.git',
                        '6. go build -o goignis . Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє ~/.local/bin/'
                    ],
                    pipDeps: ['Pillow', 'numpy', 'scikit-learn', 'rapidfuzz', 'python-pam', 'six'],
                    aurReplaced: ['python-ignis', 'goignis'],
                    provides: ['notification_daemon', 'bar'],
                    conflicts: ['swaync', 'mako', 'dunst', 'fnott']
                }
            },
            {
                name: 'quickshell',
                displayName: 'Quickshell',
                hasSpecialInstall: true,
                description: this.t('QUICKSHELL_DESC') === 'QUICKSHELL_DESC'
                    ? 'Qt6/QML shell with special deps'
                    : this.t('QUICKSHELL_DESC'),
                details: {
                    buildType: 'Isolated Prefix Build',
                    specialFeatures: [
                        'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎвЂќ Builds into isolated prefix (shared/per-rice)',
                        'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎвЂќ Skips system quickshell-git install',
                        'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎвЂќ Requires Qt6 wayland integration'
                    ],
                    prerequisites: ['qt6-base', 'qt6-declarative', 'qt6-wayland', 'qt6-svg', 'qt6-shadertools', 'spirv-tools', 'wayland-protocols'],
                    technicalSteps: [
                        '1. Clone https://git.outfoxxed.me/quickshell/quickshell.git',
                        '2. Build with meson or cmake in isolated prefix',
                        '3. Ensure Qt6 wayland plugin present'
                    ],
                    pipDeps: [],
                    aurReplaced: [],
                    provides: ['bar'],
                    conflicts: ['waybar', 'polybar', 'eww', 'ags']
                }
            },
            {
                name: 'hyprpanel',
                displayName: 'HyprPanel',
                hasSpecialInstall: true,
                description: this.t('HYPRPANEL_DESC') === 'HYPRPANEL_DESC'
                    ? 'AGS-based bar + notifications with JSON config'
                    : this.t('HYPRPANEL_DESC'),
                details: {
                    buildType: 'AUR Package or isolated prefix build',
                    specialFeatures: [
                        'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎвЂќ Uses AGS runtime, optional per-rice isolation',
                        'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎвЂќ Supports adaptive scaling via theme.bar.scaling',
                        'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎвЂќ JSON config in ~/.config/hyprpanel'
                    ],
                    prerequisites: ['gjs', 'gtk3', 'gtk-layer-shell', 'libpulse', 'networkmanager'],
                    technicalSteps: [
                        '1. Install hyprpanel-git (AUR) OR build in isolated prefix',
                        '2. Ensure AGS runtime is available',
                        '3. Configure ~/.config/hyprpanel/config.json'
                    ],
                    pipDeps: [],
                    aurReplaced: [],
                    provides: ['notification_daemon', 'bar'],
                    conflicts: ['swaync', 'mako', 'dunst', 'waybar', 'polybar', 'eww']
                }
            }
        ];
    };

    prototype.buildWidgetsSection = function() {
        const section = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_start: 4
        });
        section.set_size_request(180, -1);

        const titleText = this.t('WIDGET_ALGORITHMS_TITLE');
        const title = new Gtk.Label({
            label: titleText === 'WIDGET_ALGORITHMS_TITLE' ? 'Adaptive Install' : titleText,
            halign: Gtk.Align.START
        });
        title.get_style_context().add_class('title-4');
        section.pack_start(title, false, false, 0);

        const subtitleText = this.t('WIDGET_ALGORITHMS_DESC');
        const subtitleRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6
        });
        const subtitle = new Gtk.Label({
            label: subtitleText === 'WIDGET_ALGORITHMS_DESC' ? 'Installation speedup' : subtitleText,
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        subtitle.get_style_context().add_class('dim-label');
        subtitle.set_hexpand(true);
        subtitleRow.pack_start(subtitle, true, true, 0);

        const preinstallBtn = new Gtk.Button({
            valign: Gtk.Align.CENTER
        });
        const preinstallIcon = new Gtk.Image({
            icon_name: 'list-add-symbolic',
            icon_size: Gtk.IconSize.SMALL_TOOLBAR
        });
        preinstallBtn.set_image(preinstallIcon);
        preinstallBtn.get_style_context().add_class('flat');
        preinstallBtn.set_focus_on_click(false);
        preinstallBtn.set_tooltip_text(this.t('WIDGETS_PREINSTALL_TOOLTIP') === 'WIDGETS_PREINSTALL_TOOLTIP'
            ? 'Preinstall popular components'
            : this.t('WIDGETS_PREINSTALL_TOOLTIP'));
        addPointerCursor(preinstallBtn);
        preinstallBtn.connect('clicked', () => {
            this.showPreinstallComponentsPopup?.();
        });
        subtitleRow.pack_end(preinstallBtn, false, false, 0);

        section.pack_start(subtitleRow, false, false, 4);

        const flowTitleText = this.t('WIDGET_ALGORITHMS_FLOW_TITLE');
        const flowTitle = new Gtk.Label({
            label: flowTitleText === 'WIDGET_ALGORITHMS_FLOW_TITLE' ? 'Flow' : flowTitleText,
            halign: Gtk.Align.START
        });
        flowTitle.get_style_context().add_class('dim-label');
        section.pack_start(flowTitle, false, false, 0);

        const diagram = this.buildAdaptiveInstallDiagram();
        section.pack_start(diagram, false, false, 6);

        const spacer = new Gtk.Box({
            vexpand: true
        });
        section.pack_start(spacer, true, true, 0);

        const banner = this.buildUnificationBanner();
        section.pack_start(banner, false, false, 0);

        return section;
    };

    prototype.buildAdaptiveInstallDiagram = function() {
        const diagram = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            margin_top: 2,
            margin_bottom: 6
        });
        diagram.get_style_context().add_class('adaptive-install-diagram--classic');

        const steps = [
            {
                key: 'WIDGET_ALGORITHMS_FLOW_STEP_P1',
                fallback: 'Phase 1:\nDetect structure',
                dotClass: 'help-dot-blue',
                detailKey: 'WIDGET_ALGORITHMS_FLOW_STEP_P1_DETAIL',
                detailFallback: 'StructureDetector:\n type + variants\n if ALREADY_UNIFIED + valid -> stop'
            },
            {
                key: 'WIDGET_ALGORITHMS_FLOW_STEP_P1_5',
                fallback: 'Phase 1.5:\nDetect wallpaper',
                dotClass: 'help-dot-blue',
                detailKey: 'WIDGET_ALGORITHMS_FLOW_STEP_P1_5_DETAIL',
                detailFallback: 'WallpaperDetector:\n preview/wallpaper by cmd/path\n name/size; respects previewSource',
                action: {
                    iconName: 'preferences-system-symbolic',
                    tooltipKey: 'IMAGE_TOOLS_SETTINGS_TOOLTIP',
                    tooltipFallback: 'Image processing tools settings',
                    onClick: (btn) => this.showImageToolsPopup?.(btn)
                }
            },
            {
                key: 'WIDGET_ALGORITHMS_FLOW_STEP_P2',
                fallback: 'Phase 2:\nTransform structure | Convert WM',
                dotClass: 'help-dot-purple',
                detailKey: 'WIDGET_ALGORITHMS_FLOW_STEP_P2_DETAIL',
                detailFallback: 'StructureTransformer:\n config/, compositor/, start-scripts/\n copy configs/scripts; detect apps\n copy preview/wallpaper\n\nWM Conversion (if enabled):\n Sway Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє Hyprland\n keybinds, rules, settings',
                action: {
                    iconName: 'preferences-system-symbolic',
                    tooltipKey: 'WM_CONVERT_POPUP_TOOLTIP',
                    tooltipFallback: 'WM conversion settings',
                    onClick: (btn) => this.showWMConversionPopup?.(btn)
                }
            },
            {
                key: 'WIDGET_ALGORITHMS_FLOW_STEP_P3',
                fallback: 'Phase 3:\nParse compositor config',
                dotClass: 'help-dot-purple',
                detailKey: 'WIDGET_ALGORITHMS_FLOW_STEP_P3_DETAIL',
                detailFallback: 'Compositor config parser:\n main config + source=\n sanitize monitor/path/plugin/device\n split modules'
            },
            {
                key: 'WIDGET_ALGORITHMS_FLOW_STEP_P3_5',
                fallback: 'Phase 3.5:\nRoot compositor config',
                dotClass: 'help-dot-purple',
                detailKey: 'WIDGET_ALGORITHMS_FLOW_STEP_P3_5_DETAIL',
                detailFallback: 'Copy modular compositor config\n to theme root for apply compatibility'
            },
            {
                key: 'WIDGET_ALGORITHMS_FLOW_STEP_P4',
                fallback: 'Phase 4:\nGenerate scripts',
                dotClass: 'help-dot-purple',
                detailKey: 'WIDGET_ALGORITHMS_FLOW_STEP_P4_DETAIL',
                detailFallback: 'InstallScriptGenerator:\n install_theme_apps.sh + set_after_install_actions.sh\n deps from README/install.sh/configs/execs\n blacklist + widget patches'
            },
            {
                key: 'WIDGET_ALGORITHMS_FLOW_STEP_P5',
                fallback: 'Phase 5:\nNormalize paths',
                dotClass: 'help-dot-green',
                detailKey: 'WIDGET_ALGORITHMS_FLOW_STEP_P5_DETAIL',
                detailFallback: 'PathNormalizer:\n /home/user -> ~ or $HOME by file type\n skip binaries/media'
            },
            {
                key: 'WIDGET_ALGORITHMS_FLOW_STEP_P5_5',
                fallback: 'Phase 5.5:\nAdaptive widget handling + patching',
                dotClass: 'help-dot-green',
                detailKey: 'WIDGET_ALGORITHMS_FLOW_STEP_P5_5_DETAIL',
                detailFallback: 'Adaptive widget handling:\n config adjustments + optional features\n (no app-specific names)',
                action: {
                    iconName: 'preferences-system-symbolic',
                    tooltipKey: 'WIDGETS_POPUP_TOOLTIP',
                    tooltipFallback: 'Show adaptive widgets',
                    onClick: (btn) => this.showSpecialWidgetsPopup?.(btn)
                }
            },
            {
                key: 'WIDGET_ALGORITHMS_FLOW_STEP_P6',
                fallback: 'Phase 6:\nValidate + metadata',
                dotClass: 'help-dot-gray',
                detailKey: 'WIDGET_ALGORITHMS_FLOW_STEP_P6_DETAIL',
                detailFallback: 'Write lastlayer-metadata.json\n ThemeValidator checks structure/configs\n wallpaper/metadata/paths/scripts'
            },
            {
                key: 'WIDGET_ALGORITHMS_FLOW_STEP_P7',
                fallback: 'Phase 7:\nLegacy/Future migration',
                dotClass: 'help-dot-gray',
                detailKey: 'WIDGET_ALGORITHMS_FLOW_STEP_P7_DETAIL',
                detailFallback: 'LegacyMigrationService.migrateConfigBidirectional\n old <-> new; write .legacy-migrations.json\n save explicit metadata'
            }
        ];

        steps.forEach((step, index) => {
            diagram.pack_start(
                this.buildAdaptiveInstallDiagramRow(
                    step.dotClass,
                    step.key,
                    step.fallback,
                    step.detailKey,
                    step.detailFallback,
                    step.action
                ),
                false,
                false,
                0
            );
            if (index < steps.length - 1) {
                diagram.pack_start(this.buildAdaptiveInstallDiagramArrow(), false, false, 0);
            }
        });

        return diagram;
    };

    prototype.buildAdaptiveInstallDiagramRow = function(
        dotClass,
        textKey,
        fallback,
        detailKey = null,
        detailFallback = '',
        action = null
    ) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.START,
            valign: Gtk.Align.START
        });
        row.set_hexpand(true);
        row.set_halign(Gtk.Align.FILL);

        const dot = new Gtk.Label({ label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В Р’В Р В Р РЏ' });
        dot.get_style_context().add_class('help-dot');
        dot.get_style_context().add_class(dotClass);
        row.pack_start(dot, false, false, 0);

        const textBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            halign: Gtk.Align.START,
            valign: Gtk.Align.START,
            hexpand: true
        });

        const rawText = this.t(textKey);
        const label = new Gtk.Label({
            label: rawText === textKey ? fallback : rawText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        textBox.pack_start(label, false, false, 0);

        let detailLabel = null;
        let toggleBtn = null;
        if (detailKey) {
            const rawDetail = this.t(detailKey);
            detailLabel = new Gtk.Label({
                label: rawDetail === detailKey ? detailFallback : rawDetail,
                halign: Gtk.Align.START,
                xalign: 0,
                wrap: true
            });
            detailLabel.get_style_context().add_class('dim-label');
            detailLabel.set_margin_start(12);
            detailLabel.set_no_show_all(true);
            detailLabel.hide();
            textBox.pack_start(detailLabel, false, false, 0);

            toggleBtn = new Gtk.Button({
                label: '+',
                halign: Gtk.Align.START,
                valign: Gtk.Align.START
            });
            toggleBtn.get_style_context().add_class('flat');
            toggleBtn.set_focus_on_click(false);
            toggleBtn.set_size_request(18, 18);
            addPointerCursor(toggleBtn);
            toggleBtn.connect('clicked', () => {
                const isVisible = detailLabel.get_visible();
                if (isVisible) {
                    detailLabel.hide();
                    toggleBtn.set_label('+');
                } else {
                    detailLabel.show();
                    toggleBtn.set_label('-');
                }
            });
        }

        if (toggleBtn) {
            row.pack_start(toggleBtn, false, false, 0);
        }
        row.pack_start(textBox, true, true, 0);

        if (action) {
            const actionBtn = new Gtk.Button({
                valign: Gtk.Align.START
            });
            const actionIcon = new Gtk.Image({
                icon_name: action.iconName || 'preferences-system-symbolic',
                icon_size: Gtk.IconSize.SMALL_TOOLBAR
            });
            actionBtn.set_image(actionIcon);
            actionBtn.get_style_context().add_class('flat');
            actionBtn.set_focus_on_click(false);
            const tooltipKey = action.tooltipKey;
            const tooltipText = tooltipKey ? this.t(tooltipKey) : null;
            const tooltip = tooltipKey
                ? (tooltipText === tooltipKey ? (action.tooltipFallback || '') : tooltipText)
                : action.tooltipFallback;
            tooltip && actionBtn.set_tooltip_text(tooltip);
            addPointerCursor(actionBtn);
            actionBtn.connect('clicked', () => {
                action.onClick?.(actionBtn);
            });
            row.pack_end(actionBtn, false, false, 0);
        }

        return row;
    };

    prototype.buildAdaptiveInstallDiagramArrow = function() {
        const arrow = new Gtk.Label({
            label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІвЂћСћ',
            halign: Gtk.Align.START
        });
        arrow.get_style_context().add_class('dim-label');
        arrow.set_margin_start(6);
        return arrow;
    };

    prototype.buildUnificationBanner = function() {
        const banner = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6
        });
        banner.get_style_context().add_class('unification-banner');
        banner.set_margin_top(6);
        banner.set_margin_bottom(6);

        const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });
        header.set_hexpand(true);

        const titleKey = 'UNIFICATION_BANNER_TITLE';
        const titleText = this.t(titleKey);
        const titleLabel = new Gtk.Label({
            label: titleText === titleKey ? 'Unification snapshot' : titleText,
            halign: Gtk.Align.START,
            xalign: 0
        });
        titleLabel.set_hexpand(true);
        titleLabel.get_style_context().add_class('unification-banner-title');
        header.pack_start(titleLabel, true, true, 0);

        const badgeKey = 'UNIFICATION_BANNER_STATUS';
        const badgeText = this.t(badgeKey);
        const badge = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            halign: Gtk.Align.END,
            valign: Gtk.Align.START
        });
        badge.set_margin_top(2);
        badge.set_margin_end(2);
        badge.get_style_context().add_class('unification-banner-badge');

        const badgeLabel = new Gtk.Label({
            label: badgeText === badgeKey ? 'ACTUAL' : badgeText,
            halign: Gtk.Align.CENTER
        });
        badgeLabel.get_style_context().add_class('unification-banner-badge-label');
        badge.pack_start(badgeLabel, false, false, 0);

        const badgeIcon = new Gtk.Label({
            label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІвЂћСћ',
            halign: Gtk.Align.CENTER
        });
        badgeIcon.get_style_context().add_class('unification-banner-badge-icon');
        badge.pack_start(badgeIcon, false, false, 0);

        header.pack_end(badge, false, false, 0);
        banner.pack_start(header, false, false, 0);

        const grid = new Gtk.Grid({
            column_spacing: 12,
            row_spacing: 4
        });

        const rows = [
            {
                labelKey: 'UNIFICATION_BANNER_VERSION_LABEL',
                labelFallback: 'Algorithm version',
                valueKey: 'UNIFICATION_BANNER_VERSION_VALUE',
                valueFallback: 'v1.0.0'
            },
            {
                labelKey: 'UNIFICATION_BANNER_UPDATED_LABEL',
                labelFallback: 'Last update',
                valueKey: 'UNIFICATION_BANNER_UPDATED_VALUE',
                valueFallback: '2025-03-01'
            },
            {
                labelKey: 'UNIFICATION_BANNER_TESTED_LABEL',
                labelFallback: 'Tested rices',
                valueKey: 'UNIFICATION_BANNER_TESTED_VALUE',
                valueFallback: '7+'
            },
            {
                labelKey: 'UNIFICATION_BANNER_STRUCTURES_LABEL',
                labelFallback: 'Supported structures',
                valueKey: 'UNIFICATION_BANNER_STRUCTURES_VALUE',
                valueFallback: '10'
            }
        ];

        rows.forEach((row, index) => {
            const labelText = this.t(row.labelKey);
            const label = new Gtk.Label({
                label: labelText === row.labelKey ? row.labelFallback : labelText,
                halign: Gtk.Align.START,
                xalign: 0
            });
            label.get_style_context().add_class('unification-banner-label');
            grid.attach(label, 0, index, 1, 1);

            const valueText = this.t(row.valueKey);
            const value = new Gtk.Label({
                label: valueText === row.valueKey ? row.valueFallback : valueText,
                halign: Gtk.Align.END,
                xalign: 1
            });
            value.get_style_context().add_class('unification-banner-value');
            grid.attach(value, 1, index, 1, 1);
        });

        banner.pack_start(grid, false, false, 0);

        return banner;
    };

    prototype.showSpecialWidgetsPopup = function(triggerBtn) {
        if (this.widgetListPopup) {
            this.widgetListPopup.destroy();
            this.widgetListPopup = null;
        }

        const popup = new Gtk.Dialog({
            modal: true,
            decorated: false,
            resizable: false
        });
        popup.set_size_request(540, 360);
        popup.get_style_context().add_class('migration-popup');

        if (this.parentWindow) {
            popup.set_transient_for(this.parentWindow);
        }

        const actionArea = popup.get_action_area?.();
        if (actionArea) {
            actionArea.hide();
            actionArea.set_no_show_all(true);
        }

        const content = popup.get_content_area();
        content.set_spacing(8);
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const titleKey = 'WIDGETS_POPUP_TITLE';
        const titleText = this.t(titleKey);
        const titleLabel = new Gtk.Label({
            label: titleText === titleKey ? 'Adaptive widgets' : titleText,
            halign: Gtk.Align.START
        });
        titleLabel.get_style_context().add_class('title-4');
        header.pack_start(titleLabel, true, true, 0);

        const closeBtn = new Gtk.Button({
            label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚С”',
            relief: Gtk.ReliefStyle.NONE
        });
        closeBtn.set_size_request(24, 24);
        closeBtn.get_style_context().add_class('flat');
        closeBtn.get_style_context().add_class('circular');
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => {
            popup.destroy();
        });
        header.pack_end(closeBtn, false, false, 0);

        content.pack_start(header, false, false, 0);

        const descKey = 'WIDGETS_POPUP_DESC';
        const descText = this.t(descKey);
        const descLabel = new Gtk.Label({
            label: descText === descKey ? 'Widgets with adaptive install/patch logic' : descText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        descLabel.get_style_context().add_class('dim-label');
        content.pack_start(descLabel, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 100,
            max_content_height: 420
        });

        const listBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });
        const widgets = this.getSpecialWidgets();
        for (const widget of widgets) {
            listBox.pack_start(this.buildWidgetRow(widget), false, false, 0);
        }
        scrolled.add(listBox);
        content.pack_start(scrolled, true, true, 0);

        popup.connect('destroy', () => {
            if (this.widgetListPopup === popup) {
                this.widgetListPopup = null;
            }
        });

        popup.show_all();
        this.widgetListPopup = popup;
    };

    prototype.showWMConversionPopup = function(triggerBtn) {
        if (this.wmConversionPopup) {
            this.wmConversionPopup.destroy();
            this.wmConversionPopup = null;
        }

        const popup = new Gtk.Dialog({
            modal: true,
            decorated: false,
            resizable: false
        });
        popup.set_size_request(420, -1);
        popup.get_style_context().add_class('migration-popup');

        if (this.parentWindow) {
            popup.set_transient_for(this.parentWindow);
        }

        const actionArea = popup.get_action_area?.();
        if (actionArea) {
            actionArea.hide();
            actionArea.set_no_show_all(true);
        }

        const content = popup.get_content_area();
        content.set_spacing(8);
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const titleKey = 'WM_CONVERT_POPUP_TITLE';
        const titleText = this.t(titleKey);
        const titleLabel = new Gtk.Label({
            label: titleText === titleKey ? 'WM/DE Conversion' : titleText,
            halign: Gtk.Align.START
        });
        titleLabel.get_style_context().add_class('title-4');
        header.pack_start(titleLabel, true, true, 0);

        const closeBtn = new Gtk.Button({
            label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚С”',
            relief: Gtk.ReliefStyle.NONE
        });
        closeBtn.set_size_request(24, 24);
        closeBtn.get_style_context().add_class('flat');
        closeBtn.get_style_context().add_class('circular');
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => popup.destroy());
        header.pack_end(closeBtn, false, false, 0);

        content.pack_start(header, false, false, 0);

        const descKey = 'WM_CONVERT_POPUP_DESC';
        const descText = this.t(descKey);
        const descLabel = new Gtk.Label({
            label: descText === descKey
                ? 'Automatically convert window manager configs during theme import'
                : descText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        descLabel.get_style_context().add_class('dim-label');
        content.pack_start(descLabel, false, false, 0);

        content.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }), false, false, 4);

        const swayRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.FILL
        });

        const swayIcon = new Gtk.Label();
        swayIcon.set_markup('<span foreground="#22c55e">Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В Р’В Р В Р РЏ</span>');
        swayRow.pack_start(swayIcon, false, false, 0);

        const swayLabelKey = 'WM_CONVERT_SWAY_LABEL';
        const swayLabelText = this.t(swayLabelKey);
        const swayLabel = new Gtk.Label({
            label: swayLabelText === swayLabelKey
                ? 'Sway Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє Hyprland'
                : swayLabelText,
            halign: Gtk.Align.START,
            xalign: 0,
            hexpand: true
        });
        swayRow.pack_start(swayLabel, true, true, 0);

        const swayGearBtn = new Gtk.Button({
            valign: Gtk.Align.CENTER
        });
        const swayGearIcon = new Gtk.Image({
            icon_name: 'emblem-system-symbolic',
            icon_size: Gtk.IconSize.BUTTON
        });
        swayGearBtn.set_image(swayGearIcon);
        swayGearBtn.get_style_context().add_class('flat');
        swayGearBtn.set_tooltip_text('Sway conversion settings & parameter mapping');
        addPointerCursor(swayGearBtn);
        swayGearBtn.connect('clicked', () => {
            this.showSwayConversionSettingsPopup?.(swayGearBtn);
        });
        swayRow.pack_start(swayGearBtn, false, false, 0);

        const swaySwitch = new Gtk.Switch({
            active: this.settings?.swayToHyprlandConvert !== false,
            valign: Gtk.Align.CENTER
        });
        addPointerCursor(swaySwitch);
        swaySwitch.connect('notify::active', () => {
            const enabled = swaySwitch.get_active();
            if (this.settingsManager?.set) {
                this.settingsManager.set('swayToHyprlandConvert', enabled);
                this.settingsManager.write?.(null, { silent: true });
            }
            if (this.settings) {
                this.settings.swayToHyprlandConvert = enabled;
            }
        });
        swayRow.pack_end(swaySwitch, false, false, 0);

        content.pack_start(swayRow, false, false, 0);

        const swayDetailsKey = 'WM_CONVERT_SWAY_DETAILS';
        const swayDetailsText = this.t(swayDetailsKey);
        const swayDetails = new Gtk.Label({
            label: swayDetailsText === swayDetailsKey
                ? 'Converts keybindings, window rules, gaps, borders,\ninput/output settings to Hyprland format'
                : swayDetailsText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        swayDetails.get_style_context().add_class('dim-label');
        swayDetails.set_margin_start(20);
        content.pack_start(swayDetails, false, false, 0);

        content.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }), false, false, 8);

        const futureKey = 'WM_CONVERT_FUTURE';
        const futureText = this.t(futureKey);
        const futureLabel = new Gtk.Label({
            label: futureText === futureKey
                ? 'Planned: awesome, bspwm, dwm Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє Hyprland'
                : futureText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        futureLabel.get_style_context().add_class('dim-label');
        content.pack_start(futureLabel, false, false, 0);

        popup.connect('destroy', () => {
            if (this.wmConversionPopup === popup) {
                this.wmConversionPopup = null;
            }
        });

        popup.show_all();
        this.wmConversionPopup = popup;
    };

    prototype.showSwayConversionSettingsPopup = function(triggerBtn) {
        if (this.swayConversionSettingsPopup) {
            this.swayConversionSettingsPopup.destroy();
            this.swayConversionSettingsPopup = null;
        }

        const popup = new Gtk.Dialog({
            modal: true,
            decorated: false,
            resizable: true
        });
        popup.set_size_request(600, 550);
        popup.set_default_size(600, 550);
        popup.get_style_context().add_class('migration-popup');

        const transientParent = this.wmConversionPopup || this.parentWindow;
        transientParent && popup.set_transient_for(transientParent);

        const actionArea = popup.get_action_area?.();
        if (actionArea) {
            actionArea.hide();
            actionArea.set_no_show_all(true);
        }

        const content = popup.get_content_area();
        content.set_spacing(8);
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const titleLabel = new Gtk.Label({
            label: 'Sway Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє Hyprland Conversion Settings',
            halign: Gtk.Align.START
        });
        titleLabel.get_style_context().add_class('title-4');
        header.pack_start(titleLabel, true, true, 0);

        const closeBtn = new Gtk.Button({
            label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚С”',
            relief: Gtk.ReliefStyle.NONE
        });
        closeBtn.set_size_request(24, 24);
        closeBtn.get_style_context().add_class('flat');
        closeBtn.get_style_context().add_class('circular');
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => popup.destroy());
        header.pack_end(closeBtn, false, false, 0);

        content.pack_start(header, false, false, 0);

        const fixesFrame = new Gtk.Frame({ label: 'Waybar Fixes' });
        const fixesBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const currentFixFonts = this.settingsManager?.get?.('swayConvertFixFonts') ?? this.settings?.swayConvertFixFonts;
        const fixFontsCheck = new Gtk.CheckButton({
            label: 'Fix waybar font fallbacks'
        });
        fixFontsCheck.set_tooltip_text('Add fallback fonts (e.g. iosevka Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє Iosevka Nerd Font)');
        fixFontsCheck.set_active(currentFixFonts !== false);
        fixFontsCheck.connect('toggled', () => {
            const enabled = fixFontsCheck.get_active();
            if (this.settingsManager?.set) {
                this.settingsManager.set('swayConvertFixFonts', enabled);
                this.settingsManager.write?.(null, { silent: true, force: true });
            }
            if (this.settings) {
                this.settings.swayConvertFixFonts = enabled;
            }
        });
        fixesBox.pack_start(fixFontsCheck, false, false, 0);

        const currentFixActive = this.settingsManager?.get?.('swayConvertFixActive') ?? this.settings?.swayConvertFixActive;
        const fixActiveCheck = new Gtk.CheckButton({
            label: 'Fix waybar active workspace selector'
        });
        fixActiveCheck.set_tooltip_text('Add button.active selector for Hyprland (Sway uses button.focused)');
        fixActiveCheck.set_active(currentFixActive !== false);
        fixActiveCheck.connect('toggled', () => {
            const enabled = fixActiveCheck.get_active();
            if (this.settingsManager?.set) {
                this.settingsManager.set('swayConvertFixActive', enabled);
                this.settingsManager.write?.(null, { silent: true, force: true });
            }
            if (this.settings) {
                this.settings.swayConvertFixActive = enabled;
            }
        });
        fixesBox.pack_start(fixActiveCheck, false, false, 0);

        fixesFrame.add(fixesBox);
        content.pack_start(fixesFrame, false, false, 0);

        const mappingFrame = new Gtk.Frame({ label: 'Parameter Mapping (Sway Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє Hyprland)' });

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 200,
            max_content_height: 350
        });

        const mappingBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const categories = [
            {
                name: 'General Settings',
                mappings: [
                    { sway: 'workspace_layout', hyprland: 'general:layout', note: 'default Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє dwindle' },
                    { sway: 'xwayland', hyprland: 'xwayland:enabled', note: null },
                ]
            },
            {
                name: 'Gaps & Borders',
                mappings: [
                    { sway: 'gaps inner', hyprland: 'general:gaps_in', note: null },
                    { sway: 'gaps outer', hyprland: 'general:gaps_out', note: null },
                    { sway: 'default_border', hyprland: 'general:border_size', note: 'extracts pixel value' },
                ]
            },
            {
                name: 'Colors',
                mappings: [
                    { sway: 'client.focused', hyprland: 'general:col.active_border', note: 'extracts child_border' },
                    { sway: 'client.unfocused', hyprland: 'general:col.inactive_border', note: null },
                ]
            },
            {
                name: 'Focus & Mouse',
                mappings: [
                    { sway: 'focus_follows_mouse', hyprland: 'input:follow_mouse', note: 'yesР В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє1, noР В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє0, alwaysР В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє2' },
                    { sway: 'focus_on_window_activation', hyprland: 'misc:focus_on_activate', note: null },
                ]
            },
            {
                name: 'Input Devices',
                mappings: [
                    { sway: 'xkb_layout', hyprland: 'input:kb_layout', note: null },
                    { sway: 'xkb_options', hyprland: 'input:kb_options', note: null },
                    { sway: 'repeat_delay', hyprland: 'input:repeat_delay', note: null },
                    { sway: 'repeat_rate', hyprland: 'input:repeat_rate', note: null },
                    { sway: 'accel_profile', hyprland: 'input:accel_profile', note: null },
                    { sway: 'natural_scroll', hyprland: 'input:natural_scroll', note: null },
                    { sway: 'tap', hyprland: 'input:touchpad:tap-to-click', note: null },
                ]
            },
            {
                name: 'Keybindings',
                mappings: [
                    { sway: 'bindsym $mod+Return exec $term', hyprland: 'bind = $mod, Return, exec, $term', note: null },
                    { sway: 'bindsym $mod+q kill', hyprland: 'bind = $mod, Q, killactive', note: null },
                    { sway: 'bindsym $mod+Shift+e exit', hyprland: 'bind = $mod SHIFT, E, exit', note: null },
                    { sway: 'bindsym $mod+f fullscreen', hyprland: 'bind = $mod, F, fullscreen', note: null },
                ]
            },
            {
                name: 'Window Rules',
                mappings: [
                    { sway: 'for_window [app_id="X"]', hyprland: 'windowrulev2 = ..., class:^(X)$', note: null },
                    { sway: 'for_window [title="X"]', hyprland: 'windowrulev2 = ..., title:^(X)$', note: null },
                    { sway: 'floating enable', hyprland: 'float', note: null },
                    { sway: 'focus', hyprland: 'focus', note: null },
                ]
            },
        ];

        for (const category of categories) {
            const categoryRow = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6
            });

            const expanderBtn = new Gtk.Button({ label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎв„ўР В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В¶' });
            expanderBtn.get_style_context().add_class('flat');
            expanderBtn.set_size_request(20, 20);
            addPointerCursor(expanderBtn);

            const categoryLabel = new Gtk.Label({
                halign: Gtk.Align.START
            });
            categoryLabel.set_markup(`<b>${GLib.markup_escape_text(category.name, -1)}</b>`);

            categoryRow.pack_start(expanderBtn, false, false, 0);
            categoryRow.pack_start(categoryLabel, false, false, 0);
            mappingBox.pack_start(categoryRow, false, false, 2);

            const detailsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 2,
                margin_start: 24
            });
            detailsBox.set_no_show_all(true);
            detailsBox.hide();

            for (const mapping of category.mappings) {
                const row = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 8
                });

                const swayLabel = new Gtk.Label({
                    label: mapping.sway,
                    halign: Gtk.Align.START,
                    xalign: 0
                });
                swayLabel.set_size_request(180, -1);
                swayLabel.get_style_context().add_class('monospace');

                const arrowLabel = new Gtk.Label({ label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂє' });
                arrowLabel.get_style_context().add_class('dim-label');

                const hyprlandLabel = new Gtk.Label({
                    label: mapping.hyprland || '(no equivalent)',
                    halign: Gtk.Align.START,
                    xalign: 0
                });
                hyprlandLabel.get_style_context().add_class('monospace');
                if (!mapping.hyprland) {
                    hyprlandLabel.get_style_context().add_class('dim-label');
                }

                row.pack_start(swayLabel, false, false, 0);
                row.pack_start(arrowLabel, false, false, 0);
                row.pack_start(hyprlandLabel, true, true, 0);

                if (mapping.note) {
                    const noteLabel = new Gtk.Label({
                        label: `(${mapping.note})`,
                        halign: Gtk.Align.END
                    });
                    noteLabel.get_style_context().add_class('dim-label');
                    row.pack_end(noteLabel, false, false, 0);
                }

                detailsBox.pack_start(row, false, false, 0);
            }

            mappingBox.pack_start(detailsBox, false, false, 0);

            expanderBtn.connect('clicked', () => {
                const isVisible = detailsBox.get_visible();
                if (isVisible) {
                    detailsBox.set_no_show_all(true);
                    detailsBox.hide();
                    expanderBtn.set_label('Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎв„ўР В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В¶');
                } else {
                    detailsBox.set_no_show_all(false);
                    detailsBox.show_all();
                    expanderBtn.set_label('Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎв„ўР В Р’В Р В Р вЂ№Р В РІР‚в„ўР вЂ™Р’В');
                }
            });
        }

        scrolled.add(mappingBox);
        mappingFrame.add(scrolled);
        content.pack_start(mappingFrame, true, true, 0);

        const noteLabel = new Gtk.Label({
            label: 'Full mapping in: src/infrastructure/converters/mappings/SwayHyprlandMapping.js',
            halign: Gtk.Align.START,
            wrap: true
        });
        noteLabel.get_style_context().add_class('dim-label');
        content.pack_start(noteLabel, false, false, 4);

        popup.connect('destroy', () => {
            if (this.swayConversionSettingsPopup === popup) {
                this.swayConversionSettingsPopup = null;
            }
        });

        popup.show_all();
        this.swayConversionSettingsPopup = popup;
    };

    prototype.isToolInstalled = function(command) {
        const result = tryOrNull(
            `OverrideTabWidgets.isToolInstalled:${command}`,
            () => GLib.spawn_command_line_sync(`which ${command}`)
        );
        return result?.[3] === 0 && Boolean(result?.[1]?.length);
    };

    prototype.getImageToolButtonLabel = function(key, fallback) {
        const text = this.t(key);
        return text === key ? fallback : text;
    };

    prototype.resetImageToolInstallButton = function(installBtn, key = 'IMAGE_TOOLS_INSTALL', fallback = 'Install') {
        installBtn.set_label(this.getImageToolButtonLabel(key, fallback));
        installBtn.set_sensitive(true);
    };

    prototype.updateInstalledImageToolState = function(tool, statusIcon, statusLabel, installBtn, terminalBuffer) {
        statusIcon.set_markup('<span foreground="#22c55e">Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В Р вЂ№Р В Р вЂ Р Р†Р вЂљРЎвЂєР РЋРЎвЂєР В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†РІР‚С›РЎС›</span>');
        statusLabel.set_label(this.getImageToolButtonLabel('IMAGE_TOOLS_INSTALLED', 'Installed'));
        statusLabel.get_style_context().remove_class('status-disabled');
        statusLabel.get_style_context().add_class('status-enabled');
        installBtn.set_label(this.getImageToolButtonLabel('IMAGE_TOOLS_REINSTALL', 'Reinstall'));
        installBtn.get_style_context().remove_class('suggested-action');

        if (tool.id === 'gowall' && ensureGowallConfig()) {
            terminalBuffer.insert(
                terminalBuffer.get_end_iter(),
                '\n[LastLayer] Created gowall config with image preview disabled\n',
                -1
            );
        }
    };

    prototype.detectPackageManager = function() {
        const managers = [
            { cmd: 'pacman', install: 'sudo pacman -S --noconfirm' },
            { cmd: 'yay', install: 'yay -S --noconfirm' },
            { cmd: 'paru', install: 'paru -S --noconfirm' },
            { cmd: 'apt', install: 'sudo apt install -y' },
            { cmd: 'dnf', install: 'sudo dnf install -y' },
            { cmd: 'zypper', install: 'sudo zypper install -y' }
        ];

        for (const manager of managers) {
            if (this.isToolInstalled(manager.cmd)) {
                return manager;
            }
        }
        return null;
    };

    prototype.showImageToolsPopup = function(triggerBtn) {
        if (this.imageToolsPopup) {
            this.imageToolsPopup.destroy();
            this.imageToolsPopup = null;
        }

        const popup = new Gtk.Dialog({
            modal: true,
            decorated: false,
            resizable: true
        });
        popup.set_size_request(500, 550);
        popup.set_default_size(500, 550);
        popup.get_style_context().add_class('migration-popup');

        if (this.parentWindow) {
            popup.set_transient_for(this.parentWindow);
        }

        const actionArea = popup.get_action_area?.();
        if (actionArea) {
            actionArea.hide();
            actionArea.set_no_show_all(true);
        }

        const content = popup.get_content_area();
        content.set_spacing(8);
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const titleKey = 'IMAGE_TOOLS_DIALOG_TITLE';
        const titleText = this.t(titleKey);
        const titleLabel = new Gtk.Label({
            label: titleText === titleKey ? 'Image Processing Tools' : titleText,
            halign: Gtk.Align.START
        });
        titleLabel.get_style_context().add_class('title-4');
        header.pack_start(titleLabel, true, true, 0);

        const closeBtn = new Gtk.Button({
            label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚С”',
            relief: Gtk.ReliefStyle.NONE
        });
        closeBtn.set_size_request(24, 24);
        closeBtn.get_style_context().add_class('flat');
        closeBtn.get_style_context().add_class('circular');
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => popup.destroy());
        header.pack_end(closeBtn, false, false, 0);

        content.pack_start(header, false, false, 0);

        const descKey = 'IMAGE_TOOLS_DIALOG_DESC';
        const descText = this.t(descKey);
        const descLabel = new Gtk.Label({
            label: descText === descKey
                ? 'These tools are used to execute wallpaper transformation instructions from rice authors.'
                : descText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        descLabel.get_style_context().add_class('dim-label');
        content.pack_start(descLabel, false, false, 0);

        content.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }), false, false, 4);

        const executeRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.FILL
        });

        const executeIcon = new Gtk.Label();
        executeIcon.set_markup('<span foreground="#22c55e">Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В Р’В Р В Р РЏ</span>');
        executeRow.pack_start(executeIcon, false, false, 0);

        const executeLabelKey = 'IMAGE_TOOLS_EXECUTE_INSTRUCTIONS';
        const executeLabelText = this.t(executeLabelKey);
        const executeLabel = new Gtk.Label({
            label: executeLabelText === executeLabelKey
                ? "Execute author's image transformation instructions"
                : executeLabelText,
            halign: Gtk.Align.START,
            xalign: 0,
            hexpand: true
        });
        executeRow.pack_start(executeLabel, true, true, 0);

        const executeSwitch = new Gtk.Switch({
            active: this.settings?.executeImageInstructions !== false,
            valign: Gtk.Align.CENTER
        });
        executeSwitch.connect('notify::active', () => {
            const enabled = executeSwitch.get_active();
            if (this.settingsManager?.set) {
                this.settingsManager.set('executeImageInstructions', enabled);
                this.settingsManager.write?.(null, { silent: true });
            }
            if (this.settings) {
                this.settings.executeImageInstructions = enabled;
            }
        });
        executeRow.pack_end(executeSwitch, false, false, 0);

        content.pack_start(executeRow, false, false, 0);

        const executeNoteKey = 'IMAGE_TOOLS_EXECUTE_NOTE';
        const executeNoteText = this.t(executeNoteKey);
        const executeNote = new Gtk.Label({
            label: executeNoteText === executeNoteKey
                ? 'When enabled, runs ImageMagick/convert commands found in Reddit post comments to transform wallpapers.'
                : executeNoteText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        executeNote.get_style_context().add_class('dim-label');
        executeNote.set_margin_start(20);
        content.pack_start(executeNote, false, false, 0);

        const autoTagsRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.FILL
        });

        const autoTagsIcon = new Gtk.Label();
        autoTagsIcon.set_markup('<span foreground="#22c55e">Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В Р’В Р В Р РЏ</span>');
        autoTagsRow.pack_start(autoTagsIcon, false, false, 0);

        const autoTagsLabelKey = 'IMAGE_TOOLS_AUTO_TAGS_LABEL';
        const autoTagsLabelText = this.t(autoTagsLabelKey);
        const autoTagsLabel = new Gtk.Label({
            label: autoTagsLabelText === autoTagsLabelKey ? 'Auto-generate tags when missing' : autoTagsLabelText,
            halign: Gtk.Align.START,
            xalign: 0,
            hexpand: true
        });
        autoTagsRow.pack_start(autoTagsLabel, true, true, 0);

        const autoTagsSwitch = new Gtk.Switch({
            active: this.settings?.autoGenerateTagsOnImport === true,
            valign: Gtk.Align.CENTER
        });
        autoTagsRow.pack_end(autoTagsSwitch, false, false, 0);
        content.pack_start(autoTagsRow, false, false, 0);

        const autoTagsNoteKey = 'IMAGE_TOOLS_AUTO_TAGS_NOTE';
        const autoTagsNoteText = this.t(autoTagsNoteKey);
        const autoTagsNote = new Gtk.Label({
            label: autoTagsNoteText === autoTagsNoteKey
                ? 'When enabled, during theme import llayer-plus sends the wallpaper/preview to the selected AI provider to generate exactly 3 tags and saves them into theme metadata (runs in background).'
                : autoTagsNoteText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        autoTagsNote.get_style_context().add_class('dim-label');
        autoTagsNote.set_margin_start(20);
        content.pack_start(autoTagsNote, false, false, 0);

        const providerContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            halign: Gtk.Align.FILL
        });
        providerContainer.set_margin_start(20);
        providerContainer.set_visible(false);

        const providerTitleRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.FILL
        });

        const providerLabelKey = 'IMAGE_TOOLS_AUTO_TAGS_PROVIDER_LABEL';
        const providerLabelText = this.t(providerLabelKey);
        const providerTitle = new Gtk.Label({
            label: providerLabelText === providerLabelKey ? 'AI Provider' : providerLabelText,
            halign: Gtk.Align.START,
            xalign: 0
        });
        providerTitle.get_style_context().add_class('dim-label');
        providerTitleRow.pack_start(providerTitle, false, false, 0);

        const providerDescKey = 'IMAGE_TOOLS_AUTO_TAGS_PROVIDER_DESC';
        const providerDescText = this.t(providerDescKey);
        const providerDesc = new Gtk.Label({
            label: providerDescText === providerDescKey ? 'Select AI provider for tag generation on import' : providerDescText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true,
            hexpand: true
        });
        providerDesc.get_style_context().add_class('dim-label');
        providerDesc.set_margin_start(8);
        providerTitleRow.pack_start(providerDesc, true, true, 0);
        providerContainer.pack_start(providerTitleRow, false, false, 0);

        const providerCombo = new Gtk.ComboBoxText({ hexpand: true });
        providerCombo.set_margin_top(2);

        const settingsService = new SettingsService({ settingsManager: this.settingsManager });
        const aiProviderService = new AIProviderService(settingsService, this.logger || null);
        const providers = aiProviderService.getProviders() || [];

        const useActiveKey = 'IMAGE_TOOLS_AUTO_TAGS_PROVIDER_ACTIVE';
        const useActiveText = this.t(useActiveKey);
        providerCombo.append('', useActiveText === useActiveKey ? 'Use active provider' : useActiveText);

        for (const provider of providers) {
            if (!provider?.id) continue;
            providerCombo.append(provider.id, provider.name || provider.id);
        }

        const savedProviderId = this.settingsManager?.get?.('autoGenerateTagsProviderId') || null;
        const defaultProviderId = savedProviderId
            ?? aiProviderService.getActiveProviderId?.()
            ?? (providers[0]?.id || '');
        providerCombo.set_active_id(defaultProviderId || '');

        const noProvidersKey = 'IMAGE_TOOLS_AUTO_TAGS_NO_PROVIDERS';
        const noProvidersText = this.t(noProvidersKey);
        const noProvidersLabel = new Gtk.Label({
            label: noProvidersText === noProvidersKey ? 'No AI providers configured (configure in AI Providers section)' : noProvidersText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        noProvidersLabel.get_style_context().add_class('dim-label');
        noProvidersLabel.set_margin_top(2);

        const hasProviders = providers.length > 0;
        providerCombo.set_sensitive(hasProviders);
        if (!hasProviders) {
            providerContainer.pack_start(noProvidersLabel, false, false, 0);
        }

        providerCombo.connect('changed', () => {
            const activeId = providerCombo.get_active_id?.() || '';
            const value = activeId && activeId.trim().length ? activeId : null;
            this.settingsManager?.set?.('autoGenerateTagsProviderId', value);
            this.settingsManager?.write?.(null, { silent: true, force: true });
            if (this.settings) {
                this.settings.autoGenerateTagsProviderId = value;
            }
        });

        providerContainer.pack_start(providerCombo, false, false, 0);
        content.pack_start(providerContainer, false, false, 0);

        const updateProviderVisibility = () => {
            const enabled = autoTagsSwitch.get_active();
            if (enabled) {
                providerContainer.set_visible(true);
                providerContainer.show_all();
            } else {
                providerContainer.hide();
                providerContainer.set_visible(false);
            }
        };
        updateProviderVisibility();

        autoTagsSwitch.connect('notify::active', () => {
            const enabled = autoTagsSwitch.get_active();
            this.settingsManager?.set?.('autoGenerateTagsOnImport', enabled);
            this.settingsManager?.write?.(null, { silent: true, force: true });
            if (this.settings) {
                this.settings.autoGenerateTagsOnImport = enabled;
            }
            updateProviderVisibility();
        });

        popup.connect('destroy', () => {
            tryRun('OverrideTabWidgets.imageToolsPopup.destroy', () => {
                this.settingsManager?.write?.(null, { silent: true, force: true });
            });
        });

        content.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }), false, false, 8);

        const toolsListKey = 'IMAGE_TOOLS_LIST_LABEL';
        const toolsListText = this.t(toolsListKey);
        const toolsListLabel = new Gtk.Label({
            label: toolsListText === toolsListKey ? 'Available Tools' : toolsListText,
            halign: Gtk.Align.START
        });
        toolsListLabel.get_style_context().add_class('dim-label');
        content.pack_start(toolsListLabel, false, false, 0);

        const terminalFrame = new Gtk.Frame({
            label: this.t('IMAGE_TOOLS_TERMINAL_LABEL') === 'IMAGE_TOOLS_TERMINAL_LABEL'
                ? 'Installation Output'
                : this.t('IMAGE_TOOLS_TERMINAL_LABEL')
        });
        terminalFrame.set_no_show_all(true);
        terminalFrame.set_visible(false);
        terminalFrame.set_vexpand(true);

        const terminalText = new Gtk.TextView();
        terminalText.set_editable(false);
        terminalText.set_cursor_visible(false);
        terminalText.set_wrap_mode(Gtk.WrapMode.WORD_CHAR);
        terminalText.set_left_margin(10);
        terminalText.set_right_margin(10);
        terminalText.set_top_margin(10);
        terminalText.set_bottom_margin(10);
        terminalText.get_style_context().add_class('terminal-text');

        const terminalScroll = new Gtk.ScrolledWindow();
        terminalScroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
        terminalScroll.set_min_content_height(200);
        terminalScroll.set_size_request(-1, 200);
        terminalScroll.get_style_context().add_class('terminal-output');
        terminalScroll.add(terminalText);

        const terminalBuffer = terminalText.get_buffer();

        const collapseBtn = new Gtk.Button({
            label: `Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎв„ўР В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р вЂ™Р’В  ${this.t('HIDE') === 'HIDE' ? 'Hide' : this.t('HIDE')}`
        });
        collapseBtn.get_style_context().add_class('terminal-collapse-btn');
        addPointerCursor(collapseBtn);
        collapseBtn.connect('clicked', () => {
            terminalFrame.set_visible(false);
        });

        const terminalBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 0});
        terminalBox.pack_start(terminalScroll, true, true, 0);
        terminalBox.pack_start(collapseBtn, false, false, 0);

        terminalFrame.add(terminalBox);

        this._imageToolsPopupData = { terminalFrame, terminalBuffer, terminalScroll, terminalBox, collapseBtn };

        for (const tool of IMAGE_TOOLS) {
            const toolRow = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                margin_top: 4,
                margin_bottom: 4
            });

            const isInstalled = this.isToolInstalled(tool.commands[0]);

            const statusIcon = new Gtk.Label();
            statusIcon.set_markup(isInstalled
                ? '<span foreground="#22c55e">Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІвЂћСћ</span>'
                : '<span foreground="#ef4444">Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎС™</span>');
            toolRow.pack_start(statusIcon, false, false, 0);

            const nameBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
            nameBox.set_hexpand(true);

            const nameLabel = new Gtk.Label({
                label: tool.name,
                halign: Gtk.Align.START
            });
            nameBox.pack_start(nameLabel, false, false, 0);

            const commandsKey = 'IMAGE_TOOLS_COMMANDS';
            const commandsText = this.t(commandsKey);
            const commandsLabel = new Gtk.Label({
                label: `${commandsText === commandsKey ? 'Commands' : commandsText}: ${tool.commands.join(', ')}`,
                halign: Gtk.Align.START
            });
            commandsLabel.get_style_context().add_class('dim-label');
            nameBox.pack_start(commandsLabel, false, false, 0);

            toolRow.pack_start(nameBox, true, true, 0);

            const installedKey = 'IMAGE_TOOLS_INSTALLED';
            const notInstalledKey = 'IMAGE_TOOLS_NOT_INSTALLED';
            const statusLabel = new Gtk.Label({
                label: isInstalled
                    ? (this.t(installedKey) === installedKey ? 'Installed' : this.t(installedKey))
                    : (this.t(notInstalledKey) === notInstalledKey ? 'Not installed' : this.t(notInstalledKey))
            });
            statusLabel.get_style_context().add_class(isInstalled ? 'status-enabled' : 'status-disabled');
            toolRow.pack_start(statusLabel, false, false, 0);

            const installKey = 'IMAGE_TOOLS_INSTALL';
            const reinstallKey = 'IMAGE_TOOLS_REINSTALL';
            const installBtn = new Gtk.Button({
                label: isInstalled
                    ? (this.t(reinstallKey) === reinstallKey ? 'Reinstall' : this.t(reinstallKey))
                    : (this.t(installKey) === installKey ? 'Install' : this.t(installKey))
            });
            if (!isInstalled) {
                installBtn.get_style_context().add_class('suggested-action');
            }
            addPointerCursor(installBtn);
            installBtn.connect('clicked', () => {
                this.installImageTool(tool, statusIcon, statusLabel, installBtn);
            });
            toolRow.pack_start(installBtn, false, false, 0);

            content.pack_start(toolRow, false, false, 0);
        }

        content.pack_start(terminalFrame, true, true, 8);

        popup.connect('destroy', () => {
            if (this.imageToolsPopup === popup) {
                this.imageToolsPopup = null;
                this._imageToolsPopupData = null;
            }
        });

        popup.show_all();
        terminalFrame.set_visible(false);
        this.imageToolsPopup = popup;
    };

    prototype.installImageTool = function(tool, statusIcon, statusLabel, installBtn) {
        const packageManager = this.detectPackageManager();
        if (!packageManager) {
            const noManagerKey = 'IMAGE_TOOLS_NO_PACKAGE_MANAGER';
            const noManagerText = this.t(noManagerKey);
            if (this.notify) {
                this.notify(noManagerText === noManagerKey
                    ? 'No supported package manager found'
                    : noManagerText);
            }
            return;
        }

        if (!this._imageToolsPopupData) return;

        const { terminalFrame, terminalBuffer, terminalScroll, terminalBox, collapseBtn } = this._imageToolsPopupData;

        terminalFrame.set_visible(true);
        terminalFrame.show();
        terminalBox.show();
        terminalScroll.show_all();
        collapseBtn.show();

        const packageName = tool.package;
        const aurHelper = this.isToolInstalled('yay')
            ? 'yay -S --noconfirm'
            : (this.isToolInstalled('paru') ? 'paru -S --noconfirm' : null);
        const installCmd = tool.aur && packageManager.cmd === 'pacman'
            ? (aurHelper ? `${aurHelper} ${packageName}` : '')
            : `${packageManager.install} ${packageName}`;

        if (!installCmd) {
            terminalBuffer.set_text(
                'This package requires an AUR helper (yay or paru).\nInstall one first: https://aur.archlinux.org/packages/yay\n',
                -1
            );
            this.resetImageToolInstallButton(installBtn);
            return;
        }

        installBtn.set_sensitive(false);
        installBtn.set_label('...');
        terminalBuffer.set_text(`$ ${installCmd}\n\n`, -1);

        const proc = tryOrNull('OverrideTabWidgets.installImageTool.createProcess', () => Gio.Subprocess.new(
            ['bash', '-c', installCmd],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE
        ));
        if (!proc) {
            terminalBuffer.insert(terminalBuffer.get_end_iter(), '[Error: failed to start installer]\n', -1);
            this.resetImageToolInstallButton(installBtn);
            return;
        }

        proc.communicate_utf8_async(null, null, (p, res) => {
            const output = tryOrNull(
                'OverrideTabWidgets.installImageTool.finish',
                () => p.communicate_utf8_finish(res)
            );
            if (!output) {
                terminalBuffer.insert(terminalBuffer.get_end_iter(), '\n[Error: failed to read installer output]\n', -1);
                this.resetImageToolInstallButton(installBtn);
                return;
            }

            const [, stdout] = output;
            const clean = (stdout || '').replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\[2K/g, '');
            terminalBuffer.insert(terminalBuffer.get_end_iter(), clean, -1);

            const success = p.get_successful();
            const code = p.get_exit_status();
            terminalBuffer.insert(terminalBuffer.get_end_iter(), `\n[${success ? 'OK' : 'Error'}, code ${code}]\n`, -1);

            const adj = terminalScroll.get_vadjustment();
            adj.set_value(adj.get_upper());

            if (this.isToolInstalled(tool.commands[0])) {
                this.updateInstalledImageToolState(tool, statusIcon, statusLabel, installBtn, terminalBuffer);
                installBtn.set_sensitive(true);
                return;
            }

            this.resetImageToolInstallButton(installBtn);
        });
    };
    prototype.showPreinstallComponentsPopup = function() {
        if (this.preinstallPopup) {
            this.preinstallPopup.destroy();
            this.preinstallPopup = null;
        }

        const popup = new Gtk.Dialog({
            modal: true,
            decorated: false,
            resizable: false
        });
        popup.set_size_request(550, -1);
        popup.get_style_context().add_class('migration-popup');

        if (this.parentWindow) {
            popup.set_transient_for(this.parentWindow);
        }

        const actionArea = popup.get_action_area?.();
        if (actionArea) {
            actionArea.hide();
            actionArea.set_no_show_all(true);
        }

        const content = popup.get_content_area();
        content.set_spacing(8);
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const titleKey = 'WIDGETS_PREINSTALL_TITLE';
        const titleText = this.t(titleKey);
        const titleLabel = new Gtk.Label({
            label: titleText === titleKey ? 'Preinstall Components' : titleText,
            halign: Gtk.Align.START
        });
        titleLabel.get_style_context().add_class('title-4');
        header.pack_start(titleLabel, true, true, 0);

        const closeBtn = new Gtk.Button({
            label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚С”',
            relief: Gtk.ReliefStyle.NONE
        });
        closeBtn.get_style_context().add_class('flat');
        closeBtn.get_style_context().add_class('circular');
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => popup.destroy());
        header.pack_end(closeBtn, false, false, 0);

        content.pack_start(header, false, false, 0);

        const descLabel = new Gtk.Label({
            label: 'Pre-install heavy components to speed up theme installation.',
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        descLabel.get_style_context().add_class('dim-label');
        content.pack_start(descLabel, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 150,
            max_content_height: 400
        });

        const listBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12
        });

        for (const [setId, setData] of Object.entries(PREINSTALL_COMPONENT_SETS)) {
            const setBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 6
            });

            const setHeader = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8
            });
            const setTitle = new Gtk.Label({
                label: setData.name,
                halign: Gtk.Align.START
            });
            setTitle.get_style_context().add_class('title-5');
            setHeader.pack_start(setTitle, false, false, 0);

            const setDesc = new Gtk.Label({
                label: `Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРЎв„ў ${setData.description}`,
                halign: Gtk.Align.START
            });
            setDesc.get_style_context().add_class('dim-label');
            setHeader.pack_start(setDesc, false, false, 0);

            const installAllBtn = new Gtk.Button({
                label: 'Install All'
            });
            installAllBtn.get_style_context().add_class('suggested-action');
            addPointerCursor(installAllBtn);
            installAllBtn.connect('clicked', () => {
                this.runPreinstallAll(setId, setData.components, popup);
            });
            setHeader.pack_end(installAllBtn, false, false, 0);

            setBox.pack_start(setHeader, false, false, 0);

            const componentsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
                margin_start: 12
            });

            for (const comp of setData.components) {
                const compRow = this.buildPreinstallComponentRow(comp, popup);
                componentsBox.pack_start(compRow, false, false, 0);
            }

            setBox.pack_start(componentsBox, false, false, 0);
            listBox.pack_start(setBox, false, false, 0);
        }

        scrolled.add(listBox);
        content.pack_start(scrolled, true, true, 0);

        this.checkPreinstallStatus(listBox);

        popup.connect('destroy', () => {
            if (this.preinstallPopup === popup) {
                this.preinstallPopup = null;
            }
        });

        popup.show_all();
        this.preinstallPopup = popup;
    };

    prototype.buildPreinstallComponentRow = function(comp, popup) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const statusLabel = new Gtk.Label({
            label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР Р†Р вЂљРІР‚Сљ'
        });
        statusLabel.set_markup('<span foreground="#666">Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р Р†Р вЂљРЎвЂєР Р†Р вЂљРІР‚Сљ</span>');
        statusLabel.set_tooltip_text('Checking...');
        statusLabel._componentId = comp.id;
        row.pack_start(statusLabel, false, false, 0);

        const infoBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });
        infoBox.set_hexpand(true);

        const nameRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6
        });
        const nameLabel = new Gtk.Label({
            label: comp.name,
            halign: Gtk.Align.START
        });
        nameRow.pack_start(nameLabel, false, false, 0);

        if (comp.aur) {
            const aurBadge = new Gtk.Label({
                label: 'AUR'
            });
            aurBadge.get_style_context().add_class('dim-label');
            aurBadge.set_markup('<span foreground="#f59e0b" size="small">AUR</span>');
            nameRow.pack_start(aurBadge, false, false, 0);
        }

        const timeLabel = new Gtk.Label({
            label: comp.installTime
        });
        timeLabel.get_style_context().add_class('dim-label');
        timeLabel.set_markup(`<span size="small">${comp.installTime}</span>`);
        nameRow.pack_end(timeLabel, false, false, 0);

        infoBox.pack_start(nameRow, false, false, 0);

        const descLabel = new Gtk.Label({
            label: comp.description,
            halign: Gtk.Align.START
        });
        descLabel.get_style_context().add_class('dim-label');
        descLabel.set_line_wrap(true);
        descLabel.set_xalign(0);
        infoBox.pack_start(descLabel, false, false, 0);

        row.pack_start(infoBox, true, true, 0);

        const installBtn = new Gtk.Button({
            label: 'Install'
        });
        installBtn._componentId = comp.id;
        addPointerCursor(installBtn);
        installBtn.connect('clicked', () => {
            this.runPreinstallComponent(comp, installBtn, statusLabel);
        });
        row.pack_end(installBtn, false, false, 0);

        return row;
    };

    prototype.checkPreinstallStatus = function(listBox) {
        for (const [setId, setData] of Object.entries(PREINSTALL_COMPONENT_SETS)) {
            for (const comp of setData.components) {
                this.checkComponentStatus(comp, listBox);
            }
        }
    };

    prototype.resolvePreinstallCommand = function(comp, key) {
        if (!comp || !comp[key]) return '';
        return typeof comp[key] === 'function'
            ? (tryOrNull(`OverrideTabWidgets.resolvePreinstallCommand:${comp.id}:${key}`, () => comp[key].call(this, comp)) || '')
            : comp[key];
    };

    prototype.isPreinstallComponentInstalled = function(comp) {
        const checkCmd = this.resolvePreinstallCommand(comp, 'checkCmd');
        if (!checkCmd) {
            return false;
        }

        const result = tryOrNull(
            `OverrideTabWidgets.isPreinstallComponentInstalled:${comp.id}`,
            () => GLib.spawn_command_line_sync(`bash -c '${checkCmd.replace(/'/g, "'\\''")}'`)
        );
        return result?.[3] === 0;
    };

    prototype.buildPreinstallInstallScript = function(comp) {
        switch (true) {
            case Boolean(comp.customInstall):
                return this.resolvePreinstallCommand(comp, 'installScript');
            case comp.packages.length > 0: {
                const pkgList = comp.packages.join(' ');
                if (!comp.aur) {
                    return `sudo pacman -S --noconfirm --needed ${pkgList}`;
                }
                return `
                    PM="pacman"
                    command -v yay &>/dev/null && PM="yay"
                    command -v paru &>/dev/null && PM="paru"
                    if [ "$PM" = "pacman" ]; then
                        echo "No AUR helper found. Installing with pacman (may fail for AUR packages)..."
                        sudo pacman -S --noconfirm --needed ${pkgList}
                    else
                        $PM -S --noconfirm --needed ${pkgList}
                    fi
                `;
            }
            default:
                return '';
        }
    };

    prototype.checkComponentStatus = function(comp, listBox) {
        this.updateComponentStatusInList(listBox, comp.id, this.isPreinstallComponentInstalled(comp));
    };

    prototype.updateComponentStatusInList = function(container, compId, isInstalled) {
        const updateWidget = (widget) => {
            if (widget._componentId === compId) {
                switch (true) {
                    case widget instanceof Gtk.Label: {
                        const markup = isInstalled
                            ? '<span foreground="#22c55e">в—Џ</span>'
                            : '<span foreground="#666">в—‹</span>';
                        widget.set_markup(markup);
                        widget.set_tooltip_text(isInstalled ? 'Installed' : 'Not installed');
                        break;
                    }
                    case widget instanceof Gtk.Button:
                        widget.set_sensitive(!isInstalled);
                        widget.set_label(isInstalled ? 'вњ“ Installed' : 'Install');
                        isInstalled && widget.get_style_context().add_class('dim-label');
                        break;
                }
            }
            if (widget.foreach) {
                widget.foreach(updateWidget);
                return;
            }
            if (widget.get_children) {
                widget.get_children().forEach(updateWidget);
            }
        };
        updateWidget(container);
    };

    prototype.runPreinstallComponent = function(comp, button, statusLabel) {
        button.set_sensitive(false);
        button.set_label('Installing...');

        let conflictScript = '';
        if (comp.conflicts && comp.conflicts.length > 0) {
            const conflictList = comp.conflicts.join(' ');
            conflictScript = `
for pkg in ${conflictList}; do
    if pacman -Qi "$pkg" &>/dev/null; then
        echo ">>> Removing conflicting package: $pkg"
        sudo pacman -Rns --noconfirm "$pkg" || true
    fi
done
`;
        }

        const script = this.buildPreinstallInstallScript(comp);
        if (!script) {
            button.set_label('No packages');
            return;
        }

        const fullScript = `
#!/bin/bash
export SUDO_PROMPT="[sudo] password: "

echo "Installing: ${comp.name}"
echo "Р В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ў"
${conflictScript}
${script}
echo ""
echo "Р В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ўР В Р вЂ Р Р†Р вЂљРЎС›Р РЋРІР‚в„ў"
echo "Installation complete. Press Enter to close..."
read
`;

        const tempScript = `/tmp/preinstall_${comp.id}_${Date.now()}.sh`;
        const launched = tryRun(`OverrideTabWidgets.runPreinstallComponent:${comp.id}`, () => {
            GLib.file_set_contents(tempScript, fullScript);
            GLib.spawn_command_line_sync(`chmod +x '${tempScript}'`);
            GLib.spawn_command_line_async(
                `xterm -class lastlayer_preinstall -title "Installing ${comp.name}" -e bash '${tempScript}'`
            );
        });
        if (!launched) {
            button.set_label('Error');
            button.set_sensitive(true);
            return;
        }

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
            this.checkComponentStatus(comp, button.get_parent()?.get_parent()?.get_parent());
            return GLib.SOURCE_REMOVE;
        });
    };
    prototype.runPreinstallAll = function(setId, components, popup) {
        const notInstalled = components.filter((comp) => !this.isPreinstallComponentInstalled(comp));

        if (notInstalled.length === 0) {
            const dialog = new Gtk.MessageDialog({
                transient_for: popup,
                modal: true,
                message_type: Gtk.MessageType.INFO,
                buttons: Gtk.ButtonsType.OK,
                text: 'All components already installed',
                secondary_text: 'Nothing to install.'
            });
            dialog.run();
            dialog.destroy();
            return;
        }

        let script = '#!/bin/bash\nset +e\n\n';
        script += 'export SUDO_PROMPT="[sudo] password: "\n\n';
        script += 'echo "Installing all missing components..."\n';
        script += 'echo "Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™"\n\n';

        for (const comp of notInstalled) {
            script += `echo "\\n>>> Installing: ${comp.name}"\n`;

            if (comp.conflicts && comp.conflicts.length > 0) {
                for (const conflict of comp.conflicts) {
                    script += `
if pacman -Qi "${conflict}" &>/dev/null; then
    echo ">>> Removing conflicting package: ${conflict}"
    sudo pacman -Rns --noconfirm "${conflict}" || true
fi
`;
                }
            }

            const installScript = this.buildPreinstallInstallScript(comp);
            if (installScript) {
                script += installScript + '\n';
            }
        }

        script += '\necho ""\n';
        script += 'echo "Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™Р Р†РІР‚СћРЎвЂ™"\n';
        script += 'echo "All installations complete. Press Enter to close..."\n';
        script += 'read\n';

        const tempScript = `/tmp/preinstall_all_${setId}_${Date.now()}.sh`;
        const launched = tryRun(`OverrideTabWidgets.runPreinstallAll:${setId}`, () => {
            GLib.file_set_contents(tempScript, script);
            GLib.spawn_command_line_sync(`chmod +x '${tempScript}'`);
            GLib.spawn_command_line_async(
                `xterm -class lastlayer_preinstall -title "Installing ${notInstalled.length} components" -e bash '${tempScript}'`
            );
        });
        if (!launched) {
            return;
        }

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
            if (this.preinstallPopup) {
                const listBox = this.preinstallPopup.get_content_area()?.get_children()?.[2]?.get_child();
                if (listBox) {
                    this.checkPreinstallStatus(listBox);
                }
            }
            return GLib.SOURCE_REMOVE;
        });
    };
    prototype.buildWidgetRow = function(widget) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_top: 4,
            margin_bottom: 4
        });

        if (widget.hasSpecialInstall) {
            const indicator = new Gtk.Label({
                label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В Р’В Р В Р РЏ',
                halign: Gtk.Align.START
            });
            indicator.set_markup('<span foreground="#22c55e">Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В Р’В Р В Р РЏ</span>');
            indicator.set_tooltip_text(this.t('SPECIAL_INSTALL_TOOLTIP') === 'SPECIAL_INSTALL_TOOLTIP'
                ? 'Special installation algorithm'
                : this.t('SPECIAL_INSTALL_TOOLTIP'));
            row.pack_start(indicator, false, false, 0);
        }

        const nameLabel = new Gtk.Label({
            label: widget.displayName,
            halign: Gtk.Align.START,
            hexpand: true
        });
        row.pack_start(nameLabel, true, true, 0);

        const infoBtn = new Gtk.Button({
            valign: Gtk.Align.CENTER
        });
        const infoIcon = new Gtk.Image({
            icon_name: 'preferences-system-symbolic',
            icon_size: Gtk.IconSize.SMALL_TOOLBAR
        });
        infoBtn.set_image(infoIcon);
        infoBtn.get_style_context().add_class('flat');
        infoBtn.set_can_focus(true);
        infoBtn.set_focus_on_click(true);
        infoBtn.set_tooltip_text(this.t('VIEW_DETAILS_TOOLTIP') === 'VIEW_DETAILS_TOOLTIP'
            ? 'View installation details'
            : this.t('VIEW_DETAILS_TOOLTIP'));
        addPointerCursor(infoBtn);

        infoBtn.connect('clicked', () => {
            this.showWidgetDetailsPopup(widget, infoBtn);
        });

        row.pack_start(infoBtn, false, false, 0);

        return row;
    };

    prototype.showWidgetDetailsPopup = function(widget, triggerBtn) {
        if (this.widgetPopup) {
            this.widgetPopup.destroy();
            this.widgetPopup = null;
        }

        const popup = new Gtk.Dialog({
            modal: true,
            decorated: false,
            resizable: false
        });
        popup.set_size_request(380, -1);
        popup.get_style_context().add_class('widget-details-popup');

        const transientParent = this.widgetListPopup?.get_visible?.() ? this.widgetListPopup : this.parentWindow;`r`n        transientParent && popup.set_transient_for(transientParent);

        const actionArea = popup.get_action_area?.();
        if (actionArea) {
            actionArea.hide();
            actionArea.set_no_show_all(true);
        }

        const gdkWindow = triggerBtn.get_window?.();`r`n        const origin = gdkWindow ? tryOrNull('OverrideTabWidgets.showWidgetDetailsPopup.origin', () => gdkWindow.get_origin()) : null;`r`n        if (origin?.[0]) {`r`n            const alloc = triggerBtn.get_allocation();`r`n            popup.move(origin[1] + alloc.x - 340, origin[2] + alloc.y + alloc.height + 4);`r`n        }

        const content = popup.get_content_area();
        content.set_spacing(8);
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const titleBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6
        });
        const indicator = new Gtk.Label();
        indicator.set_markup('<span foreground="#22c55e" size="large">Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В Р’В Р В Р РЏ</span>');
        titleBox.pack_start(indicator, false, false, 0);

        const titleLabel = new Gtk.Label({
            halign: Gtk.Align.START,
            use_markup: true
        });
        titleLabel.set_markup(`<b>${widget.displayName}</b>`);
        titleLabel.get_style_context().add_class('title-3');
        titleBox.pack_start(titleLabel, false, false, 0);
        header.pack_start(titleBox, true, true, 0);

        const closeBtn = new Gtk.Button({
            label: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚С”',
            relief: Gtk.ReliefStyle.NONE
        });
        closeBtn.set_size_request(28, 28);
        closeBtn.get_style_context().add_class('flat');
        closeBtn.get_style_context().add_class('circular');
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => {
            popup.destroy();
        });
        header.pack_end(closeBtn, false, false, 0);

        content.pack_start(header, false, false, 0);

        const descLabel = new Gtk.Label({
            label: widget.description,
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        descLabel.get_style_context().add_class('dim-label');
        content.pack_start(descLabel, false, false, 0);

        content.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }), false, false, 4);

        const details = widget.details;

        this.addDetailRow(content, 'Build Type', details.buildType);

        if (details.specialFeatures && details.specialFeatures.length > 0) {
            const featuresLabel = new Gtk.Label({
                label: 'Installation Features:',
                halign: Gtk.Align.START
            });
            featuresLabel.get_style_context().add_class('dim-label');
            content.pack_start(featuresLabel, false, false, 4);

            for (const feature of details.specialFeatures) {
                const featureRow = new Gtk.Label({
                    label: feature,
                    halign: Gtk.Align.START,
                    wrap: true,
                    xalign: 0
                });
                content.pack_start(featureRow, false, false, 0);
            }
        }

        if (details.prerequisites.length > 0) {
            this.addDetailRow(content, 'Prerequisites', details.prerequisites.join(', '));
        }

        if (details.aurReplaced && details.aurReplaced.length > 0) {
            this.addDetailRow(content, 'Replaces AUR', details.aurReplaced.join(', '));
        }

        if (details.technicalSteps && details.technicalSteps.length > 0) {
            const stepsLabel = new Gtk.Label({
                label: 'Technical Steps:',
                halign: Gtk.Align.START
            });
            stepsLabel.get_style_context().add_class('dim-label');
            content.pack_start(stepsLabel, false, false, 4);

            for (const step of details.technicalSteps) {
                const stepRow = new Gtk.Label({
                    label: step,
                    halign: Gtk.Align.START,
                    wrap: true,
                    xalign: 0
                });
                stepRow.get_style_context().add_class('monospace');
                content.pack_start(stepRow, false, false, 0);
            }
        }

        if (details.pipDeps && details.pipDeps.length > 0) {
            this.addDetailRow(content, 'Pip Deps', details.pipDeps.join(', '));
        }

        if (details.provides.length > 0) {
            this.addDetailRow(content, 'Provides', details.provides.join(', '));
        }

        if (details.conflicts.length > 0) {
            this.addDetailRow(content, 'Conflicts', details.conflicts.join(', '));
        }

        if (widget.name === 'hyprpanel') {
            this.addHyprpanelAdaptiveSection(content);
        }
        if (widget.name === 'quickshell') {
            this.addQuickshellAdaptiveSection(content);
        }

        popup.show_all();
        popup.present?.();

        popup.connect('key-press-event', (w, event) => {
            const [ok, keyval] = event.get_keyval();
            if (ok && keyval === 65307) {
                popup.destroy();
                return true;
            }
            return false;
        });

        popup.connect('destroy', () => {
            this.widgetPopup = null;
        });

        this.widgetPopup = popup;
    };

    prototype.addDetailRow = function(container, label, value) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const labelWidget = new Gtk.Label({
            label: `${label}:`,
            halign: Gtk.Align.START
        });
        labelWidget.get_style_context().add_class('dim-label');
        labelWidget.set_size_request(90, -1);
        row.pack_start(labelWidget, false, false, 0);

        const valueWidget = new Gtk.Label({
            label: value,
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0,
            hexpand: true
        });
        row.pack_start(valueWidget, true, true, 0);

        container.pack_start(row, false, false, 2);
    };

    prototype.addHyprpanelAdaptiveSection = function(container) {
        const adaptiveTitleKey = 'HYPRPANEL_ADAPTIVE_TITLE';
        const adaptiveTitleText = this.t(adaptiveTitleKey);

        container.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }), false, false, 4);

        const adaptiveTitle = new Gtk.Label({
            label: adaptiveTitleText === adaptiveTitleKey ? 'Adaptive' : adaptiveTitleText,
            halign: Gtk.Align.START
        });
        adaptiveTitle.get_style_context().add_class('dim-label');
        container.pack_start(adaptiveTitle, false, false, 2);

        const state = this.getHyprpanelAdaptiveState();

        const isolationRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.FILL
        });
        const isolationLabelKey = 'HYPRPANEL_ADAPTIVE_ISOLATION';
        const isolationLabelText = this.t(isolationLabelKey);
        const isolationLabel = new Gtk.Label({
            label: isolationLabelText === isolationLabelKey
                ? 'Install in isolated prefix (adaptive)'
                : isolationLabelText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true,
            hexpand: true
        });
        isolationRow.pack_start(isolationLabel, true, true, 0);

        const isolationSwitch = new Gtk.Switch({
            active: state.isolationEnabled,
            valign: Gtk.Align.CENTER
        });
        isolationSwitch.connect('notify::active', () => {
            const enabled = isolationSwitch.get_active();
            this.setHyprpanelAdaptiveSetting('hyprpanel_adaptive_isolation', enabled);
            this.applyHyprpanelIsolationToTheme(state.themeName, enabled);
        });
        isolationRow.pack_end(isolationSwitch, false, false, 0);
        container.pack_start(isolationRow, false, false, 0);

        const isolationHintKey = 'HYPRPANEL_ADAPTIVE_ISOLATION_HINT';
        const isolationHintText = this.t(isolationHintKey);
        const isolationHint = new Gtk.Label({
            label: isolationHintText === isolationHintKey
                ? 'Uses ~/.local/share/lastlayer/programs/rices/<rice>/bin/hyprpanel'
                : isolationHintText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        isolationHint.get_style_context().add_class('dim-label');
        container.pack_start(isolationHint, false, false, 2);

        const scaleRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.FILL
        });
        const scaleLabelKey = 'HYPRPANEL_ADAPTIVE_SCALE';
        const scaleLabelText = this.t(scaleLabelKey);
        const scaleLabel = new Gtk.Label({
            label: scaleLabelText === scaleLabelKey
                ? 'Adaptive scaling (theme.bar.scaling)'
                : scaleLabelText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true,
            hexpand: true
        });
        scaleRow.pack_start(scaleLabel, true, true, 0);

        const scaleSwitch = new Gtk.Switch({
            active: state.scaleEnabled,
            valign: Gtk.Align.CENTER
        });
        scaleRow.pack_end(scaleSwitch, false, false, 0);
        container.pack_start(scaleRow, false, false, 0);

        const scaleHintKey = 'HYPRPANEL_ADAPTIVE_SCALE_HINT';
        const scaleHintText = this.t(scaleHintKey);
        const scaleHint = new Gtk.Label({
            label: scaleHintText === scaleHintKey
                ? 'Default 68. Applies to ~/.config/hyprpanel + theme config.'
                : scaleHintText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        scaleHint.get_style_context().add_class('dim-label');
        container.pack_start(scaleHint, false, false, 2);

        const scaleBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.FILL
        });
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 40,
                upper: 120,
                step_increment: 1,
                page_increment: 5
            }),
            digits: 0,
            draw_value: false,
            hexpand: true
        });
        scale.set_value(state.scaleValue);
        scale.get_style_context().add_class('override-scale');
        scale.set_sensitive(state.scaleEnabled);
        scaleBox.pack_start(scale, true, true, 0);

        const valueLabel = new Gtk.Label({
            label: String(state.scaleValue),
            halign: Gtk.Align.END
        });
        valueLabel.set_sensitive(state.scaleEnabled);
        scaleBox.pack_end(valueLabel, false, false, 0);
        container.pack_start(scaleBox, false, false, 0);

        scaleSwitch.connect('notify::active', () => {
            const enabled = scaleSwitch.get_active();
            this.setHyprpanelAdaptiveSetting('hyprpanel_adaptive_scale_enabled', enabled);
            scale.set_sensitive(enabled);
            valueLabel.set_sensitive(enabled);
            if (enabled) {
                this.applyHyprpanelScaling(state.themeName, Math.round(scale.get_value()));
            }
        });

        scale.connect('value-changed', () => {
            const value = Math.round(scale.get_value());
            valueLabel.set_text(String(value));
            this.setHyprpanelAdaptiveSetting('hyprpanel_adaptive_scale_value', value);
            if (scaleSwitch.get_active()) {
                this.applyHyprpanelScaling(state.themeName, value);
            }
        });
    };

    prototype.addQuickshellAdaptiveSection = function(container) {
        const adaptiveTitleKey = 'QUICKSHELL_ADAPTIVE_TITLE';
        const adaptiveTitleText = this.t(adaptiveTitleKey);

        container.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }), false, false, 4);

        const adaptiveTitle = new Gtk.Label({
            label: adaptiveTitleText === adaptiveTitleKey ? 'Adaptive' : adaptiveTitleText,
            halign: Gtk.Align.START
        });
        adaptiveTitle.get_style_context().add_class('dim-label');
        container.pack_start(adaptiveTitle, false, false, 2);

        const state = this.getQuickshellAdaptiveState();

        const isolationRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.FILL
        });
        const isolationLabelKey = 'QUICKSHELL_ADAPTIVE_ISOLATION';
        const isolationLabelText = this.t(isolationLabelKey);
        const isolationLabel = new Gtk.Label({
            label: isolationLabelText === isolationLabelKey
                ? 'Install in isolated prefix (per-rice)'
                : isolationLabelText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true,
            hexpand: true
        });
        isolationRow.pack_start(isolationLabel, true, true, 0);

        const isolationSwitch = new Gtk.Switch({
            active: state.isolationEnabled,
            valign: Gtk.Align.CENTER
        });
        isolationSwitch.connect('notify::active', () => {
            const enabled = isolationSwitch.get_active();
            this.setQuickshellAdaptiveSetting('quickshell_adaptive_isolation', enabled);
            this.applyQuickshellIsolationToTheme(state.themeName, enabled);
        });
        isolationRow.pack_end(isolationSwitch, false, false, 0);
        container.pack_start(isolationRow, false, false, 0);

        const isolationHintKey = 'QUICKSHELL_ADAPTIVE_ISOLATION_HINT';
        const isolationHintText = this.t(isolationHintKey);
        const isolationHint = new Gtk.Label({
            label: isolationHintText === isolationHintKey
                ? 'Uses ~/.local/share/lastlayer/programs/(shared|quickshell|rices)/... (ignores dependency isolation setting)'
                : isolationHintText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        isolationHint.get_style_context().add_class('dim-label');
        container.pack_start(isolationHint, false, false, 2);
    };

    prototype.getHyprpanelAdaptiveState = function() {
        const settings = this.settings || {};
        const scaleValue = Number.isFinite(settings.hyprpanel_adaptive_scale_value)
            ? settings.hyprpanel_adaptive_scale_value
            : 68;
        return {
            isolationEnabled: settings.hyprpanel_adaptive_isolation === true,
            scaleEnabled: settings.hyprpanel_adaptive_scale_enabled === true,
            scaleValue,
            themeName: settings.theme || null
        };
    };

    prototype.setHyprpanelAdaptiveSetting = function(key, value) {
        if (this.settingsManager?.set) {
            this.settingsManager.set(key, value);
            this.settingsManager.write?.(null, { silent: true });
        }
        if (this.settings) {
            this.settings[key] = value;
        }
    };

    prototype.applyHyprpanelScaling = function(themeName, value) {
        const scaleValue = Math.round(value);
        const homeDir = GLib.get_home_dir();
        const configPaths = [
            `${homeDir}/.config/hyprpanel/config.json`
        ];

        if (themeName) {
            const themeDir = `${homeDir}/.config/themes/${themeName}`;
            configPaths.push(
                `${themeDir}/config/hyprpanel/config.json`,
                `${themeDir}/config/HyprPanel/config.json`
            );
        }

        for (const path of configPaths) {
            this.updateHyprpanelConfigScale(path, scaleValue);
        }
    };

    prototype.updateHyprpanelConfigScale = function(configPath, scaleValue) {
        if (!GLib.file_test(configPath, GLib.FileTest.EXISTS)) return false;

        return tryOrFalse('OverrideTabWidgets.updateHyprpanelConfigScale', () => {
            const [ok, contents] = GLib.file_get_contents(configPath);
            if (!ok || !contents) return false;
            const text = new TextDecoder('utf-8').decode(contents);
            const data = JSON.parse(text);
            if (data['theme.bar.scaling'] === scaleValue) return false;
            data['theme.bar.scaling'] = scaleValue;
            GLib.file_set_contents(configPath, JSON.stringify(data, null, 2));
            return true;
        });
    };

    prototype.getIsolationGroupingMode = function() {
        return this.settingsManager?.get?.('isolation_grouping_mode')
            || this.settings?.isolation_grouping_mode
            || 'hybrid';
    };

    prototype.getQuickshellAdaptivePrefixAbsolute = function(themeName) {
        const homeDir = GLib.get_home_dir();
        const basePath = `${homeDir}/.local/share/lastlayer/programs`;
        const mode = this.getIsolationGroupingMode();

        switch (mode) {
            case 'per-rice': {
                const effectiveTheme = themeName || this.settings?.theme || 'default';
                return `${basePath}/rices/${effectiveTheme}`;
            }
            case 'per-program':
                return `${basePath}/quickshell/isolated`;
            default:
                return `${basePath}/shared/quickshell/isolated`;
        }
    };

    prototype.getQuickshellAdaptivePrefix = function(themeName) {
        const homeDir = GLib.get_home_dir();
        const prefix = this.getQuickshellAdaptivePrefixAbsolute(themeName);
        return prefix.startsWith(homeDir)
            ? `$HOME${prefix.slice(homeDir.length)}`
            : prefix;
    };

    prototype.getQuickshellAdaptiveState = function() {
        const settings = this.settings || {};
        return {
            isolationEnabled: settings.quickshell_adaptive_isolation === true,
            themeName: settings.theme || null
        };
    };

    prototype.setQuickshellAdaptiveSetting = function(key, value) {
        if (this.settingsManager?.set) {
            this.settingsManager.set(key, value);
            this.settingsManager.write?.(null, { silent: true });
        }
        if (this.settings) {
            this.settings[key] = value;
        }
    };

    prototype.applyQuickshellIsolationToTheme = function(themeName, enabled) {
        if (!themeName) return;
        const homeDir = GLib.get_home_dir();
        const themeDir = `${homeDir}/.config/themes/${themeName}`;
        const quickshellPrefix = this.getQuickshellAdaptivePrefix(themeName);
        const quickshellPath = `${quickshellPrefix}/bin/quickshell`;
        const hyprlandPaths = [
            `${themeDir}/hyprland/execs.conf`,
            `${themeDir}/hyprland/hyprland.conf`,
            `${themeDir}/hyprland.conf`
        ];

        for (const path of hyprlandPaths) {
            this.updateQuickshellExecsPath(path, quickshellPath, enabled);
        }

        const afterInstallScript = `${themeDir}/start-scripts/set_after_install_actions.sh`;
        this.updateQuickshellAfterInstallScript(afterInstallScript, themeName, enabled);
    };

    prototype.updateQuickshellExecsPath = function(filePath, quickshellPath, enabled) {
        if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) return false;
        const [ok, contents] = GLib.file_get_contents(filePath);
        if (!ok || !contents) return false;
        const text = new TextDecoder('utf-8').decode(contents);
        const lines = text.split('\n');
        let changed = false;

        const fallbackCmd = `bash -c 'RICE_BIN="${quickshellPath}"; ` +
            `[ -x "$RICE_BIN" ] && exec "$RICE_BIN" || { ` +
            `ANY_BIN=$(find "$HOME/.local/share/lastlayer/programs/rices" -maxdepth 3 -type f -name quickshell -path "*/bin/quickshell" -executable 2>/dev/null | head -1); ` +
            `[ -z "$ANY_BIN" ] && ANY_BIN=$(find "$HOME/.local/share/lastlayer/programs/shared/quickshell" -maxdepth 3 -type f -name quickshell -path "*/bin/quickshell" -executable 2>/dev/null | head -1); ` +
            `[ -z "$ANY_BIN" ] && ANY_BIN=$(find "$HOME/.local/share/lastlayer/programs/quickshell" -maxdepth 3 -type f -name quickshell -path "*/bin/quickshell" -executable 2>/dev/null | head -1); ` +
            `[ -x "$ANY_BIN" ] && exec "$ANY_BIN" || exec quickshell; }'`;

        const updated = lines.map(line => {
            const match = line.match(/^(\s*exec(?:-once)?\s*=\s*)(.+)$/);
            if (!match) return line;
            const prefix = match[1];
            const cmd = match[2].trim();
            if (!cmd) return line;

            const parts = cmd.split(/\s+/);
            const first = parts[0];
            const rest = parts.slice(1).join(' ');
            const isQuickshellCmd = first === 'quickshell' || first.endsWith('/quickshell');
            const isWrappedQuickshell = cmd.includes('bash -c') && cmd.includes('quickshell');
            if (!isQuickshellCmd && !isWrappedQuickshell) return line;

            if (enabled) {
                if (cmd.includes('RICE_BIN=') && cmd.includes('find')) return line;
                const newCmd = rest ? fallbackCmd.replace("exec quickshell; }'", "exec quickshell " + rest + "; }'") : fallbackCmd;
                changed = true;
                return `${prefix}${newCmd}`;
            }

            const isIsolatedPath = first.includes('/.local/share/lastlayer/programs/')
                || first.includes('/lastlayer/programs/')
                || first.includes('$HOME/.local/share/lastlayer/programs/')
                || isWrappedQuickshell;
            if (!isIsolatedPath) return line;
            const newCmd = rest ? `quickshell ${rest}` : 'quickshell';
            changed = true;
            return `${prefix}${newCmd}`;
        });

        if (!changed) return false;
        GLib.file_set_contents(filePath, updated.join('\n'));
        return true;
    };

    prototype.updateQuickshellAfterInstallScript = function(scriptPath, themeName, enabled) {
        if (!GLib.file_test(scriptPath, GLib.FileTest.EXISTS)) return false;
        const [ok, contents] = GLib.file_get_contents(scriptPath);
        if (!ok || !contents) return false;
        const text = new TextDecoder('utf-8').decode(contents);
        let lines = text.split('\n');
        let changed = false;

        const quickshellPrefix = this.getQuickshellAdaptivePrefix(themeName);
        const prefixLine = `QUICKSHELL_PREFIX="${quickshellPrefix}"`;
        const exportLine = 'export PATH="$QUICKSHELL_PREFIX/bin:$PATH"';

        const filtered = lines.filter(line => {
            const trimmed = line.trim();
            return !trimmed.startsWith('QUICKSHELL_PREFIX=') && trimmed !== exportLine;
        });
        if (filtered.length !== lines.length) {
            lines = filtered;
            changed = true;
        } else {
            lines = filtered;
        }

        if (enabled) {
            const insertIndex = lines.findIndex(line => line.startsWith('THEME_DIR='));
            if (insertIndex >= 0) {
                lines.splice(insertIndex + 1, 0, prefixLine, exportLine);
                changed = true;
            }
        }

        if (!changed) return false;
        GLib.file_set_contents(scriptPath, lines.join('\n'));
        return true;
    };

    prototype.applyHyprpanelIsolationToTheme = function(themeName, enabled) {
        if (!themeName) return;
        const homeDir = GLib.get_home_dir();
        const themeDir = `${homeDir}/.config/themes/${themeName}`;
        const hyprpanelPath = `$HOME/.local/share/lastlayer/programs/rices/${themeName}/bin/hyprpanel`;
        const hyprlandPaths = [
            `${themeDir}/hyprland/execs.conf`,
            `${themeDir}/hyprland/hyprland.conf`,
            `${themeDir}/hyprland.conf`
        ];

        for (const path of hyprlandPaths) {
            this.updateHyprpanelExecsPath(path, hyprpanelPath, enabled);
        }

        const afterInstallScript = `${themeDir}/start-scripts/set_after_install_actions.sh`;
        this.updateHyprpanelAfterInstallScript(afterInstallScript, themeName, enabled);
    };

    prototype.updateHyprpanelExecsPath = function(filePath, hyprpanelPath, enabled) {
        if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) return false;
        const [ok, contents] = GLib.file_get_contents(filePath);
        if (!ok || !contents) return false;
        const text = new TextDecoder('utf-8').decode(contents);
        const lines = text.split('\n');
        let changed = false;

        const updated = lines.map(line => {
            const match = line.match(/^(\s*exec(?:-once)?\s*=\s*)(.+)$/);
            if (!match) return line;
            const prefix = match[1];
            const cmd = match[2].trim();
            if (!cmd) return line;

            const parts = cmd.split(/\s+/);
            const first = parts[0];
            const rest = parts.slice(1).join(' ');
            const isHyprpanelCmd = first === 'hyprpanel' || first.endsWith('/hyprpanel');
            if (!isHyprpanelCmd) return line;

            if (enabled) {
                if (first === hyprpanelPath) return line;
                const newCmd = rest ? `${hyprpanelPath} ${rest}` : hyprpanelPath;
                changed = true;
                return `${prefix}${newCmd}`;
            }

            const isIsolatedPath = first.includes('/.local/share/lastlayer/programs/')
                || first.includes('/lastlayer/programs/')
                || first.includes('$HOME/.local/share/lastlayer/programs/');
            if (!isIsolatedPath) return line;
            const newCmd = rest ? `hyprpanel ${rest}` : 'hyprpanel';
            changed = true;
            return `${prefix}${newCmd}`;
        });

        if (!changed) return false;
        GLib.file_set_contents(filePath, updated.join('\n'));
        return true;
    };

    prototype.updateHyprpanelAfterInstallScript = function(scriptPath, themeName, enabled) {
        if (!GLib.file_test(scriptPath, GLib.FileTest.EXISTS)) return false;
        const [ok, contents] = GLib.file_get_contents(scriptPath);
        if (!ok || !contents) return false;
        const text = new TextDecoder('utf-8').decode(contents);
        let lines = text.split('\n');
        let changed = false;

        const prefixLine = `HYPRPANEL_PREFIX="$HOME/.local/share/lastlayer/programs/rices/${themeName}"`;
        const exportLine = 'export PATH="$HYPRPANEL_PREFIX/bin:$PATH"';

        if (enabled) {
            const hasPrefix = lines.some(line => line.trim() === prefixLine);
            const hasExport = lines.some(line => line.trim() === exportLine);
            if (!hasPrefix || !hasExport) {
                const insertIndex = lines.findIndex(line => line.startsWith('THEME_DIR='));
                if (insertIndex >= 0) {
                    const additions = [];
                    if (!hasPrefix) additions.push(prefixLine);
                    if (!hasExport) additions.push(exportLine);
                    lines.splice(insertIndex + 1, 0, ...additions);
                    changed = true;
                }
            }
        } else {
            const filtered = lines.filter(line => {
                const trimmed = line.trim();
                return trimmed !== prefixLine && trimmed !== exportLine;
            });
            if (filtered.length !== lines.length) {
                lines = filtered;
                changed = true;
            }
        }

        if (!changed) return false;
        GLib.file_set_contents(scriptPath, lines.join('\n'));
        return true;
    };

    prototype.buildDottedSeparator = function() {
        const separator = new Gtk.DrawingArea();
        separator.set_size_request(1, -1);
        separator.get_style_context().add_class('dotted-separator');

        separator.connect('draw', (widget, cr) => {
            const height = widget.get_allocated_height();
            const width = widget.get_allocated_width();

            cr.setSourceRGBA(0.5, 0.5, 0.5, 0.5);

            const dotSize = 2;
            const gapSize = 4;
            let y = 0;

            while (y < height) {
                cr.rectangle(width / 2 - dotSize / 2, y, dotSize, dotSize);
                cr.fill();
                y += dotSize + gapSize;
            }

            return false;
        });

        return separator;
    };
}
