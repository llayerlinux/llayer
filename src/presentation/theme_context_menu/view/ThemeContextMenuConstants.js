export const REDDIT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) LastLayer/1.0 (KHTML, like Gecko)';

export const IGNORED_PACKAGE_NAMES = [
    'waybar',
    'rofi',
    'dunst',
    'kitty',
    'alacritty',
    'hyprland',
    'sway',
    'polybar',
    'eww'
];

export const SUPPORTED_DISTRO_IDS = ['arch', 'manjaro', 'ubuntu', 'debian', 'fedora', 'opensuse'];

export const DISTRO_DISPLAY_NAMES = {
    arch: 'Arch',
    archlinux: 'Arch',
    manjaro: 'Manjaro',
    ubuntu: 'Ubuntu',
    debian: 'Debian',
    fedora: 'Fedora',
    centos: 'CentOS',
    rhel: 'RHEL',
    redhat: 'Red Hat',
    opensuse: 'openSUSE',
    suse: 'openSUSE',
    mint: 'Linux Mint',
    linuxmint: 'Linux Mint',
    elementary: 'elementary OS',
    popos: 'Pop!_OS',
    pop: 'Pop!_OS',
    kali: 'Kali',
    gentoo: 'Gentoo'
};

const DISTRO_IDS = Object.keys(DISTRO_DISPLAY_NAMES);
export const DISTRO_MATCH_KEYS = DISTRO_IDS.sort((a, b) => b.length - a.length);
export const KNOWN_DISTRO_IDS = new Set(DISTRO_MATCH_KEYS);

export const DEFAULT_MANAGERS_BY_DISTRO = {
    arch: 'pacman, paru',
    archlinux: 'pacman, paru',
    manjaro: 'pacman, paru',
    ubuntu: 'apt',
    debian: 'apt',
    fedora: 'dnf',
    centos: 'yum',
    rhel: 'yum',
    opensuse: 'zypper',
    suse: 'zypper',
    mint: 'apt',
    linuxmint: 'apt',
    gentoo: 'emerge'
};

export const DISTRO_ICON_FILES = {
    ubuntu: '512_ubuntu.png',
    debian: '512_debian.png',
    fedora: '512_fedora_newlogo_newcolor.png',
    centos: '512_centos_blue.png',
    rhel: '512_redhat.png',
    redhat: '512_redhat.png',
    arch: '512_arch.png',
    archlinux: '512_arch.png',
    opensuse: '512_suse.png',
    suse: '512_suse.png',
    manjaro: '512_manjaro.png',
    mint: '512_mint.png',
    linuxmint: '512_mint.png',
    elementary: '512_elementary.png',
    popos: '512_pop.png',
    pop: '512_pop.png',
    kali: '512_kali.png',
    gentoo: '512_gentoo.png'
};
