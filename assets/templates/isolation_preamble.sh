__LL_ISOLATION_ENABLED="1"
__LL_ISOLATION_PREFIX="{{PREFIX}}"
__LL_ISOLATION_MODE="{{MODE}}"
__LL_RICE_NAME="{{THEME_NAME}}"
__LL_VENV_PATH="{{VENV_PATH}}"
__LL_PROGRAMS_BASE="{{BASE_PROGRAMS_PATH}}"

mkdir -p "$__LL_ISOLATION_PREFIX/bin" "$__LL_ISOLATION_PREFIX/lib" "$__LL_ISOLATION_PREFIX/share" 2>/dev/null || true

llGetProgramPrefix() {
    local pkg="$1"
    if [ "$__LL_ISOLATION_MODE" = "per-program" ]; then
        local version
        version="$("$__ll_real_pacman" -Q "$pkg" 2>/dev/null | awk '{print $2}')" || version="latest"
        [ -z "$version" ] && version="latest"
        echo "$__LL_PROGRAMS_BASE/$pkg/$version"
    else
        echo "$__LL_ISOLATION_PREFIX"
    fi
}

llEffectivePrefix() {
    local pkg="$1"
    if [ "$__LL_ISOLATION_MODE" = "per-program" ] && [ -n "$pkg" ]; then
        llGetProgramPrefix "$pkg"
    else
        echo "$__LL_ISOLATION_PREFIX"
    fi
}
export -f llGetProgramPrefix llEffectivePrefix 2>/dev/null || true

export PATH="$__LL_ISOLATION_PREFIX/bin:$PATH"
export LD_LIBRARY_PATH="$__LL_ISOLATION_PREFIX/lib:${LD_LIBRARY_PATH:-}"
export XDG_DATA_DIRS="$__LL_ISOLATION_PREFIX/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
export PKG_CONFIG_PATH="$__LL_ISOLATION_PREFIX/lib/pkgconfig:${PKG_CONFIG_PATH:-}"

__ll_orig_meson="$(command -v meson 2>/dev/null || echo meson)"
meson() {
    if [ "$1" = "install" ]; then
        shift
        DESTDIR="$__LL_ISOLATION_PREFIX" "$__ll_orig_meson" install "$@"
    elif [ "$1" = "setup" ]; then
        shift
        "$__ll_orig_meson" setup --prefix="$__LL_ISOLATION_PREFIX" "$@"
    else
        "$__ll_orig_meson" "$@"
    fi
}
export -f meson 2>/dev/null || true

__ll_orig_cmake="$(command -v cmake 2>/dev/null || echo cmake)"
cmake() {
    local has_install=0
    local has_prefix=0
    for arg in "$@"; do
        [ "$arg" = "--install" ] && has_install=1
        [[ "$arg" == *CMAKE_INSTALL_PREFIX* ]] && has_prefix=1
    done
    if [ "$has_install" = "1" ]; then
        DESTDIR="$__LL_ISOLATION_PREFIX" "$__ll_orig_cmake" "$@"
    elif [ "$has_prefix" = "0" ]; then
        "$__ll_orig_cmake" -DCMAKE_INSTALL_PREFIX="$__LL_ISOLATION_PREFIX" "$@"
    else
        "$__ll_orig_cmake" "$@"
    fi
}
export -f cmake 2>/dev/null || true

__ll_orig_make="$(command -v make 2>/dev/null || echo make)"
make() {
    local has_install=0
    for arg in "$@"; do
        [ "$arg" = "install" ] && has_install=1
    done
    if [ "$has_install" = "1" ]; then
        "$__ll_orig_make" DESTDIR="$__LL_ISOLATION_PREFIX" PREFIX="" "$@"
    else
        "$__ll_orig_make" "$@"
    fi
}
export -f make 2>/dev/null || true

__ll_orig_ninja="$(command -v ninja 2>/dev/null || echo ninja)"
ninja() {
    local has_install=0
    for arg in "$@"; do
        [ "$arg" = "install" ] && has_install=1
    done
    if [ "$has_install" = "1" ]; then
        DESTDIR="$__LL_ISOLATION_PREFIX" "$__ll_orig_ninja" "$@"
    else
        "$__ll_orig_ninja" "$@"
    fi
}
export -f ninja 2>/dev/null || true

__ll_orig_pip="$(command -v pip 2>/dev/null || echo pip)"
__ll_orig_pip3="$(command -v pip3 2>/dev/null || echo pip3)"
llPipWrapper() {
    local pip_cmd="$1"
    shift
    local has_install=0
    for arg in "$@"; do
        [ "$arg" = "install" ] && has_install=1
    done
    if [ "$has_install" = "1" ]; then
        if [ -f "$__LL_VENV_PATH/bin/activate" ]; then
            source "$__LL_VENV_PATH/bin/activate"
            "$pip_cmd" "$@"
        else
            mkdir -p "$__LL_VENV_PATH"
            python3 -m venv "$__LL_VENV_PATH" 2>/dev/null || true
            if [ -f "$__LL_VENV_PATH/bin/activate" ]; then
                source "$__LL_VENV_PATH/bin/activate"
                "$pip_cmd" "$@"
            else
                "$pip_cmd" install --prefix="$__LL_ISOLATION_PREFIX" "$@"
            fi
        fi
    else
        "$pip_cmd" "$@"
    fi
}
pip() { llPipWrapper "$__ll_orig_pip" "$@"; }
pip3() { llPipWrapper "$__ll_orig_pip3" "$@"; }
export -f pip pip3 llPipWrapper 2>/dev/null || true

__ll_orig_go="$(command -v go 2>/dev/null || echo go)"
go() {
    if [ "$1" = "install" ]; then
        GOBIN="$__LL_ISOLATION_PREFIX/bin" "$__ll_orig_go" "$@"
    else
        "$__ll_orig_go" "$@"
    fi
}
export -f go 2>/dev/null || true

__ll_orig_cargo="$(command -v cargo 2>/dev/null || echo cargo)"
cargo() {
    if [ "$1" = "install" ]; then
        shift
        "$__ll_orig_cargo" install --root "$__LL_ISOLATION_PREFIX" "$@"
    else
        "$__ll_orig_cargo" "$@"
    fi
}
export -f cargo 2>/dev/null || true

__ll_orig_npm="$(command -v npm 2>/dev/null || echo npm)"
npm() {
    local has_global=0
    for arg in "$@"; do
        [ "$arg" = "-g" ] || [ "$arg" = "--global" ] && has_global=1
    done
    if [ "$has_global" = "1" ]; then
        "$__ll_orig_npm" --prefix "$__LL_ISOLATION_PREFIX" "$@"
    else
        "$__ll_orig_npm" "$@"
    fi
}
export -f npm 2>/dev/null || true

__ll_real_pacman="$(command -v pacman 2>/dev/null || echo pacman)"

__LL_WIDGET_BINS="ags agsv1 eww waybar polybar fabric goignis ignis hyprpanel quickshell nwg-dock-hyprland swaybg swww"

llGenerateWrapper() {
    local bin_name="$1"
    local real_binary="$2"
    local dest="$3"
    local wrapper_path="$dest/bin/$bin_name"

    cat > "$wrapper_path" << WRAPPER_EOF
export __LL_ISOLATION_PREFIX="$dest"
export __LL_ISOLATION_BINARY="$bin_name"
export __LL_VENV_PATH="$__LL_VENV_PATH"

export PATH="\\$__LL_ISOLATION_PREFIX/bin:\\$PATH"
export LD_LIBRARY_PATH="\\$__LL_ISOLATION_PREFIX/lib:\\${LD_LIBRARY_PATH:-}"
export XDG_DATA_DIRS="\\$__LL_ISOLATION_PREFIX/share:\\${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"

[ -f "\\$__LL_VENV_PATH/bin/activate" ] && source "\\$__LL_VENV_PATH/bin/activate"

exec "$real_binary" "\\$@"
WRAPPER_EOF

    chmod +x "$wrapper_path"
    echo "[LASTLAYER]   → wrapper bin/$bin_name → $real_binary"
}

llIsWidgetBinary() {
    local bin_name="$1"
    echo " $__LL_WIDGET_BINS " | grep -q " $bin_name "
}

llCopyPkgToPrefix() {
    local pkg="$1"
    local dest="$2"

    if ! "$__ll_real_pacman" -Qq "$pkg" &>/dev/null; then
        return 1
    fi

    echo "[LASTLAYER] Copying installed package '$pkg' to isolation prefix"

    while IFS= read -r file; do
        [[ "$file" == "$pkg "* ]] && file="${file#$pkg }"

        if [[ "$file" == /usr/bin/* ]]; then
            local basename="${file##*/}"
            if [ -f "$file" ] && [ ! -f "$dest/bin/$basename" ]; then
                if llIsWidgetBinary "$basename"; then
                    llGenerateWrapper "$basename" "$file" "$dest"
                else
                    cp -a "$file" "$dest/bin/" 2>/dev/null && echo "[LASTLAYER]   → bin/$basename"
                fi
            fi
        elif [[ "$file" == /usr/lib/* ]]; then
            local relpath="${file#/usr/lib/}"
            local dirname="$(dirname "$relpath")"
            if [ -f "$file" ]; then
                mkdir -p "$dest/lib/$dirname" 2>/dev/null
                cp -a "$file" "$dest/lib/$relpath" 2>/dev/null
            fi
        elif [[ "$file" == /usr/share/* ]]; then
            local relpath="${file#/usr/share/}"
            local dirname="$(dirname "$relpath")"
            if [ -f "$file" ]; then
                mkdir -p "$dest/share/$dirname" 2>/dev/null
                cp -a "$file" "$dest/share/$relpath" 2>/dev/null
            fi
        fi
    done < <("$__ll_real_pacman" -Ql "$pkg" 2>/dev/null)

    return 0
}

llEnsurePkgInPrefix() {
    local pkg="$1"

    local effective_prefix
    if [ "$__LL_ISOLATION_MODE" = "per-program" ]; then
        effective_prefix="$(llGetProgramPrefix "$pkg")"
        mkdir -p "$effective_prefix/bin" "$effective_prefix/lib" "$effective_prefix/share" 2>/dev/null
        if [[ ":$PATH:" != *":$effective_prefix/bin:"* ]]; then
            export PATH="$effective_prefix/bin:$PATH"
            export LD_LIBRARY_PATH="$effective_prefix/lib:${LD_LIBRARY_PATH:-}"
            export XDG_DATA_DIRS="$effective_prefix/share:${XDG_DATA_DIRS:-}"
        fi
    else
        effective_prefix="$__LL_ISOLATION_PREFIX"
    fi

    if [ -f "$effective_prefix/bin/$pkg" ]; then
        echo "[LASTLAYER] Package '$pkg' already in prefix ($effective_prefix)"
        return 0
    fi

    if "$__ll_real_pacman" -Qq "$pkg" &>/dev/null; then
        echo "[LASTLAYER] Copying '$pkg' to $effective_prefix"
        llCopyPkgToPrefix "$pkg" "$effective_prefix"
        return 0
    fi

    return 1
}
export -f llCopyPkgToPrefix llEnsurePkgInPrefix __ll_real_pacman llGenerateWrapper llIsWidgetBinary 2>/dev/null || true

__ll_orig_paru="$(command -v paru 2>/dev/null || echo paru)"
__ll_orig_yay="$(command -v yay 2>/dev/null || echo yay)"

llExtractPkg() {
    local pkg_file="$1"
    local dest="$2"
    local extract_dir="/tmp/ll_extract_$$"
    mkdir -p "$dest/bin" "$dest/lib" "$dest/share" "$extract_dir"

    if tar -xf "$pkg_file" -C "$extract_dir" 2>/dev/null; then
        [ -d "$extract_dir/usr/lib" ] && cp -a "$extract_dir/usr/lib"/* "$dest/lib/" 2>/dev/null
        [ -d "$extract_dir/usr/share" ] && cp -a "$extract_dir/usr/share"/* "$dest/share/" 2>/dev/null

        if [ -d "$extract_dir/usr/bin" ]; then
            for bin_file in "$extract_dir/usr/bin"/*; do
                [ -f "$bin_file" ] || continue
                local bin_name="${bin_file##*/}"
                if llIsWidgetBinary "$bin_name"; then
                    cp -a "$bin_file" "$dest/bin/$bin_name-real" 2>/dev/null
                    llGenerateWrapper "$bin_name" "$dest/bin/$bin_name-real" "$dest"
                else
                    cp -a "$bin_file" "$dest/bin/" 2>/dev/null
                fi
            done
        fi
    fi
    rm -rf "$extract_dir"
}

llAurInstall() {
    local helper="$1"
    shift
    local packages=()
    local flags=()
    local is_sync=0

    for arg in "$@"; do
        case "$arg" in
            -S) is_sync=1 ;;
            -S*) is_sync=1; flags+=("$arg") ;;
            -*) flags+=("$arg") ;;
            *) packages+=("$arg") ;;
        esac
    done

    [ "$is_sync" = "0" ] || [ ${#packages[@]} -eq 0 ] && { "$helper" "$@"; return; }

    echo "[LASTLAYER] Intercepting AUR install: ${packages[*]}"

    for pkg in "${packages[@]}"; do
        local build_dir="/tmp/ll_aur_build_$$_$pkg"
        local installed=0

        local effective_prefix
        if [ "$__LL_ISOLATION_MODE" = "per-program" ]; then
            effective_prefix="$__LL_PROGRAMS_BASE/$pkg/latest"
        else
            effective_prefix="$__LL_ISOLATION_PREFIX"
        fi
        mkdir -p "$effective_prefix/bin" "$effective_prefix/lib" "$effective_prefix/share" 2>/dev/null

        if "$__ll_real_pacman" -Qq "$pkg" &>/dev/null; then
            echo "[LASTLAYER] Package '$pkg' already installed, copying to prefix"
            if [ "$__LL_ISOLATION_MODE" = "per-program" ]; then
                effective_prefix="$(llGetProgramPrefix "$pkg")"
                mkdir -p "$effective_prefix/bin" "$effective_prefix/lib" "$effective_prefix/share" 2>/dev/null
            fi
            llCopyPkgToPrefix "$pkg" "$effective_prefix"
            export PATH="$effective_prefix/bin:$PATH"
            continue
        fi

        if git clone --depth=1 "https://aur.archlinux.org/$pkg.git" "$build_dir" 2>/dev/null; then
            pushd "$build_dir" >/dev/null

            source PKGBUILD 2>/dev/null || true

            if [ ${#makedepends[@]} -gt 0 ]; then
                echo "[LASTLAYER] Installing build deps: ${makedepends[*]}"
                "$helper" -S --asdeps --needed --noconfirm "${makedepends[@]}" 2>/dev/null || true
            fi

            if makepkg -sf --noconfirm 2>&1; then
                local pkg_file=$(ls -1 *.pkg.tar* 2>/dev/null | head -1)
                if [ -n "$pkg_file" ]; then
                    if [ "$__LL_ISOLATION_MODE" = "per-program" ]; then
                        local ver="$(echo "$pkg_file" | sed -n 's/.*-\\([0-9][^-]*\\)-[^-]*\\.pkg\\.tar.*/\\1/p')"
                        [ -n "$ver" ] && effective_prefix="$__LL_PROGRAMS_BASE/$pkg/$ver"
                        mkdir -p "$effective_prefix/bin" "$effective_prefix/lib" "$effective_prefix/share" 2>/dev/null
                    fi
                    echo "[LASTLAYER] Built $pkg, extracting to $effective_prefix"
                    llExtractPkg "$pkg_file" "$effective_prefix"
                    installed=1
                fi
            fi

            popd >/dev/null
            rm -rf "$build_dir"
        fi

        if [ "$installed" = "0" ]; then
            echo "[LASTLAYER] Building failed, falling back to system install + copy"

            local before_bins=$(ls /usr/bin 2>/dev/null | sort)

            "$helper" -S "$pkg" "${flags[@]}" --noconfirm

            local after_bins=$(ls /usr/bin 2>/dev/null | sort)

            if [ "$__LL_ISOLATION_MODE" = "per-program" ]; then
                effective_prefix="$(llGetProgramPrefix "$pkg")"
                mkdir -p "$effective_prefix/bin" "$effective_prefix/lib" "$effective_prefix/share" 2>/dev/null
            fi

            local new_bins=$(comm -13 <(echo "$before_bins") <(echo "$after_bins"))
            for bin in $new_bins; do
                if [ -f "/usr/bin/$bin" ]; then
                    echo "[LASTLAYER] Copying /usr/bin/$bin to $effective_prefix"
                    cp -a "/usr/bin/$bin" "$effective_prefix/bin/" 2>/dev/null || true
                fi
            done

            llCopyPkgToPrefix "$pkg" "$effective_prefix"
        fi

        export PATH="$effective_prefix/bin:$PATH"
        export LD_LIBRARY_PATH="$effective_prefix/lib:${LD_LIBRARY_PATH:-}"
    done
}

paru() { llAurInstall "$__ll_orig_paru" "$@"; }
yay() { llAurInstall "$__ll_orig_yay" "$@"; }
export -f paru yay llAurInstall llExtractPkg 2>/dev/null || true

__ll_orig_pacman="$__ll_real_pacman"
pacman() {
    local is_sync=0
    local is_query=0
    local is_quiet=0
    local packages=()
    for arg in "$@"; do
        case "$arg" in
            -S|-S*) is_sync=1 ;;
            -Q|-Q*) is_query=1; [[ "$arg" == *q* ]] && is_quiet=1 ;;
            -*) ;;
            *) packages+=("$arg") ;;
        esac
    done

    if [ "$is_query" = "1" ] && [ "$is_quiet" = "1" ] && [ ${#packages[@]} -gt 0 ]; then
        for pkg in "${packages[@]}"; do
            if "$__ll_real_pacman" -Qq "$pkg" &>/dev/null; then
                local effective_prefix
                if [ "$__LL_ISOLATION_MODE" = "per-program" ]; then
                    effective_prefix="$(llGetProgramPrefix "$pkg")"
                    mkdir -p "$effective_prefix/bin" "$effective_prefix/lib" "$effective_prefix/share" 2>/dev/null
                else
                    effective_prefix="$__LL_ISOLATION_PREFIX"
                fi
                llCopyPkgToPrefix "$pkg" "$effective_prefix" 2>/dev/null
            fi
        done
        "$__ll_orig_pacman" "$@"
        return $?
    fi

    if [ "$is_sync" = "1" ]; then
        echo "[LASTLAYER] Intercepting pacman: ${packages[*]}"

        for pkg in "${packages[@]}"; do
            local effective_prefix
            if [ "$__LL_ISOLATION_MODE" = "per-program" ]; then
                if "$__ll_real_pacman" -Qq "$pkg" &>/dev/null; then
                    effective_prefix="$(llGetProgramPrefix "$pkg")"
                else
                    effective_prefix="$__LL_PROGRAMS_BASE/$pkg/latest"
                fi
                mkdir -p "$effective_prefix/bin" "$effective_prefix/lib" "$effective_prefix/share" 2>/dev/null
            else
                effective_prefix="$__LL_ISOLATION_PREFIX"
            fi

            if "$__ll_real_pacman" -Qq "$pkg" &>/dev/null; then
                llCopyPkgToPrefix "$pkg" "$effective_prefix"
            fi
        done

        local before_bins=$(ls /usr/bin 2>/dev/null | sort)
        "$__ll_orig_pacman" "$@"
        local ret=$?
        local after_bins=$(ls /usr/bin 2>/dev/null | sort)
        local new_bins=$(comm -13 <(echo "$before_bins") <(echo "$after_bins"))

        for pkg in "${packages[@]}"; do
            local effective_prefix
            if [ "$__LL_ISOLATION_MODE" = "per-program" ]; then
                effective_prefix="$(llGetProgramPrefix "$pkg")"
                mkdir -p "$effective_prefix/bin" "$effective_prefix/lib" "$effective_prefix/share" 2>/dev/null
                export PATH="$effective_prefix/bin:$PATH"
                export LD_LIBRARY_PATH="$effective_prefix/lib:${LD_LIBRARY_PATH:-}"
            else
                effective_prefix="$__LL_ISOLATION_PREFIX"
            fi

            for bin in $new_bins; do
                if [ -f "/usr/bin/$bin" ]; then
                    cp -a "/usr/bin/$bin" "$effective_prefix/bin/" 2>/dev/null
                fi
            done

            llCopyPkgToPrefix "$pkg" "$effective_prefix"
        done

        return $ret
    else
        "$__ll_orig_pacman" "$@"
    fi
}
export -f pacman 2>/dev/null || true

__ll_orig_sudo="$(command -v sudo 2>/dev/null || echo sudo)"
sudo() {
    local cmd="$1"
    case "$cmd" in
        paru)
            shift
            echo "[LASTLAYER] Intercepting sudo paru, using local wrapper"
            paru "$@"
            ;;
        yay)
            shift
            echo "[LASTLAYER] Intercepting sudo yay, using local wrapper"
            yay "$@"
            ;;
        pacman)
            shift
            echo "[LASTLAYER] Intercepting sudo pacman, using real sudo + tracking"

            local packages=()
            for arg in "$@"; do
                case "$arg" in
                    -*) ;;
                    *) packages+=("$arg") ;;
                esac
            done

            for pkg in "${packages[@]}"; do
                if "$__ll_real_pacman" -Qq "$pkg" &>/dev/null; then
                    local effective_prefix
                    if [ "$__LL_ISOLATION_MODE" = "per-program" ]; then
                        effective_prefix="$(llGetProgramPrefix "$pkg")"
                        mkdir -p "$effective_prefix/bin" "$effective_prefix/lib" "$effective_prefix/share" 2>/dev/null
                    else
                        effective_prefix="$__LL_ISOLATION_PREFIX"
                    fi
                    llCopyPkgToPrefix "$pkg" "$effective_prefix"
                fi
            done

            local before_bins=$(ls /usr/bin 2>/dev/null | sort)
            "$__ll_orig_sudo" pacman "$@"
            local ret=$?
            local after_bins=$(ls /usr/bin 2>/dev/null | sort)
            local new_bins=$(comm -13 <(echo "$before_bins") <(echo "$after_bins"))

            for pkg in "${packages[@]}"; do
                local effective_prefix
                if [ "$__LL_ISOLATION_MODE" = "per-program" ]; then
                    effective_prefix="$(llGetProgramPrefix "$pkg")"
                    mkdir -p "$effective_prefix/bin" "$effective_prefix/lib" "$effective_prefix/share" 2>/dev/null
                    export PATH="$effective_prefix/bin:$PATH"
                    export LD_LIBRARY_PATH="$effective_prefix/lib:${LD_LIBRARY_PATH:-}"
                else
                    effective_prefix="$__LL_ISOLATION_PREFIX"
                fi

                for bin in $new_bins; do
                    [ -f "/usr/bin/$bin" ] && cp -a "/usr/bin/$bin" "$effective_prefix/bin/" 2>/dev/null
                done
                llCopyPkgToPrefix "$pkg" "$effective_prefix"
            done

            return $ret
            ;;
        *)
            "$__ll_orig_sudo" "$@"
            ;;
    esac
}
export -f sudo 2>/dev/null || true

echo "[LASTLAYER] Dependency isolation enabled (mode: $__LL_ISOLATION_MODE, prefix: $__LL_ISOLATION_PREFIX)"
