#!/bin/bash

ll_dep_pm=""
ll_dep_updated=0

ll_dep_log() {
    local msg="$1"
    local color="$2"
    if declare -F print_message >/dev/null 2>&1; then
        print_message "$msg" "$color"
    else
        echo "$msg"
    fi
}

ll_dep_detect_pm() {
    if [ -n "$ll_dep_pm" ]; then
        return 0
    fi
    if command -v pacman >/dev/null 2>&1; then
        ll_dep_pm="pacman"
    elif command -v apt-get >/dev/null 2>&1; then
        ll_dep_pm="apt"
    elif command -v dnf >/dev/null 2>&1; then
        ll_dep_pm="dnf"
    elif command -v yum >/dev/null 2>&1; then
        ll_dep_pm="yum"
    elif command -v zypper >/dev/null 2>&1; then
        ll_dep_pm="zypper"
    elif command -v xbps-install >/dev/null 2>&1; then
        ll_dep_pm="xbps"
    elif command -v apk >/dev/null 2>&1; then
        ll_dep_pm="apk"
    elif command -v eopkg >/dev/null 2>&1; then
        ll_dep_pm="eopkg"
    elif command -v emerge >/dev/null 2>&1; then
        ll_dep_pm="emerge"
    else
        ll_dep_pm="unknown"
    fi
}

ll_dep_as_root() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
        return $?
    fi
    if ! command -v sudo >/dev/null 2>&1; then
        return 127
    fi
    sudo "$@"
}

ll_dep_pm_update() {
    ll_dep_detect_pm
    if [ "$ll_dep_updated" -eq 1 ]; then
        return 0
    fi
    case "$ll_dep_pm" in
        apt)
            ll_dep_as_root apt-get update || return 1
            ;;
        xbps)
            ll_dep_as_root xbps-install -S || return 1
            ;;
    esac
    ll_dep_updated=1
    return 0
}

ll_dep_repo_has_pkg() {
    local pkg="$1"
    ll_dep_detect_pm
    case "$ll_dep_pm" in
        pacman)
            pacman -Si "$pkg" >/dev/null 2>&1
            ;;
        apt)
            apt-cache show "$pkg" >/dev/null 2>&1
            ;;
        dnf)
            dnf -q info "$pkg" >/dev/null 2>&1
            ;;
        yum)
            yum -q info "$pkg" >/dev/null 2>&1
            ;;
        zypper)
            zypper --non-interactive info "$pkg" >/dev/null 2>&1
            ;;
        xbps)
            xbps-query -Rs "^${pkg}$" >/dev/null 2>&1
            ;;
        apk)
            apk search -x "$pkg" >/dev/null 2>&1
            ;;
        eopkg)
            eopkg info "$pkg" >/dev/null 2>&1
            ;;
        emerge)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

ll_dep_install_pkg() {
    local pkg="$1"
    ll_dep_detect_pm
    case "$ll_dep_pm" in
        pacman)
            ll_dep_as_root pacman -Sy --needed --noconfirm "$pkg"
            ;;
        apt)
            ll_dep_pm_update || return 1
            ll_dep_as_root apt-get install -y "$pkg"
            ;;
        dnf)
            ll_dep_as_root dnf -y install "$pkg"
            ;;
        yum)
            ll_dep_as_root yum -y install "$pkg"
            ;;
        zypper)
            ll_dep_as_root zypper --non-interactive install --no-confirm --auto-agree-with-licenses "$pkg"
            ;;
        xbps)
            ll_dep_pm_update || return 1
            ll_dep_as_root xbps-install -y "$pkg"
            ;;
        apk)
            ll_dep_as_root apk add "$pkg"
            ;;
        eopkg)
            ll_dep_as_root eopkg install -y "$pkg"
            ;;
        emerge)
            ll_dep_as_root emerge --ask=n "$pkg"
            ;;
        *)
            return 1
            ;;
    esac
}

ll_dep_candidates() {
    local dep="$1"
    ll_dep_detect_pm
    case "$ll_dep_pm:$dep" in
        pacman:gjs) echo "gjs" ;;
        pacman:yad) echo "yad" ;;
        pacman:jq) echo "jq" ;;
        pacman:swww) echo "swww" ;;
        pacman:webkit2gtk) echo "webkit2gtk-4.1 webkit2gtk" ;;
        pacman:pkg-config) echo "pkgconf pkg-config" ;;
        pacman:soup-gi) echo "libsoup3 libsoup" ;;
        pacman:webkit2-gi-4.0) echo "webkit2gtk-4.1 webkit2gtk" ;;

        apt:gjs) echo "gjs" ;;
        apt:yad) echo "yad" ;;
        apt:jq) echo "jq" ;;
        apt:swww) echo "swww" ;;
        apt:webkit2gtk) echo "libwebkit2gtk-4.1-dev libwebkit2gtk-4.0-dev" ;;
        apt:pkg-config) echo "pkg-config pkgconf" ;;
        apt:soup-gi) echo "gir1.2-soup-3.0 libsoup-3.0-0 gir1.2-soup-2.4 libsoup2.4-1" ;;
        apt:webkit2-gi-4.0) echo "gir1.2-webkit2-4.1 gir1.2-webkit2-4.0 libwebkit2gtk-4.1-dev libwebkit2gtk-4.0-dev" ;;

        dnf:gjs) echo "gjs" ;;
        dnf:yad) echo "yad" ;;
        dnf:jq) echo "jq" ;;
        dnf:swww) echo "swww" ;;
        dnf:webkit2gtk) echo "webkit2gtk4.1-devel webkit2gtk4.0-devel" ;;
        dnf:pkg-config) echo "pkgconf-pkg-config pkgconf" ;;
        dnf:soup-gi) echo "libsoup3 libsoup3-devel libsoup libsoup-devel" ;;
        dnf:webkit2-gi-4.0) echo "webkit2gtk4.1 webkit2gtk4.1-devel webkit2gtk4.0-devel webkit2gtk3" ;;

        yum:gjs) echo "gjs" ;;
        yum:yad) echo "yad" ;;
        yum:jq) echo "jq" ;;
        yum:swww) echo "swww" ;;
        yum:webkit2gtk) echo "webkit2gtk4.1-devel webkit2gtk4.0-devel webkit2gtk3-devel" ;;
        yum:pkg-config) echo "pkgconf-pkg-config pkgconf" ;;
        yum:soup-gi) echo "libsoup3 libsoup3-devel libsoup libsoup-devel" ;;
        yum:webkit2-gi-4.0) echo "webkit2gtk4.0-devel webkit2gtk3 webkit2gtk3-devel" ;;

        zypper:gjs) echo "gjs" ;;
        zypper:yad) echo "yad" ;;
        zypper:jq) echo "jq" ;;
        zypper:swww) echo "swww" ;;
        zypper:webkit2gtk) echo "webkit2gtk4-devel webkit2gtk3-devel webkit2gtk-4_1-devel" ;;
        zypper:pkg-config) echo "pkgconf-pkg-config pkgconf pkg-config" ;;
        zypper:soup-gi) echo "typelib-1_0-Soup-3_0 libsoup-3_0-0 typelib-1_0-Soup-2_4 libsoup-2_4-1" ;;
        zypper:webkit2-gi-4.0) echo "typelib-1_0-WebKit2-4_1 typelib-1_0-WebKit2-4_0 webkit2gtk4-devel webkit2gtk3-devel" ;;

        xbps:gjs) echo "gjs" ;;
        xbps:yad) echo "yad" ;;
        xbps:jq) echo "jq" ;;
        xbps:swww) echo "swww" ;;
        xbps:webkit2gtk) echo "webkit2gtk-devel" ;;
        xbps:pkg-config) echo "pkgconf pkg-config" ;;
        xbps:soup-gi) echo "libsoup3 libsoup3-devel libsoup libsoup-devel" ;;
        xbps:webkit2-gi-4.0) echo "webkit2gtk webkit2gtk-devel" ;;

        apk:gjs) echo "gjs" ;;
        apk:yad) echo "yad" ;;
        apk:jq) echo "jq" ;;
        apk:swww) echo "swww" ;;
        apk:webkit2gtk) echo "webkit2gtk-dev webkit2gtk" ;;
        apk:pkg-config) echo "pkgconf pkgconfig pkg-config" ;;
        apk:soup-gi) echo "libsoup3 libsoup3-dev libsoup libsoup-dev" ;;
        apk:webkit2-gi-4.0) echo "webkit2gtk webkit2gtk-dev" ;;

        eopkg:gjs) echo "gjs" ;;
        eopkg:yad) echo "yad" ;;
        eopkg:jq) echo "jq" ;;
        eopkg:swww) echo "swww" ;;
        eopkg:webkit2gtk) echo "webkitgtk-devel webkit2gtk-devel" ;;
        eopkg:pkg-config) echo "pkgconfig pkg-config pkgconf" ;;
        eopkg:soup-gi) echo "libsoup3 libsoup3-devel libsoup libsoup-devel" ;;
        eopkg:webkit2-gi-4.0) echo "webkit2gtk webkitgtk-devel webkit2gtk-devel" ;;

        emerge:gjs) echo "gjs dev-lang/spidermonkey" ;;
        emerge:yad) echo "yad x11-misc/yad" ;;
        emerge:jq) echo "jq app-misc/jq" ;;
        emerge:swww) echo "swww gui-apps/swww" ;;
        emerge:webkit2gtk) echo "net-libs/webkit-gtk" ;;
        emerge:pkg-config) echo "dev-util/pkgconf dev-util/pkgconfig" ;;
        emerge:soup-gi) echo "net-libs/libsoup:3.0 net-libs/libsoup:2.4 net-libs/libsoup" ;;
        emerge:webkit2-gi-4.0) echo "net-libs/webkit-gtk:4.0 net-libs/webkit-gtk:4.1 net-libs/webkit-gtk" ;;
        *)
            echo ""
            ;;
    esac
}

ll_dep_try_install() {
    local dep="$1"
    local candidates pkg
    candidates=$(ll_dep_candidates "$dep")
    if [ -z "$candidates" ]; then
        return 1
    fi
    ll_dep_detect_pm
    for pkg in $candidates; do
        if [ "$ll_dep_pm" != "emerge" ] && ! ll_dep_repo_has_pkg "$pkg"; then
            continue
        fi
        ll_dep_log "Installing $dep via $ll_dep_pm: $pkg" "$YELLOW"
        if ll_dep_install_pkg "$pkg"; then
            return 0
        fi
    done
    return 1
}

ll_dep_install_if_missing_cmd() {
    local dep="$1"
    local cmd="$2"
    if command -v "$cmd" >/dev/null 2>&1; then
        return 0
    fi
    ll_dep_try_install "$dep"
}

ll_dep_install_if_missing_webkit() {
    if pkg-config --exists webkit2gtk-4.1 >/dev/null 2>&1 || pkg-config --exists webkit2gtk-4.0 >/dev/null 2>&1; then
        return 0
    fi
    ll_dep_try_install "webkit2gtk"
}

ll_dep_has_gi_namespace() {
    local namespace="$1"
    local version="$2"
    if ! command -v gjs >/dev/null 2>&1; then
        return 1
    fi
    if [ -n "$version" ]; then
        gjs -c "imports.gi.versions['${namespace}']='${version}'; const _ns = imports.gi['${namespace}'];" >/dev/null 2>&1
        return $?
    fi
    gjs -c "const _ns = imports.gi['${namespace}'];" >/dev/null 2>&1
    return $?
}

ll_dep_install_if_missing_gi_namespace() {
    local dep="$1"
    local namespace="$2"
    local version="$3"
    if ll_dep_has_gi_namespace "$namespace" "$version"; then
        return 0
    fi
    local candidates pkg
    candidates=$(ll_dep_candidates "$dep")
    if [ -z "$candidates" ]; then
        return 1
    fi
    ll_dep_detect_pm
    for pkg in $candidates; do
        if [ "$ll_dep_pm" != "emerge" ] && ! ll_dep_repo_has_pkg "$pkg"; then
            continue
        fi
        ll_dep_log "Installing $dep via $ll_dep_pm: $pkg" "$YELLOW"
        if ll_dep_install_pkg "$pkg" && ll_dep_has_gi_namespace "$namespace" "$version"; then
            return 0
        fi
    done
    ll_dep_has_gi_namespace "$namespace" "$version"
}

ll_dep_has_gi_namespace_any() {
    local namespace="$1"
    shift
    local version
    if [ "$#" -eq 0 ]; then
        ll_dep_has_gi_namespace "$namespace" ""
        return $?
    fi
    for version in "$@"; do
        if ll_dep_has_gi_namespace "$namespace" "$version"; then
            return 0
        fi
    done
    return 1
}

ll_dep_install_if_missing_gi_namespace_any() {
    local dep="$1"
    local namespace="$2"
    shift 2
    local versions=("$@")
    local candidates pkg version
    if ll_dep_has_gi_namespace_any "$namespace" "${versions[@]}"; then
        return 0
    fi
    candidates=$(ll_dep_candidates "$dep")
    if [ -z "$candidates" ]; then
        return 1
    fi
    ll_dep_detect_pm
    for pkg in $candidates; do
        if [ "$ll_dep_pm" != "emerge" ] && ! ll_dep_repo_has_pkg "$pkg"; then
            continue
        fi
        ll_dep_log "Installing $dep via $ll_dep_pm: $pkg" "$YELLOW"
        if ! ll_dep_install_pkg "$pkg"; then
            continue
        fi
        if ll_dep_has_gi_namespace_any "$namespace" "${versions[@]}"; then
            return 0
        fi
    done
    ll_dep_has_gi_namespace_any "$namespace" "${versions[@]}"
}
